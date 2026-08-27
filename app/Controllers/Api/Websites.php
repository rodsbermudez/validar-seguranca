<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\WebsiteModel;

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

        $websiteModel = new WebsiteModel();
        $newId = $websiteModel->insert([
            'user_id'     => $effectiveUserId,
            'name'        => $name,
            'url'         => rtrim($url, '/'),
            'environment' => $environment,
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
}
