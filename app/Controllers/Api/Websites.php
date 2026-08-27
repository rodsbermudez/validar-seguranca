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
        $userData        = $this->request->userData ?? null;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if ($website['user_id'] != $effectiveUserId && ($userData->role ?? 'user') !== 'admin') {
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
        $userData        = $this->request->userData ?? null;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        // Check ownership or admin status
        if ($website['user_id'] != $effectiveUserId && ($userData->role ?? 'user') !== 'admin') {
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

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($id);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
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
                $relativePath = 'validar-seguranca-agent/' . substr($filePath, strlen($templatePath));
                $zip->addFile($filePath, $relativePath);
            }
        }

        // Inject custom config.json
        $configContent = json_encode([
            'site_id'     => (int) $website['id'],
            'agent_token' => $website['agent_token'],
            'saas_url'    => base_url(),
        ], JSON_PRETTY_PRINT);

        $zip->addFromString('validar-seguranca-agent/config.json', $configContent);
        $zip->close();

        // Stream zip download
        return $this->response->download($tempZip, null)->setFileName('validar-seguranca-agent-' . str_replace(' ', '_', strtolower($website['name'])) . '.zip');
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
}
