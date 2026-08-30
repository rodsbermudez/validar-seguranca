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
        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);

        $websiteModel = new WebsiteModel();
        $websites = $websiteModel
            ->where('user_id', $effectiveUserId)
            ->orderBy('created_at', 'DESC')
            ->findAll();

        // Ensure agent_token exists for older records
        foreach ($websites as &$site) {
            $site['id'] = (int)$site['id'];
            $site['user_id'] = (int)$site['user_id'];
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

        $websiteModel = new WebsiteModel();
        $newId = $websiteModel->insert([
            'user_id'     => $effectiveUserId,
            'name'        => $name,
            'url'         => rtrim($url, '/'),
            'environment' => $environment,
            'agent_token' => $agentToken,
            'is_connected'=> 0,
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

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if ($website['user_id'] != $effectiveUserId) {
            return $this->failForbidden('Você não tem permissão para editar este website.');
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

        $websiteModel->update($id, [
            'name'        => $name,
            'url'         => rtrim($url, '/'),
            'environment' => $environment,
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

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if ($website['user_id'] != $effectiveUserId) {
            return $this->failForbidden('Você não tem permissão para remover este website.');
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

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if ($website['user_id'] != $effectiveUserId) {
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
        if ($method === 'GET' && !empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER     => [
                'X-Validar-Seguranca-Token: ' . $token,
                'Accept: application/json',
            ],
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if (!empty($params)) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($params));
            }
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
            return [
                'status'  => $statusCode ?: 500,
                'success' => false,
                'message' => 'Resposta inválida do agente WordPress: ' . substr($response, 0, 200),
            ];
        }

        return [
            'status' => $statusCode,
            'body'   => $decoded,
        ];
    }

    public function logs($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if ($website['user_id'] != $effectiveUserId && !$isAdmin) {
            return $this->failForbidden('Você não tem permissão para acessar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $targetUrl   = rtrim($website['url'], '/') . '/wp-json/wp-patropi/v1/logs';
        $limit       = $this->request->getGet('limit') ?? 100;
        $filterLevel = $this->request->getGet('filter_level') ?? 'all';

        $res = $this->makeAgentRequest($targetUrl, 'GET', $website['agent_token'], [
            'limit'        => $limit,
            'filter_level' => $filterLevel,
        ]);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->fail($res['message'] ?? ($res['body']['message'] ?? 'Falha ao buscar logs do agente'), $res['status'] ?: 500);
        }

        return $this->respond($res['body']);
    }

    public function toggleLogs($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if ($website['user_id'] != $effectiveUserId && !$isAdmin) {
            return $this->failForbidden('Você não tem permissão para alterar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $targetUrl = rtrim($website['url'], '/') . '/wp-json/wp-patropi/v1/logs/toggle';

        $res = $this->makeAgentRequest($targetUrl, 'POST', $website['agent_token']);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->fail($res['message'] ?? ($res['body']['message'] ?? 'Falha ao alterar estado do log'), $res['status'] ?: 500);
        }

        return $this->respond($res['body']);
    }

    public function clearLogs($id = null)
    {
        if (!$id) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if ($website['user_id'] != $effectiveUserId && !$isAdmin) {
            return $this->failForbidden('Você não tem permissão para alterar este website.');
        }

        if (empty($website['agent_token'])) {
            return $this->fail('Este website não possui token do agente configurado.', 400);
        }

        $targetUrl = rtrim($website['url'], '/') . '/wp-json/wp-patropi/v1/logs/clear';

        $res = $this->makeAgentRequest($targetUrl, 'POST', $website['agent_token']);

        if (empty($res['body']) || $res['status'] !== 200) {
            return $this->fail($res['message'] ?? ($res['body']['message'] ?? 'Falha ao limpar logs'), $res['status'] ?: 500);
        }

        return $this->respond($res['body']);
    }
}
