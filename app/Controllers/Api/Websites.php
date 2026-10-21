<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\WebsiteModel;
use App\Services\UserPlanService;
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

    public function show($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        if (!$websiteModel->canUserAccess((int)$id, $effectiveUserId, $isAdmin, false)) {
            return $this->failForbidden('Você não tem permissão para acessar este website.');
        }

        $site = $websiteModel->getUserWebsite($effectiveUserId, (int)$id, null, $isAdmin);
        if (!$site && $isAdmin) {
            $rawSite = $websiteModel->find($id);
            if ($rawSite) {
                $currentMonth = date('Y-m');
                $mModel = new \App\Models\WebsiteMaintenanceModel();
                $mRec = $mModel->where('website_id', (int)$id)->where('year_month', $currentMonth)->first();
                if ($mRec) {
                    $rawSite['maintenance_completed_at'] = $mRec['completed_at'] ?? null;
                    $rawSite['maintenance_notes'] = $mRec['notes'] ?? null;
                    if (!empty($mRec['user_id'])) {
                        $uModel = new \App\Models\UserModel();
                        $u = $uModel->find($mRec['user_id']);
                        $rawSite['maintenance_completed_by'] = $u['name'] ?? ($u['email'] ?? null);
                    }
                }
                $websiteModel->enrichWebsiteData($rawSite, $currentMonth);
                $site = $rawSite;
            }
        }

        if (!$site) {
            return $this->failNotFound('Website não encontrado.');
        }

        if (empty($site['agent_token'])) {
            $token = bin2hex(random_bytes(16));
            $websiteModel->update($site['id'], ['agent_token' => $token]);
            $site['agent_token'] = $token;
        }

        return $this->respond([
            'status' => 200,
            'data'   => $site,
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
                $url = 'https://' . $url;
            }
            if (!filter_var($url, FILTER_VALIDATE_URL)) {
                return $this->fail('A URL informada é inválida. Certifique-se de informar a URL da página inicial com https:// (ex: https://seusite.com.br).', 400);
            }
        }

        $effectiveUserId = (int)($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));

        // Validar limite de websites do plano
        $canAdd = \App\Services\UserPlanService::canUserAddWebsite($effectiveUserId);
        if (!$canAdd['allowed']) {
            return $this->failForbidden($canAdd['reason']);
        }

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
                $url = 'https://' . $url;
            }
            if (!filter_var($url, FILTER_VALIDATE_URL)) {
                return $this->fail('A URL informada é inválida. Certifique-se de informar a URL da página inicial com https:// (ex: https://seusite.com.br).', 400);
            }
        }

        $maintenanceDay = array_key_exists('maintenance_day', $json)
            ? (($json['maintenance_day'] !== null && $json['maintenance_day'] !== '') ? (int)$json['maintenance_day'] : null)
            : ($website['maintenance_day'] ?? null);
        if ($maintenanceDay !== null && ($maintenanceDay < 1 || $maintenanceDay > 31)) {
            $maintenanceDay = null;
        }

        $cleanUrl = rtrim($url, '/');
        $urlChanged = (rtrim($website['url'], '/') !== $cleanUrl);

        $updateData = [
            'name'            => $name,
            'url'             => $cleanUrl,
            'environment'     => $environment,
            'maintenance_day' => $maintenanceDay,
        ];

        if ($urlChanged) {
            // Se a URL mudou, desconectamos o agente para forçar a reinstalação / validação do plugin na nova URL
            $updateData['is_connected'] = 0;
        }

        $websiteModel->update($id, $updateData);

        $updatedWebsite = $websiteModel->find($id);

        $message = $urlChanged
            ? 'Website atualizado com sucesso. Como a URL foi alterada, o plugin agente do WordPress precisará ser baixado e instalado novamente no seu WordPress.'
            : 'Website atualizado com sucesso.';

        return $this->respond([
            'status'      => 200,
            'message'     => $message,
            'url_changed' => $urlChanged,
            'data'        => $updatedWebsite,
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
        $tempZip = WRITEPATH . 'uploads/vexors-agent-' . $id . '.zip';
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
                $relativePath = 'vexors-diagnostico/' . substr($filePath, strlen($templatePath));
                $zip->addFile($filePath, $relativePath);
            }
        }

        // Inject custom config.json
        $configContent = json_encode([
            'site_id'     => (int) $website['id'],
            'agent_token' => $website['agent_token'],
            'saas_url'    => $this->getSaasUrl(),
        ], JSON_PRETTY_PRINT);

        $zip->addFromString('vexors-diagnostico/config.json', $configContent);
        $zip->close();

        // Stream zip download
        $siteHost = parse_url($website['url'], PHP_URL_HOST) ?: str_replace(' ', '_', strtolower($website['name']));
        $siteSlug = preg_replace('/[^a-zA-Z0-9_\-]/', '-', $siteHost);
        return $this->response->download($tempZip, null)->setFileName("vexors-diagnostico-{$siteSlug}.zip");
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
            'message' => 'Site conectado com sucesso ao Vexors!',
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
            'X-Vexors-Token: ' . $token,
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
            CURLOPT_TIMEOUT        => 12,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_1_1,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
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
                'status'       => 500,
                'success'      => false,
                'message'      => 'Erro de conexão com o site: ' . $error,
                'curl_error'   => $error,
                'raw_response' => null,
            ];
        }

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            $rawStripped = strip_tags($response);
            $decodedHtml = html_entity_decode($rawStripped, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $cleanSnippet = trim(preg_replace('/\s+/', ' ', $decodedHtml));

            if ($statusCode === 406 || strpos($response, 'Not Acceptable') !== false || strpos($response, 'Mod_Security') !== false) {
                return [
                    'status'       => 406,
                    'success'      => false,
                    'message'      => 'Bloqueio pelo Firewall do Servidor (Mod_Security / WAF 406 Not Acceptable): O servidor do WordPress rejeitou a requisição do agente. O User-Agent de navegação foi configurado para contornar essa trava.',
                    'curl_error'   => $error,
                    'raw_response' => $response,
                ];
            }

            if ($statusCode === 404) {
                return [
                    'status'       => 404,
                    'success'      => false,
                    'message'      => 'Endpoint do agente não encontrado no WordPress (HTTP 404). Verifique se o plugin vexors.app está instalado e ativo, e se os Links Permanentes (Permalinks) do WordPress estão salvos.',
                    'curl_error'   => $error,
                    'raw_response' => $response,
                ];
            }

            return [
                'status'       => $statusCode ?: 500,
                'success'      => false,
                'message'      => 'Resposta inválida do agente WordPress (HTTP ' . $statusCode . '): ' . mb_substr($cleanSnippet, 0, 200, 'UTF-8'),
                'curl_error'   => $error,
                'raw_response' => $response,
            ];
        }

        return [
            'status'       => $statusCode,
            'body'         => $decoded,
            'curl_error'   => $error,
            'raw_response' => $response,
        ];
    }

    private function makeAgentRequestWithFallback(string $baseUrl, string $endpointPath, string $method = 'GET', string $token = '', array $params = []): array
    {
        $baseUrlClean = rtrim($baseUrl, '/');
        // Rotas canônicas e diretas do Vexors (evita flood de 8 URLs desnecessárias no servidor do cliente)
        $routes = [
            $baseUrlClean . '/wp-json/vexors/v1' . $endpointPath,
            $baseUrlClean . '/?rest_route=/vexors/v1' . $endpointPath,
        ];

        // Se for o endpoint específico de correções, tenta vexors-fixes caso vexors/v1 não atenda
        if (strpos($endpointPath, '/fixes') !== false) {
            $routes[] = $baseUrlClean . '/wp-json/vexors-fixes/v1' . $endpointPath;
            $routes[] = $baseUrlClean . '/?rest_route=/vexors-fixes/v1' . $endpointPath;
        }

        $lastRes = null;
        foreach ($routes as $url) {
            $lastRes = $this->makeAgentRequest($url, $method, $token, $params);
            if (!empty($lastRes['body']) && $lastRes['status'] === 200) {
                return $lastRes;
            }
        }

        // Se falhou no POST por 405 Method Not Allowed ou 406 WAF, tenta GET uma única vez na rota primária
        if ($method === 'POST' && in_array($lastRes['status'] ?? 0, [405, 406])) {
            $lastRes = $this->makeAgentRequest($routes[0], 'GET', $token, $params);
            if (!empty($lastRes['body']) && $lastRes['status'] === 200) {
                return $lastRes;
            }
        }

        if ($lastRes && ($lastRes['status'] ?? 0) === 404) {
            return [
                'status'       => 404,
                'success'      => false,
                'message'      => 'Endpoint do agente não encontrado no WordPress (HTTP 404). Certifique-se de que o plugin vexors.app está instalado e ativo, e que a estrutura de Links Permanentes (Permalinks) do WordPress foi salva.',
                'curl_error'   => $lastRes['curl_error'] ?? null,
                'raw_response' => $lastRes['raw_response'] ?? null,
            ];
        }

        return $lastRes ?: [
            'status'       => 404,
            'success'      => false,
            'message'      => 'Não foi possível se comunicar com o agente WordPress. Certifique-se de que a versão mais recente do plugin vexors.app - Diagnóstico está instalada e ativada no site.',
            'curl_error'   => null,
            'raw_response' => null,
        ];
    }

    private function failAgentResponse(array $res, string $defaultMessage = 'Falha na comunicação com o agente WordPress', ?array $context = null)
    {
        $message = $res['message'] ?? ($res['body']['message'] ?? $defaultMessage);
        $agentStatus = (int) ($res['status'] ?? 500);

        // Automatically log platform connection failure
        try {
            \App\Services\PlatformErrorLogger::log([
                'category'        => $context['category'] ?? 'agent_connection',
                'severity'        => ($agentStatus >= 500 || empty($agentStatus)) ? 'critical' : ($agentStatus === 404 ? 'warning' : 'error'),
                'website_id'      => $context['website_id'] ?? null,
                'user_id'         => $context['user_id'] ?? ($this->request->effectiveUserId ?? ($this->request->userData->id ?? null)),
                'endpoint'        => $context['endpoint'] ?? null,
                'http_method'     => $context['http_method'] ?? 'GET',
                'http_status'     => $agentStatus,
                'error_message'   => $message,
                'curl_error'      => $res['curl_error'] ?? null,
                'request_payload' => $context['request_payload'] ?? null,
                'response_body'   => $res['raw_response'] ?? ($res['body'] ?? null),
            ]);
        } catch (\Throwable $e) {
            // Silently continue
        }

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

        // Analisa e persiste logs fatais das últimas 48h
        $body = $res['body'];
        $allLogs = $body['logs'] ?? [];
        $time48hAgo = time() - (48 * 3600);
        $fatal48h = [];
        foreach ($allLogs as $logItem) {
            $lvl = strtolower($logItem['level'] ?? '');
            if ($lvl === 'fatal' || stripos($logItem['raw_line'] ?? '', 'fatal error') !== false || stripos($logItem['raw_line'] ?? '', 'parse error') !== false) {
                $logTime = !empty($logItem['timestamp']) ? strtotime($logItem['timestamp']) : null;
                if ($logTime === false || $logTime === null || $logTime >= $time48hAgo) {
                    $fatal48h[] = $logItem;
                }
            }
        }
        $logsSummary = [
            'total_fatal_48h' => count($fatal48h),
            'fatal_logs_48h'  => array_slice($fatal48h, 0, 20),
            'has_logs_agent'  => true,
            'logging_enabled' => !empty($body['logging_enabled']),
        ];
        $this->persistLogsCheck((int)$id, $logsSummary);

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

        // Reseta contador fatal no banco após limpar
        $this->persistLogsCheck((int)$id, [
            'total_fatal_48h' => 0,
            'fatal_logs_48h'  => [],
            'has_logs_agent'  => true,
            'logging_enabled' => true,
        ]);

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

        $forceRefresh = ($this->request->getGet('force_refresh') === '1');
        $lastChecked = !empty($website['last_updates_checked_at']) ? strtotime($website['last_updates_checked_at']) : 0;

        // Se force_refresh NÃO foi solicitado e os dados em cache têm menos de 15 minutos,
        // E o cache possui a lista completa de plugins (não é legado e não está vazio com pendências)
        if (!$forceRefresh && (time() - $lastChecked < 900) && !empty($website['updates_summary_json'])) {
            $cached = json_decode($website['updates_summary_json'], true);
            $hasPluginsKey = !empty($cached) && is_array($cached) && isset($cached['plugins']);
            $pendingCount  = (int)($website['updates_pending_count'] ?? 0);
            $hasPluginsIfPending = ($pendingCount === 0) || !empty($cached['plugins']);

            if ($hasPluginsKey && $hasPluginsIfPending) {
                return $this->respond([
                    'status'  => 200,
                    'success' => true,
                    'cached'  => true,
                    'data'    => [
                        'summary' => $cached['summary'] ?? [
                            'total_pending'   => $pendingCount,
                            'pending_plugins' => 0,
                            'pending_themes'  => 0,
                            'pending_core'    => 0,
                        ],
                        'core'    => $cached['core'] ?? ['current_version' => '', 'new_version' => '', 'has_update' => false],
                        'plugins' => $cached['plugins'] ?? [],
                        'themes'  => $cached['themes'] ?? [],
                    ],
                    'message' => 'Exibindo dados da última checagem recente.',
                ]);
            }
        }

        $cache = \Config\Services::cache();
        $lockKey = 'agent_lock_site_' . (int)$website['id'];

        if ($cache->get($lockKey) && !empty($website['updates_summary_json'])) {
            $cached = json_decode($website['updates_summary_json'], true);
            if (!empty($cached) && is_array($cached)) {
                $summary = $cached['summary'] ?? (isset($cached['total_pending']) ? $cached : [
                    'total_pending'   => (int)($website['updates_pending_count'] ?? 0),
                    'pending_plugins' => 0,
                    'pending_themes'  => 0,
                    'pending_core'    => 0,
                ]);
                return $this->respond([
                    'status'  => 200,
                    'success' => true,
                    'cached'  => true,
                    'data'    => [
                        'summary' => $summary,
                        'core'    => $cached['core'] ?? ['current_version' => '', 'new_version' => '', 'has_update' => false],
                        'plugins' => $cached['plugins'] ?? [],
                        'themes'  => $cached['themes'] ?? [],
                    ],
                    'message' => 'Uma checagem já está em andamento. Exibindo dados em cache.',
                ]);
            }
        }

        $cache->save($lockKey, time(), 30);
        try {
            $res = $this->makeAgentRequestWithFallback($website['url'], '/updates', 'GET', $website['agent_token'], [
                'force_refresh' => $forceRefresh ? '1' : '0'
            ]);
        } finally {
            $cache->delete($lockKey);
        }

        if (empty($res['body']) || $res['status'] !== 200) {
            if (!empty($website['updates_summary_json'])) {
                $cached = json_decode($website['updates_summary_json'], true);
                if (!empty($cached) && is_array($cached)) {
                    $summary = $cached['summary'] ?? (isset($cached['total_pending']) ? $cached : [
                        'total_pending'   => (int)($website['updates_pending_count'] ?? 0),
                        'pending_plugins' => 0,
                        'pending_themes'  => 0,
                        'pending_core'    => 0,
                    ]);
                    return $this->respond([
                        'status'  => 200,
                        'success' => true,
                        'cached'  => true,
                        'data'    => [
                            'summary' => $summary,
                            'core'    => $cached['core'] ?? ['current_version' => '', 'new_version' => '', 'has_update' => false],
                            'plugins' => $cached['plugins'] ?? [],
                            'themes'  => $cached['themes'] ?? [],
                        ],
                        'message' => 'Exibindo dados da última checagem salva (agente não respondeu no momento).',
                    ]);
                }
            }
            return $this->failAgentResponse($res, 'Falha ao buscar atualizações do agente');
        }

        $body = $res['body'];
        $data = $body['data'] ?? $body;
        if (!empty($data) && is_array($data)) {
            $this->persistUpdatesCheck((int)$id, $data);
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

        if (!$isAdmin && !UserPlanService::canUserUseRemediationTools($effectiveUserId)) {
            return $this->failForbidden('A aplicação remota de atualizações não está disponível no plano atual. Faça o upgrade para um plano pago para desbloquear.');
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

        // Após aplicar atualização com sucesso, consulta imediatamente o estado fresco de updates
        // e persiste no banco de dados do SaaS
        $freshUpdates = $this->makeAgentRequestWithFallback($website['url'], '/updates', 'GET', $website['agent_token']);
        if (!empty($freshUpdates['body']) && $freshUpdates['status'] === 200) {
            $data = $freshUpdates['body']['data'] ?? $freshUpdates['body'];
            if (!empty($data) && is_array($data)) {
                $this->persistUpdatesCheck((int)$id, $data);
                $res['body']['data'] = $data;
            }
        } elseif (!empty($res['body']['data']['summary'])) {
            $this->persistUpdatesCheck((int)$id, $res['body']['data']);
        }

        return $this->respond($res['body']);
    }

    /**
     * Persiste os resultados detalhados da última varredura de integridade na tabela websites.
     */
    private function persistIntegrityScan(int $websiteId, array $data): void
    {
        $summary     = $data['summary'] ?? [];
        $scannedAt   = $data['scanned_at'] ?? date('Y-m-d H:i:s');
        $activeCount = isset($summary['active_issues'])
            ? (int)$summary['active_issues']
            : (isset($summary['issues_count']) ? (int)$summary['issues_count'] : count($data['issues'] ?? []));
        $isSecure    = !empty($data['is_secure']) ? 1 : ($activeCount === 0 ? 1 : 0);

        $updateData = [
            'last_integrity_scanned_at' => $scannedAt,
            'integrity_is_secure'       => $isSecure,
            'integrity_issues_count'    => $activeCount,
            'integrity_total_checked'   => isset($summary['total_checked']) ? (int)$summary['total_checked'] : null,
            'integrity_passed'          => isset($summary['passed']) ? (int)$summary['passed'] : null,
            'integrity_ignored_issues'  => isset($summary['ignored_issues']) ? (int)$summary['ignored_issues'] : 0,
            'integrity_modified'        => isset($summary['modified']) ? (int)$summary['modified'] : 0,
            'integrity_suspicious'      => isset($summary['suspicious']) ? (int)$summary['suspicious'] : 0,
            'integrity_summary_json'    => json_encode($data, JSON_UNESCAPED_UNICODE),
        ];

        $websiteModel = new WebsiteModel();
        $websiteModel->update($websiteId, $updateData);
    }

    /**
     * Persiste o resumo da checagem de atualizações na tabela websites.
     */
    private function persistUpdatesCheck(int $websiteId, array $data): void
    {
        $summary = $data['summary'] ?? [];
        $totalPending = isset($summary['total_pending']) ? (int)$summary['total_pending'] : 0;
        $checkedAt = date('Y-m-d H:i:s');

        $fullPayload = [
            'summary' => $summary,
            'core'    => $data['core'] ?? ['current_version' => '', 'new_version' => '', 'has_update' => false],
            'plugins' => $data['plugins'] ?? [],
            'themes'  => $data['themes'] ?? [],
        ];

        $updateData = [
            'last_updates_checked_at' => $checkedAt,
            'updates_pending_count'   => $totalPending,
            'updates_summary_json'    => json_encode($fullPayload, JSON_UNESCAPED_UNICODE),
        ];

        $websiteModel = new WebsiteModel();
        $websiteModel->update($websiteId, $updateData);
    }

    /**
     * Persiste o resumo de logs/erros fatais na tabela websites.
     */
    private function persistLogsCheck(int $websiteId, array $logsSummary): void
    {
        $totalFatal = isset($logsSummary['total_fatal_48h']) ? (int)$logsSummary['total_fatal_48h'] : 0;
        $checkedAt = date('Y-m-d H:i:s');

        $updateData = [
            'last_logs_checked_at' => $checkedAt,
            'logs_fatal_count'     => $totalFatal,
            'logs_summary_json'    => json_encode($logsSummary, JSON_UNESCAPED_UNICODE),
        ];

        $websiteModel = new WebsiteModel();
        $websiteModel->update($websiteId, $updateData);
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

        $forceRefresh = ($this->request->getGet('force_refresh') === '1');
        $lastChecked = !empty($website['last_integrity_scanned_at']) ? strtotime($website['last_integrity_scanned_at']) : 0;

        // Se force_refresh NÃO foi solicitado e os dados em cache têm menos de 15 minutos, retorna do banco
        if (!$forceRefresh && (time() - $lastChecked < 900) && !empty($website['integrity_summary_json'])) {
            $cachedData = json_decode($website['integrity_summary_json'], true);
            if (!empty($cachedData)) {
                return $this->respond([
                    'status'  => 200,
                    'success' => true,
                    'cached'  => true,
                    'data'    => $cachedData,
                    'message' => 'Exibindo dados da última verificação recente.',
                ]);
            }
        }

        $res = $this->makeAgentRequestWithFallback($website['url'], '/integrity', 'GET', $website['agent_token']);

        if (empty($res['body']) || $res['status'] !== 200) {
            // Se o agente falhou ou deu timeout mas já temos dados salvos no banco, retorne o cache
            if (!empty($website['integrity_summary_json'])) {
                $cachedData = json_decode($website['integrity_summary_json'], true);
                if (!empty($cachedData)) {
                    return $this->respond([
                        'status'  => 200,
                        'success' => true,
                        'cached'  => true,
                        'data'    => $cachedData,
                        'message' => 'Exibindo dados da última varredura salva (agente não respondeu no momento).',
                    ]);
                }
            }
            return $this->failAgentResponse($res, 'Falha ao buscar integridade do agente');
        }

        // Atualiza campos de integridade no banco do SaaS
        $body = $res['body'];
        $data = $body['data'] ?? $body;
        if (!empty($data) && is_array($data)) {
            $this->persistIntegrityScan((int)$id, $data);
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
            $this->persistIntegrityScan((int)$id, $data);
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

        if (!$isAdmin && !UserPlanService::canUserUseRemediationTools($effectiveUserId)) {
            return $this->failForbidden('As ações de resolução e exceção de integridade não estão disponíveis no seu plano atual. Faça o upgrade para um plano pago para desbloquear.');
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

        $body = $res['body'];
        $data = $body['data'] ?? $body;
        if (!empty($data) && is_array($data)) {
            $this->persistIntegrityScan((int)$id, $data);
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

        if (!$isAdmin && !UserPlanService::canUserUseRemediationTools($effectiveUserId)) {
            return $this->failForbidden('A exclusão de arquivos suspeitos não está disponível no seu plano atual. Faça o upgrade para um plano pago para desbloquear.');
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

        $body = $res['body'];
        $data = $body['data'] ?? $body;
        if (!empty($data) && is_array($data)) {
            $this->persistIntegrityScan((int)$id, $data);
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

        if (!$isAdmin && !UserPlanService::canUserUseRemediationTools($effectiveUserId)) {
            return $this->failForbidden('A restauração automática de arquivos originais não está disponível no seu plano atual. Faça o upgrade para um plano pago para desbloquear.');
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

        $body = $res['body'];
        $data = $body['data'] ?? $body;
        if (!empty($data) && is_array($data)) {
            $this->persistIntegrityScan((int)$id, $data);
        }

        return $this->respond($res['body']);
    }

    public function fixes($id = null)
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

        $res = $this->makeAgentRequestWithFallback($website['url'], '/fixes', 'GET', $website['agent_token']);

        if (empty($res['body']) || $res['status'] !== 200) {
            $agentStatus = (int) ($res['status'] ?? 500);
            $msg = $res['message'] ?? ($res['body']['message'] ?? '');
            if ($agentStatus === 401 || strpos($msg, 'Token de acesso incorreto') !== false || strpos($msg, 'vs_unauthorized') !== false) {
                return $this->fail('Token de autenticação incorreto no WordPress. Baixe novamente o plugin vexors.app - Fixes gerado no painel para este site (o token já vem embutido), ou cole o Token em vexors.app > Diagnóstico no seu WordPress.', 502);
            }
            if ($agentStatus === 404 || strpos($msg, 'rest_no_route') !== false) {
                return $this->fail('Plugin vexors.app - Fixes não detectado ou rotas REST não registradas. Baixe o plugin de correções customizado pelo botão acima e ative-o no WordPress.', 502);
            }
            return $this->failAgentResponse($res, 'Falha ao buscar configurações de correções do agente');
        }

        return $this->respond($res['body']);
    }

    public function toggleFix($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $checkId = $this->request->getVar('check_id');
        $enabled = $this->request->getVar('enabled');

        if (empty($checkId)) {
            return $this->fail('Identificador da correção (check_id) não informado.', 400);
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

        $res = $this->makeAgentRequestWithFallback($website['url'], '/fixes/toggle', 'POST', $website['agent_token'], [
            'check_id' => $checkId,
            'enabled'  => $enabled,
        ]);

        if (empty($res['body']) || $res['status'] !== 200) {
            $agentStatus = (int) ($res['status'] ?? 500);
            $msg = $res['message'] ?? ($res['body']['message'] ?? '');
            if ($agentStatus === 401 || strpos($msg, 'Token de acesso incorreto') !== false || strpos($msg, 'vs_unauthorized') !== false) {
                return $this->fail('Token de autenticação incorreto no WordPress. Baixe novamente o plugin vexors.app - Fixes gerado no painel para este site, ou configure o Token em vexors.app > Diagnóstico no painel.', 502);
            }
            return $this->failAgentResponse($res, 'Falha ao alterar status da correção no agente');
        }

        return $this->respond($res['body']);
    }

    public function syncIntegrityAll()
    {
        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $websites = $websiteModel->getUserWebsites($effectiveUserId);

        $synced = 0;
        $failed = 0;
        $details = [];

        foreach ($websites as $site) {
            if (empty($site['agent_token']) || (int)($site['is_connected'] ?? 0) !== 1) {
                continue;
            }

            try {
                $res = $this->makeAgentRequestWithFallback($site['url'], '/integrity', 'GET', $site['agent_token']);
                if (!empty($res['body']) && $res['status'] === 200) {
                    $body = $res['body'];
                    $data = $body['data'] ?? $body;
                    if (!empty($data) && is_array($data)) {
                        $this->persistIntegrityScan((int)$site['id'], $data);
                        $synced++;
                        $details[] = [
                            'id'     => $site['id'],
                            'name'   => $site['name'],
                            'status' => 'success',
                        ];
                        continue;
                    }
                }
                $failed++;
                $details[] = [
                    'id'     => $site['id'],
                    'name'   => $site['name'],
                    'status' => 'error',
                ];
            } catch (\Throwable $e) {
                $failed++;
                $details[] = [
                    'id'     => $site['id'],
                    'name'   => $site['name'],
                    'status' => 'error',
                    'error'  => $e->getMessage(),
                ];
            }
        }

        return $this->respond([
            'status'  => 200,
            'message' => "Sincronização de integridade finalizada: {$synced} atualizados com sucesso, {$failed} com falha.",
            'data'    => [
                'synced_count' => $synced,
                'failed_count' => $failed,
                'details'      => $details,
            ],
        ]);
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
        $forceRefresh = ($this->request->getGet('force_refresh') === '1');

        $logsSummary = [
            'total_fatal_48h' => 0,
            'fatal_logs_48h'  => [],
            'has_logs_agent'  => false,
            'logging_enabled' => false,
        ];
        $integrityData = null;
        $updatesData   = null;

        // Pré-carrega cache do banco de dados do SaaS
        if (!empty($website['logs_summary_json'])) {
            $cachedLogs = json_decode($website['logs_summary_json'], true);
            if (!empty($cachedLogs)) {
                $logsSummary = $cachedLogs;
            }
        }
        if (!empty($website['integrity_summary_json'])) {
            $integrityData = json_decode($website['integrity_summary_json'], true);
        }
        if (!empty($website['updates_summary_json'])) {
            $cachedUpdates = json_decode($website['updates_summary_json'], true);
            if (!empty($cachedUpdates) && is_array($cachedUpdates)) {
                $updatesData = [
                    'summary' => $cachedUpdates['summary'] ?? (isset($cachedUpdates['total_pending']) ? $cachedUpdates : []),
                    'core'    => $cachedUpdates['core'] ?? ['current_version' => '', 'new_version' => '', 'has_update' => false],
                    'plugins' => $cachedUpdates['plugins'] ?? [],
                    'themes'  => $cachedUpdates['themes'] ?? [],
                ];
            }
        }

        // Verifica se já temos dados de diagnóstico gravados em banco de dados
        $hasCache = (!empty($website['last_logs_checked_at']) 
            || !empty($website['last_integrity_scanned_at']) 
            || !empty($website['last_updates_checked_at']) 
            || !empty($website['updates_summary_json'])
            || !empty($website['integrity_summary_json']));

        // SÓ consulta o agente WordPress live se:
        // 1. O usuário pediu explicitamente via ?force_refresh=1
        // 2. OU não temos absolutamente nenhum dado em cache gravado ainda e o site está conectado
        $shouldQueryLive = $forceRefresh || (!$hasCache && !empty($website['is_connected']));

        // Mutex Anti-Overload: Se já houver consulta em andamento para este website, não dispara concorrência
        $cache = \Config\Services::cache();
        $lockKey = 'agent_lock_site_' . (int)$website['id'];
        if ($shouldQueryLive && $cache->get($lockKey)) {
            $shouldQueryLive = false;
        }

        if ($shouldQueryLive && !empty($token) && !empty($website['url'])) {
            $cache->save($lockKey, time(), 30);
            try {
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
                            if ($logTime === false || $logTime === null || $logTime >= $time48hAgo) {
                                $fatal48h[] = $logItem;
                            }
                        }
                    }

                    $logsSummary['total_fatal_48h'] = count($fatal48h);
                    $logsSummary['fatal_logs_48h']  = array_slice($fatal48h, 0, 20);
                    $this->persistLogsCheck((int)$website['id'], $logsSummary);
                }

                // B. Fetch Core Integrity
                $integrityRes = $this->makeAgentRequestWithFallback($website['url'], '/integrity', 'GET', $token);
                if (!empty($integrityRes['body']) && $integrityRes['status'] === 200) {
                    $integrityData = $integrityRes['body']['data'] ?? $integrityRes['body'];
                    if (!empty($integrityData) && is_array($integrityData)) {
                        $this->persistIntegrityScan((int)$website['id'], $integrityData);
                    }
                }

                // C. Fetch Updates (não força checagem externa no WP.org a menos que forceRefresh seja true)
                $updatesRes = $this->makeAgentRequestWithFallback($website['url'], '/updates', 'GET', $token, [
                    'force_refresh' => $forceRefresh ? '1' : '0'
                ]);
                if (!empty($updatesRes['body']) && $updatesRes['status'] === 200) {
                    $updatesData = $updatesRes['body']['data'] ?? $updatesRes['body'];
                    if (!empty($updatesData) && is_array($updatesData)) {
                        $this->persistUpdatesCheck((int)$website['id'], $updatesData);
                    }
                }
            } finally {
                $cache->delete($lockKey);
            }
        }

        // Se o agente falhou ou o site não está conectado, usa cache salvo se disponível
        if (empty($integrityData) && !empty($website['integrity_summary_json'])) {
            $integrityData = json_decode($website['integrity_summary_json'], true);
        }
        if (empty($updatesData) && !empty($website['updates_summary_json'])) {
            $cachedUpdates = json_decode($website['updates_summary_json'], true);
            if (!empty($cachedUpdates) && is_array($cachedUpdates)) {
                $updatesData = [
                    'summary' => $cachedUpdates['summary'] ?? (isset($cachedUpdates['total_pending']) ? $cachedUpdates : []),
                    'core'    => $cachedUpdates['core'] ?? ['current_version' => '', 'new_version' => '', 'has_update' => false],
                    'plugins' => $cachedUpdates['plugins'] ?? [],
                    'themes'  => $cachedUpdates['themes'] ?? [],
                ];
            }
        }
        if (empty($logsSummary['has_logs_agent']) && !empty($website['logs_summary_json'])) {
            $cachedLogs = json_decode($website['logs_summary_json'], true);
            if (!empty($cachedLogs)) {
                $logsSummary = $cachedLogs;
            }
        }

        return $this->respond([
            'status'     => 200,
            'success'    => true,
            'generated_at' => date('Y-m-d H:i:s'),
            'website'    => [
                'id'                        => $website['id'],
                'name'                      => $website['name'],
                'url'                       => $website['url'],
                'environment'               => $website['environment'] ?? 'production',
                'is_connected'              => (int) ($website['is_connected'] ?? 0),
                'connected_at'              => $website['connected_at'] ?? null,
                'last_integrity_scanned_at' => $website['last_integrity_scanned_at'] ?? null,
                'integrity_issues_count'    => $website['integrity_issues_count'] ?? null,
                'integrity_is_secure'       => $website['integrity_is_secure'] ?? null,
                'last_updates_checked_at'   => $website['last_updates_checked_at'] ?? null,
                'updates_pending_count'     => $website['updates_pending_count'] ?? null,
                'last_logs_checked_at'      => $website['last_logs_checked_at'] ?? null,
                'logs_fatal_count'          => $website['logs_fatal_count'] ?? null,
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

    /**
     * Retorna a lista unificada de logs de atividades (manutenções + notas técnicas).
     */
    public function activityLogs($id = null)
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
            return $this->failForbidden('Você não tem permissão para visualizar as atividades deste website.');
        }

        $allActivities = $this->fetchWebsiteActivities((int)$id);

        return $this->respond([
            'status' => 200,
            'data'   => $allActivities,
        ]);
    }

    /**
     * Retorna o token público para o cliente visualizar os logs de atividades (gera se não existir).
     */
    public function getPublicLogToken($id = null)
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

        $token = $website['public_log_token'] ?? null;
        if (empty($token)) {
            $token = bin2hex(random_bytes(24));
            $websiteModel->update($id, ['public_log_token' => $token]);
        }

        return $this->respond([
            'status' => 200,
            'data'   => [
                'token'     => $token,
                'share_url' => base_url('/?share_log=' . $token),
            ],
        ]);
    }

    /**
     * Regenera o token público de compartilhamento de logs, invalidando o link anterior.
     */
    public function regeneratePublicLogToken($id = null)
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

        $newToken = bin2hex(random_bytes(24));
        $websiteModel->update($id, ['public_log_token' => $newToken]);

        return $this->respond([
            'status'  => 200,
            'message' => 'Novo link de visualização gerado com sucesso.',
            'data'    => [
                'token'     => $newToken,
                'share_url' => base_url('/?share_log=' . $newToken),
            ],
        ]);
    }

    /**
     * Endpoint público para o cliente consultar os logs de atividades através do token de compartilhamento.
     */
    public function publicActivityLogs($token = null)
    {
        if (empty($token)) {
            return $this->fail('Token de visualização não informado.', 400);
        }

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->where('public_log_token', $token)->first();

        if (!$website) {
            return $this->failNotFound('Link de visualização não encontrado ou expirado.');
        }

        $activities = $this->fetchWebsiteActivities((int)$website['id']);

        return $this->respond([
            'status' => 200,
            'data'   => [
                'website' => [
                    'name'        => $website['name'],
                    'url'         => $website['url'],
                    'environment' => $website['environment'] ?: 'production',
                ],
                'activities' => $activities,
            ],
        ]);
    }

    /**
     * Helper privado para obter e unificar todas as atividades de um website.
     */
    private function fetchWebsiteActivities(int $websiteId): array
    {
        $monthsPt = [
            '01' => 'Janeiro', '02' => 'Fevereiro', '03' => 'Março', '04' => 'Abril',
            '05' => 'Maio', '06' => 'Junho', '07' => 'Julho', '08' => 'Agosto',
            '09' => 'Setembro', '10' => 'Outubro', '11' => 'Novembro', '12' => 'Dezembro'
        ];

        // 1. Manutenções registradas
        $maintenanceModel = new \App\Models\WebsiteMaintenanceModel();
        $maintenances = $maintenanceModel->getHistory($websiteId, 100);
        $maintenanceItems = [];

        foreach ($maintenances as $m) {
            $yearMonth = $m['year_month'] ?? '';
            $parts = explode('-', $yearMonth);
            $monthFormatted = $yearMonth;
            if (count($parts) === 2 && isset($monthsPt[$parts[1]])) {
                $monthFormatted = $monthsPt[$parts[1]] . '/' . $parts[0];
            }

            $maintenanceItems[] = [
                'id'             => 'maint_' . $m['id'],
                'item_type'      => 'maintenance',
                'title'          => 'Manutenção Mensal - ' . $monthFormatted,
                'category'       => 'manutencao',
                'content'        => !empty($m['notes']) ? $m['notes'] : 'Manutenção do ciclo mensal registrada como concluída.',
                'action_date'    => !empty($m['completed_at']) ? $m['completed_at'] : $m['created_at'],
                'user_id'        => (int) ($m['user_id'] ?? 0),
                'user_name'      => $m['user_name'] ?? 'Usuário',
                'user_email'     => $m['user_email'] ?? '',
                'year_month'     => $yearMonth,
                'maintenance_id' => (int) $m['id'],
            ];
        }

        // 2. Notas técnicas / observações avulsas
        $noteModel = new \App\Models\WebsiteNoteModel();
        $notes = $noteModel->getNotesForWebsite($websiteId);
        $noteItems = [];

        foreach ($notes as $n) {
            $noteItems[] = [
                'id'          => 'note_' . $n['id'],
                'item_type'   => 'note',
                'title'       => !empty($n['title']) ? $n['title'] : 'Observação Técnica',
                'category'    => !empty($n['category']) ? $n['category'] : 'geral',
                'content'     => $n['content'],
                'action_date' => !empty($n['action_date']) ? $n['action_date'] : $n['created_at'],
                'user_id'     => (int) ($n['user_id'] ?? 0),
                'user_name'   => $n['user_name'] ?? 'Usuário',
                'user_email'  => $n['user_email'] ?? '',
                'note_id'     => (int) $n['id'],
            ];
        }

        // 3. Mesclar e ordenar cronologicamente por action_date (DESC)
        $allActivities = array_merge($maintenanceItems, $noteItems);
        usort($allActivities, function ($a, $b) {
            return strcmp($b['action_date'] ?? '', $a['action_date'] ?? '');
        });

        return $allActivities;
    }

    /**
     * Cadastra uma nova anotação técnica para o website.
     */
    public function createNote($id = null)
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
            return $this->failForbidden('Você não tem permissão para cadastrar anotações neste website.');
        }

        $json = $this->request->getJSON(true) ?? $this->request->getPost();
        $content = isset($json['content']) ? trim($json['content']) : '';

        if (empty($content)) {
            return $this->fail('O conteúdo da anotação é obrigatório.', 400);
        }

        $title = !empty($json['title']) ? trim($json['title']) : null;
        $category = !empty($json['category']) ? trim($json['category']) : 'geral';
        $actionDate = !empty($json['action_date']) ? trim($json['action_date']) : date('Y-m-d H:i:s');

        $noteModel = new \App\Models\WebsiteNoteModel();
        $noteId = $noteModel->insert([
            'website_id'  => (int)$id,
            'user_id'     => $effectiveUserId,
            'title'       => $title,
            'category'    => $category,
            'content'     => $content,
            'action_date' => $actionDate,
        ]);

        $createdNote = $noteModel->select('website_notes.*, users.name as user_name, users.email as user_email')
                                ->join('users', 'users.id = website_notes.user_id', 'left')
                                ->find($noteId);

        return $this->respond([
            'status'  => 201,
            'message' => 'Anotação técnica cadastrada com sucesso!',
            'data'    => $createdNote,
        ]);
    }

    /**
     * Atualiza uma anotação técnica existente.
     */
    public function updateNote($id = null, $noteId = null)
    {
        if (!$id || !$noteId) {
            return $this->fail('IDs informados inválidos.', 400);
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
            return $this->failForbidden('Você não tem permissão para alterar anotações neste website.');
        }

        $noteModel = new \App\Models\WebsiteNoteModel();
        $existing = $noteModel->where('id', $noteId)->where('website_id', $id)->first();

        if (!$existing) {
            return $this->failNotFound('Anotação não encontrada.');
        }

        $json = $this->request->getJSON(true) ?? $this->request->getPost();
        $updateData = [];

        if (isset($json['content'])) {
            $content = trim($json['content']);
            if (empty($content)) {
                return $this->fail('O conteúdo da anotação não pode ficar vazio.', 400);
            }
            $updateData['content'] = $content;
        }

        if (array_key_exists('title', $json)) {
            $updateData['title'] = !empty($json['title']) ? trim($json['title']) : null;
        }

        if (isset($json['category'])) {
            $updateData['category'] = trim($json['category']);
        }

        if (isset($json['action_date'])) {
            $updateData['action_date'] = trim($json['action_date']);
        }

        if (!empty($updateData)) {
            $noteModel->update($noteId, $updateData);
        }

        $updated = $noteModel->select('website_notes.*, users.name as user_name, users.email as user_email')
                             ->join('users', 'users.id = website_notes.user_id', 'left')
                             ->find($noteId);

        return $this->respond([
            'status'  => 200,
            'message' => 'Anotação técnica atualizada com sucesso!',
            'data'    => $updated,
        ]);
    }

    /**
     * Remove uma anotação técnica.
     */
    public function deleteNote($id = null, $noteId = null)
    {
        if (!$id || !$noteId) {
            return $this->fail('IDs informados inválidos.', 400);
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
            return $this->failForbidden('Você não tem permissão para remover anotações deste website.');
        }

        $noteModel = new \App\Models\WebsiteNoteModel();
        $existing = $noteModel->where('id', $noteId)->where('website_id', $id)->first();

        if (!$existing) {
            return $this->failNotFound('Anotação não encontrada.');
        }

        $noteModel->delete($noteId);

        return $this->respond([
            'status'  => 200,
            'message' => 'Anotação técnica removida com sucesso.',
        ]);
    }
}
