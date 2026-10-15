<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\UserModel;

class Users extends ResourceController
{
    protected $format = 'json';

    public function index()
    {
        $userData = $this->request->userData ?? null;

        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Acesso restrito a administradores.');
        }

        $userModel = new UserModel();
        $users = $userModel
            ->select('id, name, email, role, is_active, ai_enabled, ai_monthly_token_limit, created_at')
            ->orderBy('created_at', 'DESC')
            ->findAll();

        $tokenPrice = (float) \App\Models\SettingsModel::getSetting('ai_token_price_per_1k', '0.00');
        $aiLogModel = new \App\Models\AiUsageLogModel();
        foreach ($users as &$user) {
            $user['id'] = (int) $user['id'];
            $user['is_active'] = (int) $user['is_active'];
            $user['ai_enabled'] = isset($user['ai_enabled']) ? (int) $user['ai_enabled'] : 1;
            $user['ai_monthly_token_limit'] = $user['ai_monthly_token_limit'] !== null ? (int) $user['ai_monthly_token_limit'] : null;
            $user['current_month_tokens'] = $aiLogModel->getUserMonthlyTokens($user['id']);
            $user['current_month_cost'] = round(($user['current_month_tokens'] / 1000) * $tokenPrice, 2);
        }

        return $this->respond([
            'status'             => 200,
            'token_price_per_1k' => $tokenPrice,
            'data'               => $users,
        ]);
    }

    public function create()
    {
        $userData = $this->request->userData ?? null;

        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Acesso restrito a administradores.');
        }

        $json = $this->request->getJSON(true) ?? $this->request->getPost();

        $name     = trim($json['name'] ?? '');
        $email    = trim($json['email'] ?? '');
        $password = trim($json['password'] ?? '');
        $isAdmin  = !empty($json['is_admin']) || ($json['role'] ?? '') === 'admin';

        if (empty($name) || empty($email) || empty($password)) {
            return $this->fail('Nome, email e senha são obrigatórios.', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->fail('Formato de e-mail inválido.', 400);
        }

        $userModel = new UserModel();

        if ($userModel->where('email', $email)->first()) {
            return $this->fail('Este e-mail já está cadastrado no sistema.', 400);
        }

        $role = $isAdmin ? 'admin' : 'user';

        $newId = $userModel->insert([
            'name'          => $name,
            'email'         => $email,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
            'role'          => $role,
            'is_active'     => 1,
        ]);

        $createdUser = $userModel->select('id, name, email, role, is_active, created_at')->find($newId);
        if ($createdUser) {
            $createdUser['id'] = (int) $createdUser['id'];
            $createdUser['is_active'] = (int) $createdUser['is_active'];
        }

        return $this->respondCreated([
            'status'  => 201,
            'message' => 'Usuário cadastrado com sucesso.',
            'data'    => $createdUser,
        ]);
    }

    public function update($id = null)
    {
        $userData = $this->request->userData ?? null;

        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Acesso restrito a administradores.');
        }

        if (!$id) {
            return $this->fail('ID do usuário não informado.', 400);
        }

        $userModel = new UserModel();
        $user = $userModel->find($id);

        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        $json = $this->request->getJSON(true) ?? $this->request->getRawInput();

        $name     = trim($json['name'] ?? $user['name']);
        $email    = trim($json['email'] ?? $user['email']);
        $password = trim($json['password'] ?? '');
        $isAdmin  = isset($json['is_admin']) ? !empty($json['is_admin']) : (isset($json['role']) ? $json['role'] === 'admin' : $user['role'] === 'admin');

        if (empty($name) || empty($email)) {
            return $this->fail('Nome e e-mail são obrigatórios.', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->fail('Formato de e-mail inválido.', 400);
        }

        // Check unique email for another user
        $existing = $userModel->where('email', $email)->where('id !=', $id)->first();
        if ($existing) {
            return $this->fail('Este e-mail já está em uso por outro usuário.', 400);
        }

        $dataToUpdate = [
            'name'  => $name,
            'email' => $email,
            'role'  => $isAdmin ? 'admin' : 'user',
        ];

        if (isset($json['is_active'])) {
            // Prevent admin deactivating their logged in account
            if ($id == $userData->id && (int)$json['is_active'] === 0) {
                return $this->fail('Você não pode desativar sua própria conta de administrador.', 400);
            }
            $dataToUpdate['is_active'] = (int) $json['is_active'];
        }

        if (!empty($password)) {
            $dataToUpdate['password_hash'] = password_hash($password, PASSWORD_BCRYPT);
        }

        $userModel->update($id, $dataToUpdate);

        $updatedUser = $userModel->select('id, name, email, role, is_active, created_at')->find($id);
        if ($updatedUser) {
            $updatedUser['id'] = (int) $updatedUser['id'];
            $updatedUser['is_active'] = (int) $updatedUser['is_active'];
        }

        return $this->respond([
            'status'  => 200,
            'message' => 'Usuário atualizado com sucesso.',
            'data'    => $updatedUser,
        ]);
    }

    public function toggleStatus($id = null)
    {
        $userData = $this->request->userData ?? null;

        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Acesso restrito a administradores.');
        }

        if (!$id) {
            return $this->fail('ID do usuário não informado.', 400);
        }

        if ($id == $userData->id) {
            return $this->fail('Você não pode desativar sua própria conta de administrador.', 400);
        }

        $userModel = new UserModel();
        $user = $userModel->find($id);

        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        $newStatus = (int)$user['is_active'] === 1 ? 0 : 1;
        $userModel->update($id, ['is_active' => $newStatus]);

        return $this->respond([
            'status'  => 200,
            'message' => $newStatus === 1 ? 'Usuário ativado com sucesso.' : 'Usuário desativado com sucesso.',
            'is_active' => $newStatus,
        ]);
    }

    public function delete($id = null)
    {
        $userData = $this->request->userData ?? null;

        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Acesso restrito a administradores.');
        }

        if (!$id) {
            return $this->fail('ID do usuário não informado.', 400);
        }

        if ($id == $userData->id) {
            return $this->fail('Você não pode excluir sua própria conta de administrador.', 400);
        }

        $userModel = new UserModel();
        $user = $userModel->find($id);

        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        $userModel->delete($id);

        return $this->respond([
            'status'  => 200,
            'message' => 'Usuário removido com sucesso.',
        ]);
    }

    /**
     * GET /api/users/(:num)/ai-metrics
     */
    public function aiMetrics($id = null)
    {
        $userData = $this->request->userData ?? null;
        $effectiveUserId = $this->request->effectiveUserId ?? ($userData->id ?? null);
        $isAdmin = (($userData->role ?? 'user') === 'admin');

        if (!$id) {
            return $this->fail('ID do usuário não informado.', 400);
        }

        if (!$isAdmin && (int)$id !== (int)$effectiveUserId) {
            return $this->failForbidden('Acesso não autorizado às métricas de IA de outro usuário.');
        }

        $userModel = new UserModel();
        $user = $userModel->select('id, name, email, role, is_active, ai_enabled, ai_monthly_token_limit, created_at')->find($id);

        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        $user['id'] = (int) $user['id'];
        $user['is_active'] = (int) $user['is_active'];
        $user['ai_enabled'] = isset($user['ai_enabled']) ? (int) $user['ai_enabled'] : 1;
        $user['ai_monthly_token_limit'] = $user['ai_monthly_token_limit'] !== null ? (int) $user['ai_monthly_token_limit'] : null;

        $pricePer1k = (float) \App\Models\SettingsModel::getSetting('ai_token_price_per_1k', '0.00');
        $logModel = new \App\Models\AiUsageLogModel();
        $stats = $logModel->getUserStats((int) $id);
        $monthlyHistory = $logModel->getUserMonthlyHistory((int) $id);

        $currentMonthTokens = $stats['current_month_tokens'] ?? 0;
        $totalTokens = $stats['total_tokens'] ?? 0;
        $currentMonthCost = round(($currentMonthTokens / 1000) * $pricePer1k, 2);
        $totalCost = round(($totalTokens / 1000) * $pricePer1k, 2);

        foreach ($monthlyHistory as &$historyItem) {
            $hTokens = $historyItem['total_tokens'] ?? 0;
            $historyItem['estimated_cost'] = round(($hTokens / 1000) * $pricePer1k, 2);
        }

        return $this->respond([
            'status'             => 200,
            'user'               => $user,
            'metrics'            => $stats,
            'token_price_per_1k' => $pricePer1k,
            'current_month_cost' => $currentMonthCost,
            'total_cost'         => $totalCost,
            'monthly_history'    => $monthlyHistory,
        ]);
    }

    /**
     * PUT /api/users/(:num)/ai-limits
     */
    public function updateAiLimits($id = null)
    {
        $userData = $this->request->userData ?? null;
        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Acesso restrito a administradores.');
        }

        if (!$id) {
            return $this->fail('ID do usuário não informado.', 400);
        }

        $userModel = new UserModel();
        $user = $userModel->find($id);

        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        $json = $this->request->getJSON(true) ?? $this->request->getRawInput();

        $dataToUpdate = [];
        if (isset($json['ai_enabled'])) {
            $dataToUpdate['ai_enabled'] = !empty($json['ai_enabled']) ? 1 : 0;
        }

        if (array_key_exists('ai_monthly_token_limit', $json)) {
            $limit = $json['ai_monthly_token_limit'];
            if ($limit === null || $limit === '' || $limit === 0 || $limit === '0') {
                $dataToUpdate['ai_monthly_token_limit'] = null;
            } else {
                $limitInt = (int) $limit;
                if ($limitInt < 0) {
                    return $this->fail('O limite de tokens deve ser um número positivo ou nulo.', 400);
                }
                $dataToUpdate['ai_monthly_token_limit'] = $limitInt;
            }
        }

        if (!empty($dataToUpdate)) {
            $userModel->update($id, $dataToUpdate);
        }

        $updatedUser = $userModel->select('id, name, email, role, is_active, ai_enabled, ai_monthly_token_limit')->find($id);
        $updatedUser['id'] = (int) $updatedUser['id'];
        $updatedUser['is_active'] = (int) $updatedUser['is_active'];
        $updatedUser['ai_enabled'] = isset($updatedUser['ai_enabled']) ? (int) $updatedUser['ai_enabled'] : 1;
        $updatedUser['ai_monthly_token_limit'] = $updatedUser['ai_monthly_token_limit'] !== null ? (int) $updatedUser['ai_monthly_token_limit'] : null;

        return $this->respond([
            'status'  => 200,
            'message' => 'Configurações de IA do usuário atualizadas com sucesso.',
            'data'    => $updatedUser,
        ]);
    }

    /**
     * GET /api/users/(:num)/ai-logs
     */
    public function aiLogs($id = null)
    {
        $userData = $this->request->userData ?? null;
        $effectiveUserId = $this->request->effectiveUserId ?? ($userData->id ?? null);
        $isAdmin = (($userData->role ?? 'user') === 'admin');

        if (!$id) {
            return $this->fail('ID do usuário não informado.', 400);
        }

        if (!$isAdmin && (int)$id !== (int)$effectiveUserId) {
            return $this->failForbidden('Acesso não autorizado aos logs de IA de outro usuário.');
        }

        $limit = max(1, min(200, (int) ($this->request->getGet('limit') ?: 50)));
        $offset = max(0, (int) ($this->request->getGet('offset') ?: 0));

        $logModel = new \App\Models\AiUsageLogModel();
        $totalLogs = $logModel->where('user_id', (int) $id)->countAllResults();
        $logs = $logModel->getUserLogs((int) $id, $limit, $offset);

        return $this->respond([
            'status'     => 200,
            'data'       => $logs,
            'pagination' => [
                'total'  => $totalLogs,
                'limit'  => $limit,
                'offset' => $offset,
            ],
        ]);
    }
}
