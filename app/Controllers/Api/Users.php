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
            ->select('id, name, email, role, plan_id, is_active, ai_enabled, ai_monthly_token_limit, account_status, deletion_requested_at, deletion_scheduled_at, purged_at, created_at')
            ->orderBy('created_at', 'DESC')
            ->findAll();

        $tokenPrice = (float) \App\Models\SettingsModel::getSetting('ai_token_price_per_1k', '0.00');
        $aiLogModel = new \App\Models\AiUsageLogModel();
        foreach ($users as &$user) {
            $user['id'] = (int) $user['id'];
            $user['is_active'] = (int) $user['is_active'];
            $planDetails = \App\Services\UserPlanService::getUserPlanDetails($user['id']);
            $user['plan_id']                = $planDetails['plan_id'];
            $user['plan_name']              = $planDetails['plan_name'];
            $user['effective_max_websites'] = $planDetails['effective_max_websites'];
            $user['is_websites_unlimited']  = $planDetails['is_websites_unlimited'];
            $user['websites_count']         = $planDetails['websites_count'];
            $user['total_monthly_price']    = $planDetails['total_monthly_price'];
            $user['ai_enabled']             = $planDetails['ai_enabled'];
            $user['ai_monthly_token_limit'] = $planDetails['effective_ai_token_limit'];
            $user['current_month_tokens']   = $aiLogModel->getUserMonthlyTokens($user['id']);
            $user['current_month_cost']     = round(($user['current_month_tokens'] / 1000) * $tokenPrice, 2);
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
        $planId = isset($json['plan_id']) && $json['plan_id'] !== '' ? (int)$json['plan_id'] : null;
        if (!$planId && !$isAdmin) {
            $defaultPlan = (new \App\Models\PlanModel())->getDefaultPlan();
            $planId = $defaultPlan ? (int)$defaultPlan['id'] : null;
        }

        $newId = $userModel->insert([
            'name'          => $name,
            'email'         => $email,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
            'role'          => $role,
            'plan_id'       => $planId,
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

        // Cancelar assinaturas ativas no Asaas
        $subModel = new \App\Models\SubscriptionModel();
        $activeSubs = $subModel->where('user_id', $user['id'])
                               ->where('status', 'active')
                               ->findAll();
        $asaasService = new \App\Services\AsaasService();
        foreach ($activeSubs as $sub) {
            if (!empty($sub['gateway_subscription_id']) && ($sub['gateway'] ?? '') === 'asaas') {
                try {
                    $asaasService->cancelSubscription($sub['gateway_subscription_id']);
                } catch (\Throwable $e) {
                    log_message('error', "[Users::delete] Erro ao cancelar no Asaas: " . $e->getMessage());
                }
            }
            $subModel->update($sub['id'], [
                'status'      => 'canceled',
                'canceled_at' => date('Y-m-d H:i:s'),
            ]);
        }

        // Desconectar sites
        $websiteModel = new \App\Models\WebsiteModel();
        $websites = $websiteModel->where('user_id', $user['id'])->findAll();
        $sitesCount = count($websites);
        if (!empty($websites)) {
            $websiteModel->where('user_id', $user['id'])->set([
                'is_active'     => 0,
                'is_connected'  => 0,
                'agent_status'  => 'disconnected',
            ])->update();
        }

        // Agendar exclusão com carência de 90 dias sem apagar registros de IA e pagamentos
        $scheduledAt = date('Y-m-d H:i:s', strtotime('+90 days'));
        $userModel->update($id, [
            'account_status'        => 'pending_deletion',
            'deletion_requested_at' => date('Y-m-d H:i:s'),
            'deletion_scheduled_at' => $scheduledAt,
            'previous_plan_id'      => $user['plan_id'] ?? null,
            'previous_sites_count'  => $sitesCount,
            'is_active'             => 0,
        ]);

        return $this->respond([
            'status'       => 200,
            'message'      => 'Conta colocada em período de carência de 90 dias (exclusão agendada). Sites desconectados e faturas canceladas. Histórico de IA e pagamentos preservados com segurança.',
            'scheduled_at' => $scheduledAt,
        ]);
    }

    /**
     * POST /api/users/request-deletion
     * O próprio usuário solicita a exclusão da sua conta confirmando com sua senha
     */
    public function requestDeletion()
    {
        $userData = $this->request->userData ?? null;
        if (!$userData || empty($userData->id)) {
            return $this->failUnauthorized('Usuário não autenticado.');
        }

        if (($userData->role ?? '') === 'admin') {
            return $this->fail('Contas de administrador não podem ser autoexcluídas pelo painel.', 400);
        }

        $json = $this->request->getJSON(true) ?? $this->request->getPost();
        $password = trim($json['password'] ?? '');

        if (empty($password)) {
            return $this->fail('Informe sua senha atual para confirmar a exclusão da conta.', 400);
        }

        $userModel = new UserModel();
        $user = $userModel->find($userData->id);
        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        // Confirmação obrigatória por senha
        if (!password_verify($password, $user['password_hash'])) {
            return $this->fail('Senha incorreta. Não foi possível confirmar a exclusão da sua conta.', 400);
        }

        // 1. Cancelar assinaturas ativas no Asaas
        $subModel = new \App\Models\SubscriptionModel();
        $activeSubs = $subModel->where('user_id', $user['id'])
                               ->where('status', 'active')
                               ->findAll();
        $asaasService = new \App\Services\AsaasService();
        foreach ($activeSubs as $sub) {
            if (!empty($sub['gateway_subscription_id']) && ($sub['gateway'] ?? '') === 'asaas') {
                try {
                    $asaasService->cancelSubscription($sub['gateway_subscription_id']);
                } catch (\Throwable $e) {
                    log_message('error', "[Users::requestDeletion] Erro ao cancelar no Asaas: " . $e->getMessage());
                }
            }
            $subModel->update($sub['id'], [
                'status'      => 'canceled',
                'canceled_at' => date('Y-m-d H:i:s'),
            ]);
        }

        // 2. Desconectar e pausar sites
        $websiteModel = new \App\Models\WebsiteModel();
        $websites = $websiteModel->where('user_id', $user['id'])->findAll();
        $sitesCount = count($websites);
        if (!empty($websites)) {
            $websiteModel->where('user_id', $user['id'])->set([
                'is_active'     => 0,
                'is_connected'  => 0,
                'agent_status'  => 'disconnected',
            ])->update();
        }

        // 3. Atualizar usuário com carência de 90 dias
        $scheduledAt = date('Y-m-d H:i:s', strtotime('+90 days'));
        $userModel->update($user['id'], [
            'account_status'        => 'pending_deletion',
            'deletion_requested_at' => date('Y-m-d H:i:s'),
            'deletion_scheduled_at' => $scheduledAt,
            'previous_plan_id'      => $user['plan_id'] ?? null,
            'previous_sites_count'  => $sitesCount,
            'is_active'             => 0,
        ]);

        $formattedScheduled = date('d/m/Y', strtotime('+90 days'));

        // Registrar no log da plataforma
        try {
            $logModel = new \App\Models\PlatformErrorLogModel();
            $logModel->logError([
                'error_type'    => 'audit_notice',
                'severity'      => 'warning',
                'user_id'       => $user['id'],
                'error_message' => "Usuário {$user['email']} (#{$user['id']}) solicitou a exclusão da conta com confirmação por senha. Carência de 90 dias agendada até {$formattedScheduled}. Sites desconectados e faturas suspensas.",
            ]);
        } catch (\Throwable $e) {
            // ignore
        }

        return $this->respond([
            'status'       => 200,
            'message'      => "Sua conta entrou em período de carência de 90 dias (até {$formattedScheduled}). Nenhuma cobrança futura será realizada e seus sites foram desconectados. Se você mudar de ideia, basta fazer login dentro deste período para reativar sua conta.",
            'scheduled_at' => $scheduledAt,
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

        $basePrice       = (float) \App\Models\SettingsModel::getSetting('ai_token_price_per_1k', '0.00');
        $promptPrice     = (float) \App\Models\SettingsModel::getSetting('ai_prompt_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');
        $completionPrice = (float) \App\Models\SettingsModel::getSetting('ai_completion_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');

        $logModel       = new \App\Models\AiUsageLogModel();
        $stats          = $logModel->getUserStats((int) $id);
        $monthStats     = $logModel->getUserMonthlyTokenStats((int) $id);
        $monthlyHistory = $logModel->getUserMonthlyHistory((int) $id);

        $currentMonthCost = round((($monthStats['prompt_tokens'] / 1000) * $promptPrice) + (($monthStats['completion_tokens'] / 1000) * $completionPrice), 2);
        $totalCost        = round((($stats['total_prompt_tokens'] / 1000) * $promptPrice) + (($stats['total_completion_tokens'] / 1000) * $completionPrice), 2);

        foreach ($monthlyHistory as &$historyItem) {
            $pTokens = (int) ($historyItem['prompt_tokens'] ?? 0);
            $cTokens = (int) ($historyItem['completion_tokens'] ?? 0);
            $historyItem['estimated_cost'] = round((($pTokens / 1000) * $promptPrice) + (($cTokens / 1000) * $completionPrice), 2);
        }

        return $this->respond([
            'status'                        => 200,
            'user'                          => $user,
            'metrics'                       => $stats,
            'token_price_per_1k'            => $basePrice,
            'prompt_token_price_per_1k'     => $promptPrice,
            'completion_token_price_per_1k' => $completionPrice,
            'current_month_cost'            => $currentMonthCost,
            'total_cost'                    => $totalCost,
            'monthly_history'               => $monthlyHistory,
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

    /**
     * GET /api/users/(:num)/plan
     * Retorna detalhes completos do plano, add-ons, sites e histórico de IA
     */
    public function planDetails($id = null)
    {
        $userData = $this->request->userData ?? null;
        $effectiveUserId = $this->request->effectiveUserId ?? ($userData->id ?? null);
        $isAdmin = (($userData->role ?? 'user') === 'admin');

        if (!$id) {
            return $this->fail('ID do usuário não informado.', 400);
        }

        if (!$isAdmin && (int)$id !== (int)$effectiveUserId) {
            return $this->failForbidden('Acesso não autorizado aos dados de plano de outro usuário.');
        }

        $userModel = new UserModel();
        $user = $userModel->find($id);

        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        $planDetails = \App\Services\UserPlanService::getUserPlanDetails((int)$id);

        $basePrice       = (float) \App\Models\SettingsModel::getSetting('ai_token_price_per_1k', '0.00');
        $promptPrice     = (float) \App\Models\SettingsModel::getSetting('ai_prompt_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');
        $completionPrice = (float) \App\Models\SettingsModel::getSetting('ai_completion_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');

        $logModel       = new \App\Models\AiUsageLogModel();
        $stats          = $logModel->getUserStats((int) $id);
        $monthStats     = $logModel->getUserMonthlyTokenStats((int) $id);
        $monthlyHistory = $logModel->getUserMonthlyHistory((int) $id);

        $currentMonthCost = round((($monthStats['prompt_tokens'] / 1000) * $promptPrice) + (($monthStats['completion_tokens'] / 1000) * $completionPrice), 2);
        $totalCost        = round((($stats['total_prompt_tokens'] / 1000) * $promptPrice) + (($stats['total_completion_tokens'] / 1000) * $completionPrice), 2);

        foreach ($monthlyHistory as &$historyItem) {
            $pTokens = (int) ($historyItem['prompt_tokens'] ?? 0);
            $cTokens = (int) ($historyItem['completion_tokens'] ?? 0);
            $historyItem['estimated_cost'] = round((($pTokens / 1000) * $promptPrice) + (($cTokens / 1000) * $completionPrice), 2);
        }

        // Websites do usuário
        $websiteModel = new \App\Models\WebsiteModel();
        $userWebsites = $websiteModel
            ->select('id, name, url, environment, is_connected, created_at')
            ->where('user_id', (int)$id)
            ->orderBy('name', 'ASC')
            ->findAll();

        foreach ($userWebsites as &$w) {
            $w['id'] = (int)$w['id'];
            $w['is_connected'] = (int)$w['is_connected'];
        }

        // Catálogo de planos disponíveis para o admin selecionar
        $planModel = new \App\Models\PlanModel();
        $availablePlans = $planModel->where('is_active', 1)->orderBy('sort_order', 'ASC')->findAll();
        foreach ($availablePlans as &$p) {
            $p['id'] = (int)$p['id'];
            $p['max_websites'] = $p['max_websites'] !== null ? (int)$p['max_websites'] : null;
            $p['ai_monthly_tokens'] = (int)$p['ai_monthly_tokens'];
            $p['price_monthly'] = (float)$p['price_monthly'];
        }

        return $this->respond([
            'status'                        => 200,
            'plan_details'                  => $planDetails,
            'subscription'                  => $planDetails['subscription'] ?? null,
            'available_plans'               => $availablePlans,
            'websites'                      => $userWebsites,
            'metrics'                       => $stats,
            'month_stats'                   => $monthStats,
            'token_price_per_1k'            => $basePrice,
            'prompt_token_price_per_1k'     => $promptPrice,
            'completion_token_price_per_1k' => $completionPrice,
            'current_month_cost'            => $currentMonthCost,
            'total_cost'                    => $totalCost,
            'monthly_history'               => $monthlyHistory,
        ]);
    }

    /**
     * PUT /api/users/(:num)/plan
     * Atualiza o plano, add-ons (sites + IA com valores extras) e limites do usuário
     */
    public function updatePlan($id = null)
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

        // 1. Plano Base
        if (array_key_exists('plan_id', $json)) {
            $dataToUpdate['plan_id'] = (!empty($json['plan_id']) && $json['plan_id'] !== 'custom') ? (int)$json['plan_id'] : null;
        }

        // 2. Add-ons de Websites
        if (array_key_exists('extra_websites', $json)) {
            $dataToUpdate['extra_websites'] = max(0, (int)$json['extra_websites']);
        }
        if (array_key_exists('extra_websites_price', $json)) {
            $dataToUpdate['extra_websites_price'] = max(0, (float)$json['extra_websites_price']);
        }

        // 3. Add-ons de IA
        if (array_key_exists('extra_ai_tokens', $json)) {
            $dataToUpdate['extra_ai_tokens'] = max(0, (int)$json['extra_ai_tokens']);
        }
        if (array_key_exists('extra_ai_tokens_price', $json)) {
            $dataToUpdate['extra_ai_tokens_price'] = max(0, (float)$json['extra_ai_tokens_price']);
        }

        // 4. Overrides / Modo Personalizado
        if (array_key_exists('custom_price_monthly', $json)) {
            $val = $json['custom_price_monthly'];
            $dataToUpdate['custom_price_monthly'] = ($val !== null && $val !== '') ? max(0, (float)$val) : null;
        }
        if (array_key_exists('custom_max_websites', $json)) {
            $val = $json['custom_max_websites'];
            $dataToUpdate['custom_max_websites'] = ($val !== null && $val !== '' && $val !== 'unlimited') ? max(1, (int)$val) : null;
        }
        if (array_key_exists('custom_ai_token_limit', $json)) {
            $val = $json['custom_ai_token_limit'];
            $dataToUpdate['custom_ai_token_limit'] = ($val !== null && $val !== '') ? max(0, (int)$val) : null;
            // Sincronizar com ai_monthly_token_limit legado
            $dataToUpdate['ai_monthly_token_limit'] = $dataToUpdate['custom_ai_token_limit'];
        }

        // 5. IA Enabled Toggle
        if (isset($json['ai_enabled'])) {
            $dataToUpdate['ai_enabled'] = !empty($json['ai_enabled']) ? 1 : 0;
        }

        if (!empty($dataToUpdate)) {
            $userModel->update($id, $dataToUpdate);
        }

        $details = \App\Services\UserPlanService::getUserPlanDetails((int)$id);

        return $this->respond([
            'status'  => 200,
            'message' => 'Plano e limites do usuário atualizados com sucesso.',
            'data'    => $details,
        ]);
    }
}
