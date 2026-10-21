<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\UserModel;
use App\Libraries\JWTAuth;
use App\Models\WebsiteModel;
use App\Models\PlanModel;
use App\Models\SubscriptionModel;

class Auth extends ResourceController
{
    protected $format = 'json';

    public function login()
    {
        $json = $this->request->getJSON(true) ?? $this->request->getPost();

        $email    = $json['email'] ?? '';
        $password = $json['password'] ?? '';

        if (empty($email) || empty($password)) {
            return $this->fail('Email e senha são obrigatórios.', 400);
        }

        $userModel = new UserModel();
        $user = $userModel->where('email', $email)->first();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            return $this->failUnauthorized('Credenciais inválidas.');
        }

        $accountStatus = $user['account_status'] ?? 'active';

        // 1. Caso a conta esteja em período de carência (90 dias)
        if ($accountStatus === 'pending_deletion') {
            $scheduledAt = $user['deletion_scheduled_at'] ?? date('Y-m-d H:i:s', strtotime('+90 days'));
            $now = time();
            $scheduledTime = strtotime($scheduledAt);
            $daysRemaining = max(0, (int) ceil(($scheduledTime - $now) / 86400));

            $websiteModel = new WebsiteModel();
            $sitesCount = $websiteModel->where('user_id', $user['id'])->countAllResults();

            $planId = $user['previous_plan_id'] ?? $user['plan_id'] ?? 1;
            $planModel = new PlanModel();
            $plan = $planModel->find($planId);

            // Gera token temporário de reativação válido por 2 horas
            $reactivationToken = JWTAuth::generateToken($user, 7200);

            return $this->respond([
                'status'             => 200,
                'needs_reactivation' => true,
                'account_status'     => 'pending_deletion',
                'message'            => "Sua conta está em processo de exclusão (período de carência de 90 dias). Restam {$daysRemaining} dias para a exclusão definitiva dos dados dos seus sites.",
                'days_remaining'     => $daysRemaining,
                'scheduled_at'       => $scheduledAt,
                'reactivation_token' => $reactivationToken,
                'user'               => [
                    'id'          => (int) $user['id'],
                    'name'        => $user['name'],
                    'email'       => $user['email'],
                    'role'        => $user['role'] ?? 'user',
                    'plan_id'     => (int) $planId,
                    'sites_count' => $sitesCount,
                ],
                'plan'               => $plan,
            ]);
        }

        // 2. Caso a conta tenha sido purgada após 90 dias
        if ($accountStatus === 'purged') {
            return $this->failUnauthorized('Esta conta foi excluída após o término da carência de 90 dias. Você pode contratar um novo plano utilizando este mesmo e-mail na página inicial.');
        }

        // 3. Caso a conta esteja desativada administrativamente
        if (isset($user['is_active']) && (int)$user['is_active'] === 0) {
            return $this->failUnauthorized('Sua conta está desativada. Entre em contato com o administrador.');
        }

        $token = JWTAuth::generateToken($user);

        return $this->respond([
            'status'  => 200,
            'message' => 'Login realizado com sucesso.',
            'token'   => $token,
            'user'    => [
                'id'    => $user['id'],
                'name'  => $user['name'],
                'email' => $user['email'],
                'role'  => $user['role'] ?? 'user',
            ]
        ]);
    }

    /**
     * POST /api/auth/reactivate-account
     * Permite reativar uma conta em carência de 90 dias
     */
    public function reactivateAccount()
    {
        $json = $this->request->getJSON(true) ?? $this->request->getPost();
        $token = $json['reactivation_token'] ?? '';
        $email = $json['email'] ?? '';
        $password = $json['password'] ?? '';

        $userModel = new UserModel();
        $user = null;

        if (!empty($token)) {
            $decoded = JWTAuth::validateToken($token);
            if ($decoded && !empty($decoded->id)) {
                $user = $userModel->find($decoded->id);
            }
        }

        if (!$user && !empty($email) && !empty($password)) {
            $candidate = $userModel->where('email', $email)->first();
            if ($candidate && password_verify($password, $candidate['password_hash'])) {
                $user = $candidate;
            }
        }

        if (!$user) {
            return $this->failUnauthorized('Sessão de reativação inválida ou expirada. Por favor, faça login novamente.');
        }

        if (($user['account_status'] ?? 'active') !== 'pending_deletion') {
            return $this->fail('Esta conta não se encontra em período de carência.', 400);
        }

        $planId = $user['previous_plan_id'] ?? $user['plan_id'] ?? 1;
        $planModel = new PlanModel();
        $plan = $planModel->find($planId);
        $planPrice = (float)($plan['price_monthly'] ?? 0);

        // 1. Reativar o status da conta do usuário
        $userModel->update($user['id'], [
            'account_status'        => 'active',
            'is_active'             => 1,
            'deletion_requested_at' => null,
            'deletion_scheduled_at' => null,
            'purged_at'              => null,
        ]);

        // 2. Reativar os sites do usuário
        $websiteModel = new WebsiteModel();
        $websiteModel->where('user_id', $user['id'])->set([
            'is_active' => 1,
        ])->update();

        // 3. Se for plano gratuito, reativa a assinatura localmente
        if ($planPrice <= 0) {
            $subModel = new SubscriptionModel();
            $sub = $subModel->where('user_id', $user['id'])->orderBy('id', 'DESC')->first();
            if ($sub) {
                $subModel->update($sub['id'], [
                    'status'      => 'active',
                    'canceled_at' => null,
                ]);
            }
        }

        // Registrar no log da plataforma
        try {
            $logModel = new \App\Models\PlatformErrorLogModel();
            $logModel->logError([
                'error_type'    => 'audit_notice',
                'severity'      => 'info',
                'user_id'       => $user['id'],
                'error_message' => "Conta do usuário {$user['email']} (#{$user['id']}) foi reativada com sucesso dentro do período de carência de 90 dias.",
            ]);
        } catch (\Throwable $e) {
            // ignore
        }

        $freshUser = $userModel->find($user['id']);
        $jwtToken = JWTAuth::generateToken($freshUser);

        return $this->respond([
            'status'  => 200,
            'message' => 'Conta reativada com sucesso! Bem-vindo de volta.',
            'token'   => $jwtToken,
            'user'    => [
                'id'    => (int) $freshUser['id'],
                'name'  => $freshUser['name'],
                'email' => $freshUser['email'],
                'role'  => $freshUser['role'] ?? 'user',
            ]
        ]);
    }
}
