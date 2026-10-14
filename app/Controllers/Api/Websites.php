<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\WebsiteModel;
use ZipArchive;
use RecursiveIteratorIterator;
use RecursiveDirectoryIterator;

class Websites extends ResourceController
{
    protected $format = 'json';

    public function index()
    {
        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));

        $websiteModel = new WebsiteModel();
        $websites = $websiteModel->getUserWebsites($effectiveUserId);

        // Ensure agent_token exists for older records
        foreach ($websites as &$site) {
            $site['id']           = (int)$site['id'];
            $site['user_id']      = (int)$site['user_id'];
            $site['is_owner']     = (bool)$site['is_owner'];
            $site['shares_count'] = (int)($site['shares_count'] ?? 0);
            if (empty($site['agent_token'])) {
                $token = bin2hex(random_bytes(16));
                $websiteModel->update($site['id'], ['agent_token' => $token]);
                $site['agent_token'] = $token;
            }
        }

        return $this->respond([
            'status' => 200,
            'data'   => $websites,
        ]);
    }

    public function create()
    {
        $json = $this->request->getJSON(true) ?? $this->request->getPost();

        $name        = trim($json['name'] ?? '');
        $url         = trim($json['url'] ?? '');
        $environment = trim($json['environment'] ?? 'production');

        if (empty($name) || empty($url)) {
            return $this->fail('Nome e URL do site são obrigatórios.', 400);
        }

        // Validate URL format
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            if (!preg_match('/^https?:\/\//i', $url)) {
                $url = 'http://' . $url;
            }
            if (!filter_var($url, FILTER_VALIDATE_URL)) {
                return $this->fail('A URL informada é inválida.', 400);
            }
        }

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);
        $agentToken      = bin2hex(random_bytes(16));

        $maintenanceDay = isset($json['maintenance_day']) && $json['maintenance_day'] !== '' ? (int)$json['maintenance_day'] : null;
        if ($maintenanceDay !== null && ($maintenanceDay < 1 || $maintenanceDay > 31)) {
            $maintenanceDay = null;
        }

        $websiteModel = new WebsiteModel();
        $newId = $websiteModel->insert([
            'user_id'         => $effectiveUserId,
            'name'            => $name,
            'url'             => rtrim($url, '/'),
            'environment'     => $environment,
            'maintenance_day' => $maintenanceDay,
            'agent_token'     => $agentToken,
            'is_connected'    => 0,
        ]);

        $createdWebsite = $websiteModel->find($newId);

        return $this->respondCreated([
            'status'  => 201,
            'message' => 'Website cadastrado com sucesso.',
            'data'    => $createdWebsite,
        ]);
    }

    public function update($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin, true)) {
            return $this->failForbidden('Apenas o proprietário ou administrador pode editar este website.');
        }

        $json = $this->request->getJSON(true) ?? $this->request->getRawInput();

        $name        = trim($json['name'] ?? $website['name']);
        $url         = trim($json['url'] ?? $website['url']);
        $environment = trim($json['environment'] ?? $website['environment']);

        if (empty($name) || empty($url)) {
            return $this->fail('Nome e URL do site são obrigatórios.', 400);
        }

        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            if (!preg_match('/^https?:\/\//i', $url)) {
                $url = 'http://' . $url;
            }
            if (!filter_var($url, FILTER_VALIDATE_URL)) {
                return $this->fail('A URL informada é inválida.', 400);
            }
        }

        $maintenanceDay = array_key_exists('maintenance_day', $json)
            ? (($json['maintenance_day'] !== null && $json['maintenance_day'] !== '') ? (int)$json['maintenance_day'] : null)
            : ($website['maintenance_day'] ?? null);
        if ($maintenanceDay !== null && ($maintenanceDay < 1 || $maintenanceDay > 31)) {
            $maintenanceDay = null;
        }

        $websiteModel->update($id, [
            'name'            => $name,
            'url'             => rtrim($url, '/'),
            'environment'     => $environment,
            'maintenance_day' => $maintenanceDay,
        ]);

        $updatedWebsite = $websiteModel->find($id);

        return $this->respond([
            'status'  => 200,
            'message' => 'Website atualizado com sucesso.',
            'data'    => $updatedWebsite,
        ]);
    }

    public function delete($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin, true)) {
            return $this->failForbidden('Apenas o proprietário ou administrador pode remover este website.');
        }

        $websiteModel->delete($id);

        return $this->respond([
            'status'  => 200,
            'message' => 'Website removido com sucesso.',
        ]);
    }

    public function downloadPlugin($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin, false)) {
            return $this->failForbidden('Você não tem permissão para baixar o plugin deste website.');
        }

        // Ensure token exists
        if (empty($website['agent_token'])) {
            $token = bin2hex(random_bytes(16));
            $websiteModel->update($id, ['agent_token' => $token]);
            $website['agent_token'] = $token;
        }

        $templatePath = ROOTPATH . 'plugin-template/validar-seguranca-agent/';
        if (!is_dir($templatePath)) {
            return $this->fail('Modelo de plugin não encontrado no servidor.', 500);
        }

        // Create temp zip file
        $tempZip = WRITEPATH . 'uploads/validar-seguranca-agent-' . $id . '.zip';
        if (file_exists($tempZip)) {
            unlink($tempZip);
        }

        $zip = new ZipArchive();
        if ($zip->open($tempZip, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return $this->fail('Não foi possível gerar o arquivo ZIP.', 500);
        }

        // Add plugin files
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($templatePath),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            if (!$file->isDir()) {
                $filePath = $file->getRealPath();
                $relativePath = 'wp-patropi-diagnostico/' . substr($filePath, strlen($templatePath));
                $zip->addFile($filePath, $relativePath);
            }
        }

        // Inject custom config.json
        $configContent = json_encode([
            'site_id'     => (int) $website['id'],
            'agent_token' => $website['agent_token'],
            'saas_url'    => $this->getSaasUrl(),
        ], JSON_PRETTY_PRINT);

        $zip->addFromString('wp-patropi-diagnostico/config.json', $configContent);
        $zip->close();

        // Stream zip download
        $siteHost = parse_url($website['url'], PHP_URL_HOST) ?: str_replace(' ', '_', strtolower($website['name']));
        $siteSlug = preg_replace('/[^a-zA-Z0-9_\-]/', '-', $siteHost);
        return $this->response->download($tempZip, null)->setFileName("wp-patropi-diagnostico-{$siteSlug}.zip");
    }

    public function connect()
    {
        $json = $this->request->getJSON(true) ?? $this->request->getPost();

        $siteId     = $json['site_id'] ?? null;
        $agentToken = $json['agent_token'] ?? null;
        $siteUrl    = $json['site_url'] ?? null;

        if (!$siteId || !$agentToken) {
            return $this->fail('ID do site e token são obrigatórios para conexão.', 400);
        }

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($siteId);

        if (!$website) {
            return $this->failNotFound('Website não cadastrado no painel.');
        }

        if (trim($website['agent_token']) !== trim($agentToken)) {
            return $this->failUnauthorized('Token de agente inválido para este site.');
        }

        // Update connection status
        $websiteModel->update($siteId, [
            'is_connected' => 1,
            'connected_at' => date('Y-m-d H:i:s'),
        ]);

        return $this->respond([
            'status'  => 200,
            'message' => 'Site conectado com sucesso ao Validar Segurança!',
            'data'    => [
                'site_id'      => $siteId,
                'is_connected' => 1,
            ],
        ]);
    }

    private function getSaasUrl(): string
    {
        $request = service('request');

        $isHttps = ($request->getServer('HTTPS') === 'on' ||
                    $request->getServer('HTTP_X_FORWARDED_PROTO') === 'https' ||
                    $request->getServer('SERVER_PORT') == 443);
        $scheme = $isHttps ? 'https' : 'http';

        $host = $request->getServer('HTTP_HOST') ?: $request->getServer('SERVER_NAME');

        if (!empty($host) && !in_array(strtolower(explode(':', $host)[0]), ['localhost', '127.0.0.1', '::1'])) {
            $scriptName = $request->getServer('SCRIPT_NAME') ?? '';
            $dir = rtrim(dirname($scriptName), '/\\');
            if ($dir === '.' || $dir === '/' || $dir === '\\') {
                $dir = '';
            }
            return rtrim("{$scheme}://{$host}{$dir}", '/') . '/';
        }

        return rtrim(base_url(), '/') . '/';
    }

    private function makeAgentRequest(string $url, string $method = 'GET', string $token = '', array $params = []): array
    {
        // Append token as query param to bypass WAF header stripping
        if (!empty($token)) {
            $tokenParam = ['vs_token' => $token];
            if ($method === 'GET') {
                $params = array_merge($params, $tokenParam);
            } else {
                $url .= (strpos($url, '?') !== false ? '&' : '?') . http_build_query($tokenParam);
            }
        }

        if ($method === 'GET' && !empty($params)) {
            $url .= (strpos($url, '?') !== false ? '&' : '?') . http_build_query($params);
        }

        $headers = [
            'Authorization: Bearer ' . $token,
            'X-Validar-Seguranca-Token: ' . $token,
            'Accept: application/json, text/plain, */*',
            'Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control: no-cache',
        ];

        if ($method === 'POST') {
            $headers[] = 'Content-Type: application/json';
        }

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 5,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER     => $headers,
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            $postData = !empty($params) ? $params : ['action' => 'execute', 'timestamp' => time()];
            if (!empty($token) && !isset($postData['vs_token'])) {
                $postData['vs_token'] = $token;
            }
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
        }

        $response   = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error      = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            return [
                'status'  => 500,
                'success' => false,
                'message' => 'Erro de conexão com o site: ' . $error,
            ];
        }

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            $cleanSnippet = trim(preg_replace('/\s+/', ' ', strip_tags($response)));
            if ($statusCode === 406 || strpos($response, 'Not Acceptable') !== false || strpos($response, 'Mod_Security') !== false) {
                return [
                    'status'  => 406,
                    'success' => false,
                    'message' => 'Bloqueio pelo Firewall do Servidor (Mod_Security / WAF 406 Not Acceptable): O servidor do WordPress rejeitou a requisição do agente. O User-Agent de navegação foi configurado para contornar essa trava.',
                ];
            }

            return [
                'status'  => $statusCode ?: 500,
                'success' => false,
                'message' => 'Resposta inválida do agente WordPress (HTTP ' . $statusCode . '): ' . substr($cleanSnippet, 0, 200),
            ];
        }

        return [
            'status' => $statusCode,
            'body'   => $decoded,
        ];
    }

    private function makeAgentRequestWithFallback(string $baseUrl, string $endpointPath, string $method = 'GET', string $token = '', array $params = []): array
    {
        $baseUrlClean = rtrim($baseUrl, '/');
        $routes = [
            $baseUrlClean . '/wp-json/wp-patropi/v1' . $endpointPath,
            $baseUrlClean . '/?rest_route=/wp-patropi/v1' . $endpointPath,
            $baseUrlClean . '/wp-json/validar-seguranca/v1' . $endpointPath,
            $baseUrlClean . '/?rest_route=/validar-seguranca/v1' . $endpointPath,
        ];

        $lastRes = null;
        foreach ($routes as $url) {
            $lastRes = $this->makeAgentRequest($url, $method, $token, $params);
            if (!empty($lastRes['body']) && $lastRes['status'] === 200) {
                return $lastRes;
            }
        }

        // If POST failed or was blocked by WAF (406, 403, 405), attempt GET fallback
        if ($method === 'POST') {
            foreach ($routes as $url) {
                $lastRes = $this->makeAgentRequest($url, 'GET', $token, $params);
                if (!empty($lastRes['body']) && $lastRes['status'] === 200) {
                    return $lastRes;
                }
            }
        }

        return $lastRes ?: [
            'status'  => 404,
            'success' => false,
            'message' => 'Não foi possível se comunicar com o agente WordPress. Certifique-se de que a versão mais recente do plugin WP Patropi Agent está instalada e ativada no site.',
        ];
    }

    private function failAgentResponse(array $res, string $defaultMessage = 'Falha na comunicação com o agente WordPress')
    {
        $message = $res['message'] ?? ($res['body']['message'] ?? $defaultMessage);
        $agentStatus = (int) ($res['status'] ?? 500);

        // Crucial: Never return HTTP 401 or 403 to the client for WordPress agent errors.
        // 401 is strictly reserved for SaaS JWT authentication session.
        // If 401 is returned here, frontend interceptors think the user's SaaS session expired and log them out!
        $httpStatus = ($agentStatus === 401 || $agentStatus === 403) ? 502 : ($agentStatus ?: 500);

        return $this->fail($message, $httpStatus);
    }

    public function logs($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para acessar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $limit       = $this->request->getGet('limit') ?? 100;
        $filterLevel = $this->request->getGet('filter_level') ?? 'all';

        $res = $this->makeAgentRequestWithFallback($website['url'], '/logs', 'GET', $website['agent_token'], [
            'limit'        => $limit,
            'filter_level' => $filterLevel,
        ]);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->failAgentResponse($res, 'Falha ao buscar logs do agente');
        }

        return $this->respond($res['body']);
    }

    public function toggleLogs($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para alterar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $res = $this->makeAgentRequestWithFallback($website['url'], '/logs/toggle', 'POST', $website['agent_token']);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->failAgentResponse($res, 'Falha ao alterar estado do log');
        }

        return $this->respond($res['body']);
    }

    public function clearLogs($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para alterar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $res = $this->makeAgentRequestWithFallback($website['url'], '/logs/clear', 'POST', $website['agent_token']);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->failAgentResponse($res, 'Falha ao limpar logs');
        }

        return $this->respond($res['body']);
    }

    public function updates($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para acessar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $res = $this->makeAgentRequestWithFallback($website['url'], '/updates', 'GET', $website['agent_token']);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->failAgentResponse($res, 'Falha ao buscar atualizações do agente');
        }

        return $this->respond($res['body']);
    }

    public function applyUpdate($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $type = $this->request->getVar('type');
        $item = $this->request->getVar('item');

        if (empty($type)) {
            return $this->fail('Tipo de atualização não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para alterar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $res = $this->makeAgentRequestWithFallback($website['url'], '/updates/apply', 'POST', $website['agent_token'], [
            'type' => $type,
            'item' => $item,
        ]);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->failAgentResponse($res, 'Falha ao aplicar atualização');
        }

        return $this->respond($res['body']);
    }

    public function integrity($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para acessar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $res = $this->makeAgentRequestWithFallback($website['url'], '/integrity', 'GET', $website['agent_token']);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->failAgentResponse($res, 'Falha ao buscar integridade do agente');
        }

        // Atualiza campos de integridade no banco do SaaS
        $body = $res['body'];
        $data = $body['data'] ?? $body;
        if (!empty($data) && is_array($data)) {
            $issuesCount = $data['summary']['active_issues'] ?? ($data['summary']['issues_count'] ?? count($data['issues'] ?? []));
            $scannedAt   = $data['scanned_at'] ?? date('Y-m-d H:i:s');
            $isSecure    = !empty($data['is_secure']) ? 1 : ($issuesCount === 0 ? 1 : 0);
            $websiteModel->update($id, [
                'last_integrity_scanned_at' => $scannedAt,
                'integrity_issues_count'    => (int)$issuesCount,
                'integrity_is_secure'       => (int)$isSecure,
            ]);
        }

        return $this->respond($res['body']);
    }

    public function scanIntegrity($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para executar ações neste website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $res = $this->makeAgentRequestWithFallback($website['url'], '/integrity/scan', 'POST', $website['agent_token'], [
            'action' => 'scan_core',
        ]);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->failAgentResponse($res, 'Falha ao executar varredura de integridade');
        }

        // Atualiza campos de integridade no banco do SaaS
        $body = $res['body'];
        $data = $body['data'] ?? $body;
        if (!empty($data) && is_array($data)) {
            $issuesCount = $data['summary']['active_issues'] ?? ($data['summary']['issues_count'] ?? count($data['issues'] ?? []));
            $scannedAt   = $data['scanned_at'] ?? date('Y-m-d H:i:s');
            $isSecure    = !empty($data['is_secure']) ? 1 : ($issuesCount === 0 ? 1 : 0);
            $websiteModel->update($id, [
                'last_integrity_scanned_at' => $scannedAt,
                'integrity_issues_count'    => (int)$issuesCount,
                'integrity_is_secure'       => (int)$isSecure,
            ]);
        }

        return $this->respond($res['body']);
    }

    public function ignoreIntegrityIssue($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $file   = $this->request->getVar('file');
        $ignore = $this->request->getVar('ignore');
        $note   = $this->request->getVar('note') ?? '';

        if (empty($file)) {
            return $this->fail('Caminho do arquivo não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para alterar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $ignoreBool = ($ignore === null) ? true : filter_var($ignore, FILTER_VALIDATE_BOOLEAN);

        $res = $this->makeAgentRequestWithFallback($website['url'], '/integrity/ignore', 'POST', $website['agent_token'], [
            'file'   => $file,
            'ignore' => $ignoreBool,
            'note'   => $note,
        ]);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->failAgentResponse($res, 'Falha ao atualizar status de exceção do arquivo');
        }

        return $this->respond($res['body']);
    }

    public function deleteIntegrityFile($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $file = $this->request->getVar('file');

        if (empty($file)) {
            return $this->fail('Caminho do arquivo não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para alterar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $res = $this->makeAgentRequestWithFallback($website['url'], '/integrity/delete-file', 'POST', $website['agent_token'], [
            'file' => $file,
        ]);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->failAgentResponse($res, 'Falha ao excluir arquivo do servidor');
        }

        return $this->respond($res['body']);
    }

    public function restoreIntegrityFile($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $file = $this->request->getVar('file');

        if (empty($file)) {
            return $this->fail('Caminho do arquivo não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para alterar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $res = $this->makeAgentRequestWithFallback($website['url'], '/integrity/restore-file', 'POST', $website['agent_token'], [
            'file' => $file,
        ]);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->failAgentResponse($res, 'Falha ao restaurar arquivo do core');
        }

        return $this->respond($res['body']);
    }

    public function diagnosticSummary($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para visualizar este website.');
        }

        // 1. Get latest security scan
        $scanHistoryModel = new \App\Models\ScanHistoryModel();
        $latestScanRow = $scanHistoryModel->where('website_id', $id)
                                          ->where('status', 'completed')
                                          ->orderBy('executed_at', 'DESC')
                                          ->first();

        $latestScan = null;
        if ($latestScanRow && !empty($latestScanRow['scan_results_json'])) {
            $latestScan = json_decode($latestScanRow['scan_results_json'], true);
            if ($latestScan) {
                $latestScan['executed_at'] = $latestScanRow['executed_at'];
                $latestScan['score']       = $latestScanRow['score'];
            }
        }

        // 2. Query Agent for Live Metrics if connected and token exists
        $token = $website['agent_token'] ?? '';
        $logsSummary = [
            'total_fatal_48h' => 0,
            'fatal_logs_48h'  => [],
            'has_logs_agent'  => false,
            'logging_enabled' => false,
        ];
        $integrityData = null;
        $updatesData   = null;

        if (!empty($token) && !empty($website['url'])) {
            // A. Fetch recent fatal logs
            $logsRes = $this->makeAgentRequestWithFallback($website['url'], '/logs', 'GET', $token, [
                'limit'        => 100,
                'filter_level' => 'all',
            ]);

            if (!empty($logsRes['body']) && $logsRes['status'] === 200) {
                $logsSummary['has_logs_agent']  = true;
                $logsSummary['logging_enabled'] = !empty($logsRes['body']['logging_enabled']);
                $allLogs = $logsRes['body']['logs'] ?? [];

                $time48hAgo = time() - (48 * 3600);
                $fatal48h = [];

                foreach ($allLogs as $logItem) {
                    $lvl = strtolower($logItem['level'] ?? '');
                    if ($lvl === 'fatal' || stripos($logItem['raw_line'] ?? '', 'fatal error') !== false || stripos($logItem['raw_line'] ?? '', 'parse error') !== false) {
                        $logTime = !empty($logItem['timestamp']) ? strtotime($logItem['timestamp']) : null;
                        // Include if timestamp is within 48h, or if timestamp could not be parsed, include as recent
                        if ($logTime === false || $logTime === null || $logTime >= $time48hAgo) {
                            $fatal48h[] = $logItem;
                        }
                    }
                }

                $logsSummary['total_fatal_48h'] = count($fatal48h);
                $logsSummary['fatal_logs_48h']  = array_slice($fatal48h, 0, 20); // Top 20 fatal logs
            }

            // B. Fetch Core Integrity
            $integrityRes = $this->makeAgentRequestWithFallback($website['url'], '/integrity', 'GET', $token);
            if (!empty($integrityRes['body']) && $integrityRes['status'] === 200) {
                $integrityData = $integrityRes['body']['data'] ?? $integrityRes['body'];
            }

            // C. Fetch Updates
            $updatesRes = $this->makeAgentRequestWithFallback($website['url'], '/updates', 'GET', $token);
            if (!empty($updatesRes['body']) && $updatesRes['status'] === 200) {
                $updatesData = $updatesRes['body']['data'] ?? $updatesRes['body'];
            }
        }

        return $this->respond([
            'status'     => 200,
            'success'    => true,
            'generated_at' => date('Y-m-d H:i:s'),
            'website'    => [
                'id'           => $website['id'],
                'name'         => $website['name'],
                'url'          => $website['url'],
                'environment'  => $website['environment'] ?? 'production',
                'is_connected' => (int) ($website['is_connected'] ?? 0),
                'connected_at' => $website['connected_at'] ?? null,
            ],
            'data'       => [
                'latest_scan' => $latestScan,
                'logs_48h'    => $logsSummary,
                'integrity'   => $integrityData,
                'updates'     => $updatesData,
            ],
        ]);
    }

    public function shares($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para visualizar este website.');
        }

        $userModel = new \App\Models\UserModel();
        $owner = $userModel->find($website['user_id']);

        $db = \Config\Database::connect();
        $shares = $db->table('website_shares ws')
            ->select('ws.id, ws.user_id, ws.role, ws.created_at, u.name, u.email')
            ->join('users u', 'u.id = ws.user_id')
            ->where('ws.website_id', (int)$id)
            ->orderBy('ws.created_at', 'ASC')
            ->get()
            ->getResultArray();

        return $this->respond([
            'status' => 200,
            'data'   => [
                'website'  => [
                    'id'   => (int)$website['id'],
                    'name' => $website['name'],
                    'url'  => $website['url'],
                ],
                'owner'    => [
                    'id'    => (int)($owner['id'] ?? 0),
                    'name'  => $owner['name'] ?? 'Usuário',
                    'email' => $owner['email'] ?? '',
                ],
                'is_owner' => ((int)$website['user_id'] === $effectiveUserId) || $isAdmin,
                'shares'   => $shares,
            ]
        ]);
    }

    public function addShare($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        // Somente o dono do site ou Admin pode compartilhar
        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin, true)) {
            return $this->failForbidden('Apenas o proprietário do website pode compartilhar o acesso.');
        }

        $json  = $this->request->getJSON(true) ?? $this->request->getPost();
        $email = strtolower(trim($json['email'] ?? ''));
        $role  = trim($json['role'] ?? 'viewer');

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->fail('Informe um e-mail válido para compartilhar.', 400);
        }

        $userModel = new \App\Models\UserModel();
        $targetUser = $userModel->where('email', $email)->first();

        if (!$targetUser) {
            return $this->failNotFound('Nenhum usuário com o e-mail informado foi encontrado na plataforma.');
        }

        if ((int)$targetUser['id'] === (int)$website['user_id']) {
            return $this->fail('Este usuário já é o proprietário do website.', 400);
        }

        $shareModel = new \App\Models\WebsiteShareModel();
        $existing = $shareModel->where('website_id', (int)$id)
                               ->where('user_id', (int)$targetUser['id'])
                               ->first();

        if ($existing) {
            return $this->fail('Este website já está compartilhado com este usuário.', 400);
        }

        $shareModel->insert([
            'website_id' => (int)$id,
            'user_id'    => (int)$targetUser['id'],
            'role'       => $role ?: 'viewer',
        ]);

        return $this->respondCreated([
            'status'  => 201,
            'message' => 'Website compartilhado com sucesso com ' . $targetUser['name'] . '.',
            'data'    => [
                'user_id' => (int)$targetUser['id'],
                'name'    => $targetUser['name'],
                'email'   => $targetUser['email'],
                'role'    => $role ?: 'viewer',
            ]
        ]);
    }

    public function removeShare($id = null, $shareUserId = null)
    {
        if (!$id || !$shareUserId) {
            return $this->fail('Parâmetros insuficientes para remover compartilhamento.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        $isOwner = ((int)$website['user_id'] === $effectiveUserId) || $isAdmin;
        $isSelf  = ((int)$shareUserId === $effectiveUserId);

        // Somente o dono/admin pode remover qualquer membro, ou o próprio membro pode remover a si mesmo
        if (!$isOwner && !$isSelf) {
            return $this->failForbidden('Você não tem permissão para revogar este acesso.');
        }

        $shareModel = new \App\Models\WebsiteShareModel();
        $share = $shareModel->where('website_id', (int)$id)
                            ->where('user_id', (int)$shareUserId)
                            ->first();

        if (!$share) {
            return $this->failNotFound('Compartilhamento não encontrado.');
        }

        $shareModel->delete($share['id']);

        return $this->respond([
            'status'  => 200,
            'message' => $isSelf ? 'Você saiu do monitoramento deste website.' : 'Acesso revogado com sucesso.',
        ]);
    }

    public function completeMaintenance($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para gerenciar manutenções deste website.');
        }

        $json = $this->request->getJSON(true) ?? $this->request->getPost();
        $yearMonth = !empty($json['year_month']) ? trim($json['year_month']) : date('Y-m');
        $notes = !empty($json['notes']) ? trim($json['notes']) : null;

        $maintenanceModel = new \App\Models\WebsiteMaintenanceModel();
        $record = $maintenanceModel->completeMaintenance((int)$id, $effectiveUserId, $yearMonth, $notes);

        $userModel = new \App\Models\UserModel();
        $completingUser = $userModel->find($effectiveUserId);
        $record['user_name'] = $completingUser['name'] ?? null;
        $record['user_email'] = $completingUser['email'] ?? null;

        $status = \App\Models\WebsiteMaintenanceModel::calculateStatus(
            isset($website['maintenance_day']) ? (int)$website['maintenance_day'] : null,
            $record,
            $yearMonth
        );

        return $this->respond([
            'status'  => 200,
            'message' => 'Manutenção registrada como concluída com sucesso!',
            'data'    => [
                'record' => $record,
                'status' => $status,
            ],
        ]);
    }

    public function uncompleteMaintenance($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para gerenciar manutenções deste website.');
        }

        $yearMonth = $this->request->getGet('year_month') ?? date('Y-m');

        $maintenanceModel = new \App\Models\WebsiteMaintenanceModel();
        $maintenanceModel->uncompleteMaintenance((int)$id, $yearMonth);

        $status = \App\Models\WebsiteMaintenanceModel::calculateStatus(
            isset($website['maintenance_day']) ? (int)$website['maintenance_day'] : null,
            null,
            $yearMonth
        );

        return $this->respond([
            'status'  => 200,
            'message' => 'Manutenção desmarcada.',
            'data'    => [
                'status' => $status,
            ],
        ]);
    }

    public function maintenanceHistory($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para visualizar o histórico deste website.');
        }

        $maintenanceModel = new \App\Models\WebsiteMaintenanceModel();
        $history = $maintenanceModel->getHistory((int)$id, 12);

        return $this->respond([
            'status' => 200,
            'data'   => $history,
        ]);
    }
}
