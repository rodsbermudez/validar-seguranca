<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\PlanModel;
use App\Models\UserModel;
use App\Models\SettingsModel;

class Plans extends ResourceController
{
    protected $format = 'json';

    /**
     * GET /api/plans
     * Lista planos disponíveis
     */
    public function index()
    {
        $userData = $this->request->userData ?? null;
        $isAdmin = (($userData->role ?? 'user') === 'admin');

        $planModel = new PlanModel();
        $query = $planModel->orderBy('sort_order', 'ASC')->orderBy('id', 'ASC');

        if (!$isAdmin) {
            $query->where('is_active', 1);
        }

        $plans = $query->findAll();

        foreach ($plans as &$p) {
            $p['id'] = (int)$p['id'];
            $p['max_websites'] = $p['max_websites'] !== null ? (int)$p['max_websites'] : null;
            $p['ai_monthly_tokens'] = (int)$p['ai_monthly_tokens'];
            $p['price_monthly'] = (float)$p['price_monthly'];
            $p['is_active'] = (int)$p['is_active'];
            $p['is_default'] = (int)$p['is_default'];
            $p['sort_order'] = (int)$p['sort_order'];
        }

        return $this->respond([
            'status' => 200,
            'data'   => $plans,
        ]);
    }

    /**
     * GET /api/public/plans
     * Lista planos ativos publicamente para a Landing Page (sem autenticação)
     */
    public function publicIndex()
    {
        $planModel = new PlanModel();
        $plans = $planModel->where('is_active', 1)
                           ->orderBy('sort_order', 'ASC')
                           ->orderBy('id', 'ASC')
                           ->findAll();

        foreach ($plans as &$p) {
            $p['id'] = (int)$p['id'];
            $p['max_websites'] = $p['max_websites'] !== null ? (int)$p['max_websites'] : null;
            $p['ai_monthly_tokens'] = (int)$p['ai_monthly_tokens'];
            $p['price_monthly'] = (float)$p['price_monthly'];
            $p['is_active'] = (int)$p['is_active'];
            $p['is_default'] = (int)$p['is_default'];
            $p['sort_order'] = (int)$p['sort_order'];
        }

        return $this->respond([
            'status'          => 200,
            'data'            => $plans,
            'payment_methods' => SettingsModel::getPaymentMethods(),
        ]);
    }

    /**
     * POST /api/plans
     * Criar novo plano (admin)
     */
    public function create()
    {
        $userData = $this->request->userData ?? null;
        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Apenas administradores podem cadastrar planos.');
        }

        $json = $this->request->getJSON(true) ?? $this->request->getPost();

        $name = trim($json['name'] ?? '');
        $slug = trim($json['slug'] ?? '');
        if (empty($name)) {
            return $this->fail('O nome do plano é obrigatório.', 400);
        }

        if (empty($slug)) {
            $slug = url_title($name, '-', true);
        }

        $planModel = new PlanModel();
        if ($planModel->where('slug', $slug)->first()) {
            return $this->fail('Já existe um plano com este identificador (slug).', 400);
        }

        $maxWebsites = array_key_exists('max_websites', $json)
            ? (($json['max_websites'] === null || $json['max_websites'] === '' || $json['max_websites'] === 'unlimited') ? null : (int)$json['max_websites'])
            : 4;

        $aiTokens = array_key_exists('ai_monthly_tokens', $json) && $json['ai_monthly_tokens'] !== ''
            ? max(1000, (int)$json['ai_monthly_tokens'])
            : 250000;

        $priceMonthly = array_key_exists('price_monthly', $json) && $json['price_monthly'] !== ''
            ? max(0, (float)$json['price_monthly'])
            : 0.00;

        $isDefault = !empty($json['is_default']) ? 1 : 0;
        if ($isDefault) {
            // Se este for default, remove o default dos outros
            $planModel->where('id >', 0)->set(['is_default' => 0])->update();
        }

        $newId = $planModel->insert([
            'name'              => $name,
            'slug'              => $slug,
            'description'       => trim($json['description'] ?? ''),
            'max_websites'      => $maxWebsites,
            'ai_monthly_tokens' => $aiTokens,
            'price_monthly'     => $priceMonthly,
            'is_active'         => !empty($json['is_active']) ? 1 : 0,
            'is_default'        => $isDefault,
            'sort_order'        => (int)($json['sort_order'] ?? 0),
        ]);

        $created = $planModel->find($newId);

        return $this->respondCreated([
            'status'  => 201,
            'message' => 'Plano criado com sucesso.',
            'data'    => $created,
        ]);
    }

    /**
     * PUT /api/plans/(:num)
     * Atualizar plano existente (admin)
     */
    public function update($id = null)
    {
        $userData = $this->request->userData ?? null;
        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Apenas administradores podem editar planos.');
        }

        if (!$id) {
            return $this->fail('ID do plano não fornecido.', 400);
        }

        $planModel = new PlanModel();
        $plan = $planModel->find($id);
        if (!$plan) {
            return $this->failNotFound('Plano não encontrado.');
        }

        $json = $this->request->getJSON(true) ?? $this->request->getRawInput();

        $dataToUpdate = [];

        if (isset($json['name'])) {
            $name = trim($json['name']);
            if (empty($name)) {
                return $this->fail('O nome do plano não pode ser vazio.', 400);
            }
            $dataToUpdate['name'] = $name;
        }

        if (isset($json['slug'])) {
            $slug = trim($json['slug']);
            if (!empty($slug)) {
                $existing = $planModel->where('slug', $slug)->where('id !=', $id)->first();
                if ($existing) {
                    return $this->fail('Já existe outro plano com este identificador (slug).', 400);
                }
                $dataToUpdate['slug'] = $slug;
            }
        }

        if (array_key_exists('description', $json)) {
            $dataToUpdate['description'] = trim($json['description'] ?? '');
        }

        if (array_key_exists('max_websites', $json)) {
            $maxW = $json['max_websites'];
            if ($maxW === null || $maxW === '' || $maxW === 'unlimited') {
                $dataToUpdate['max_websites'] = null;
            } else {
                $dataToUpdate['max_websites'] = max(1, (int)$maxW);
            }
        }

        if (array_key_exists('ai_monthly_tokens', $json)) {
            $dataToUpdate['ai_monthly_tokens'] = max(1000, (int)$json['ai_monthly_tokens']);
        }

        if (array_key_exists('price_monthly', $json)) {
            $dataToUpdate['price_monthly'] = max(0, (float)$json['price_monthly']);
        }

        if (isset($json['is_active'])) {
            $dataToUpdate['is_active'] = !empty($json['is_active']) ? 1 : 0;
        }

        if (isset($json['is_default'])) {
            $isDefault = !empty($json['is_default']) ? 1 : 0;
            if ($isDefault) {
                $planModel->where('id >', 0)->set(['is_default' => 0])->update();
            }
            $dataToUpdate['is_default'] = $isDefault;
        }

        if (isset($json['sort_order'])) {
            $dataToUpdate['sort_order'] = (int)$json['sort_order'];
        }

        if (!empty($dataToUpdate)) {
            $planModel->update($id, $dataToUpdate);
        }

        $updated = $planModel->find($id);

        return $this->respond([
            'status'  => 200,
            'message' => 'Plano atualizado com sucesso.',
            'data'    => $updated,
        ]);
    }

    /**
     * DELETE /api/plans/(:num)
     * Desativar ou excluir plano (admin)
     */
    public function delete($id = null)
    {
        $userData = $this->request->userData ?? null;
        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Apenas administradores podem gerenciar planos.');
        }

        if (!$id) {
            return $this->fail('ID do plano não fornecido.', 400);
        }

        $planModel = new PlanModel();
        $plan = $planModel->find($id);
        if (!$plan) {
            return $this->failNotFound('Plano não encontrado.');
        }

        $userModel = new UserModel();
        $usersCount = $userModel->where('plan_id', $id)->countAllResults();

        if ($usersCount > 0) {
            // Em vez de excluir e quebrar FK, desativa o plano
            $planModel->update($id, ['is_active' => 0]);
            return $this->respond([
                'status'  => 200,
                'message' => "O plano possui {$usersCount} usuário(s) vinculado(s) e foi desativado para novas contratações.",
            ]);
        }

        $planModel->delete($id);

        return $this->respond([
            'status'  => 200,
            'message' => 'Plano excluído permanentemente com sucesso.',
        ]);
    }
}
