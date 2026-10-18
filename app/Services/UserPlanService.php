<?php

namespace App\Services;

use App\Models\UserModel;
use App\Models\PlanModel;
use App\Models\WebsiteModel;

class UserPlanService
{
    /**
     * Retorna os detalhes completos do plano, add-ons, limites efetivos e valores financeiros do usuário.
     */
    public static function getUserPlanDetails(int $userId): array
    {
        $userModel = new UserModel();
        $user = $userModel->find($userId);

        if (!$user) {
            return [
                'user_id'                    => $userId,
                'plan'                       => null,
                'plan_name'                  => 'Sem Plano',
                'is_admin'                   => false,
                'ai_enabled'                 => 0,
                'base_max_websites'          => 0,
                'extra_websites'             => 0,
                'extra_websites_price'       => 0.00,
                'effective_max_websites'     => 0,
                'is_websites_unlimited'      => false,
                'websites_count'             => 0,
                'shared_websites_count'      => 0,
                'total_websites_managed'     => 0,
                'websites_remaining'         => 0,
                'is_websites_limit_reached'  => true,
                'base_ai_tokens'             => 0,
                'extra_ai_tokens'            => 0,
                'extra_ai_tokens_price'      => 0.00,
                'effective_ai_token_limit'   => 0,
                'base_price'                 => 0.00,
                'total_monthly_price'        => 0.00,
                'custom_price_monthly'       => null,
                'custom_max_websites'        => null,
                'custom_ai_token_limit'      => null,
            ];
        }

        $isAdmin = ($user['role'] ?? 'user') === 'admin';

        // 0. Assinatura Recorrente e Validação do Período de Vigência
        $subModel = new \App\Models\SubscriptionModel();
        $sub = $subModel->where('user_id', $userId)->orderBy('id', 'DESC')->first();

        $subscriptionInfo = null;
        $isSubscriptionActive = false;
        $isSubscriptionCanceled = false;
        $isSubscriptionExpired = false;
        $subscriptionDaysRemaining = 0;

        if ($sub) {
            $status = $sub['status'];
            $periodEnd = !empty($sub['current_period_end']) ? strtotime($sub['current_period_end']) : null;
            $now = time();

            if ($status === 'active') {
                $isSubscriptionActive = true;
                $subscriptionDaysRemaining = $periodEnd ? max(0, (int)ceil(($periodEnd - $now) / 86400)) : 30;
            } elseif ($status === 'canceled') {
                $isSubscriptionCanceled = true;
                // REGRA CRÍTICA: Se o cliente cancelou, ele CONTINUA com acesso ativo até o término do período já pago
                if ($periodEnd && $periodEnd >= $now) {
                    $isSubscriptionActive = true;
                    $subscriptionDaysRemaining = max(0, (int)ceil(($periodEnd - $now) / 86400));
                } else {
                    // O período pago terminou: PERDE O ACESSO
                    $isSubscriptionActive = false;
                    $isSubscriptionExpired = true;
                    $subscriptionDaysRemaining = 0;
                    if ($status !== 'expired') {
                        $subModel->update($sub['id'], ['status' => 'expired']);
                        $sub['status'] = 'expired';
                    }
                }
            } elseif ($status === 'expired') {
                $isSubscriptionActive = false;
                $isSubscriptionExpired = true;
                $subscriptionDaysRemaining = 0;
            }

            $transModel = new \App\Models\PaymentTransactionModel();
            $lastTrans = $transModel->where('subscription_id', $sub['id'])->orderBy('id', 'DESC')->first();
            $paymentMethod = $lastTrans['payment_method'] ?? 'credit_card';

            $subscriptionInfo = [
                'id'                      => (int)$sub['id'],
                'plan_id'                 => (int)$sub['plan_id'],
                'status'                  => $sub['status'],
                'gateway'                 => $sub['gateway'],
                'gateway_subscription_id' => $sub['gateway_subscription_id'],
                'payment_method'          => $paymentMethod,
                'billing_cycle'           => $sub['billing_cycle'],
                'price'                   => (float)$sub['price'],
                'extra_websites'          => (int)$sub['extra_websites'],
                'extra_websites_price'    => (float)$sub['extra_websites_price'],
                'extra_ai_tokens'         => (int)$sub['extra_ai_tokens'],
                'extra_ai_tokens_price'   => (float)$sub['extra_ai_tokens_price'],
                'current_period_start'    => $sub['current_period_start'],
                'current_period_end'      => $sub['current_period_end'],
                'canceled_at'             => $sub['canceled_at'],
                'created_at'              => $sub['created_at'] ?? null,
                'is_period_active'        => $isSubscriptionActive,
                'days_remaining'          => $subscriptionDaysRemaining,
                'can_cancel'              => ($sub['status'] === 'active'),
            ];
        }

        $planModel = new PlanModel();
        $plan = null;

        if (!$isAdmin && $isSubscriptionExpired) {
            // Perdeu o acesso após encerramento do período pago
            $plan = null;
        } else {
            $effectivePlanId = !empty($user['plan_id']) ? $user['plan_id'] : ($sub['plan_id'] ?? null);
            if ($effectivePlanId) {
                $plan = $planModel->find($effectivePlanId);
            }
            if (!$plan && !$isAdmin && !$sub) {
                $plan = $planModel->getDefaultPlan();
            }
        }

        $websiteModel = new WebsiteModel();
        $websitesCount = $websiteModel->where('user_id', $userId)->countAllResults();
        $sharedWebsitesCount = (int) (new \App\Models\WebsiteShareModel())->where('user_id', $userId)->countAllResults();

        // 1. Limite Efetivo de Websites
        $baseMaxWebsites = $plan ? ($plan['max_websites'] !== null ? (int)$plan['max_websites'] : null) : null;
        $extraWebsites = (int)($user['extra_websites'] ?? ($sub['extra_websites'] ?? 0));
        $extraWebsitesPrice = (float)($user['extra_websites_price'] ?? ($sub['extra_websites_price'] ?? 0.00));
        $customMaxWebsites = array_key_exists('custom_max_websites', $user) && $user['custom_max_websites'] !== null
            ? (int)$user['custom_max_websites']
            : null;

        if ($isAdmin) {
            // Administradores não têm trava de sites
            $effectiveMaxWebsites = null;
            $isWebsitesUnlimited = true;
            $isWebsitesLimitReached = false;
            $websitesRemaining = null;
        } elseif ($isSubscriptionExpired) {
            // Assinatura expirou: limites zerados/bloqueados
            $effectiveMaxWebsites = 0;
            $isWebsitesUnlimited = false;
            $isWebsitesLimitReached = true;
            $websitesRemaining = 0;
        } elseif ($customMaxWebsites !== null) {
            $effectiveMaxWebsites = $customMaxWebsites;
            $isWebsitesUnlimited = false;
            $websitesRemaining = max(0, $effectiveMaxWebsites - $websitesCount);
            $isWebsitesLimitReached = ($websitesCount >= $effectiveMaxWebsites);
        } elseif ($plan) {
            if ($baseMaxWebsites === null) {
                $effectiveMaxWebsites = null;
                $isWebsitesUnlimited = true;
                $websitesRemaining = null;
                $isWebsitesLimitReached = false;
            } else {
                $effectiveMaxWebsites = $baseMaxWebsites + $extraWebsites;
                $isWebsitesUnlimited = false;
                $websitesRemaining = max(0, $effectiveMaxWebsites - $websitesCount);
                $isWebsitesLimitReached = ($websitesCount >= $effectiveMaxWebsites);
            }
        } else {
            // Sem plano
            $effectiveMaxWebsites = 0;
            $isWebsitesUnlimited = false;
            $websitesRemaining = 0;
            $isWebsitesLimitReached = true;
        }

        // 2. Limite Efetivo de Tokens de IA Mensais (sempre estrito e finito)
        $aiEnabled = isset($user['ai_enabled']) ? (int)$user['ai_enabled'] : 1;
        $baseAiTokens = $plan ? (int)$plan['ai_monthly_tokens'] : 250000;
        $extraAiTokens = (int)($user['extra_ai_tokens'] ?? ($sub['extra_ai_tokens'] ?? 0));
        $extraAiTokensPrice = (float)($user['extra_ai_tokens_price'] ?? ($sub['extra_ai_tokens_price'] ?? 0.00));
        $customAiTokenLimit = array_key_exists('custom_ai_token_limit', $user) && $user['custom_ai_token_limit'] !== null
            ? (int)$user['custom_ai_token_limit']
            : null;

        $legacyAiLimit = isset($user['ai_monthly_token_limit']) && $user['ai_monthly_token_limit'] !== null
            ? (int)$user['ai_monthly_token_limit']
            : null;

        if ($isAdmin) {
            $aiEnabled = 1;
            $effectiveAiTokenLimit = 10000000;
        } elseif ($isSubscriptionExpired) {
            // Assinatura expirou: IA desabilitada
            $aiEnabled = 0;
            $effectiveAiTokenLimit = 0;
        } elseif ($aiEnabled === 0) {
            $effectiveAiTokenLimit = 0;
        } elseif ($customAiTokenLimit !== null) {
            $effectiveAiTokenLimit = $customAiTokenLimit;
        } elseif ($plan) {
            $effectiveAiTokenLimit = $baseAiTokens + $extraAiTokens;
        } elseif ($legacyAiLimit !== null) {
            $effectiveAiTokenLimit = $legacyAiLimit;
        } else {
            $effectiveAiTokenLimit = 0;
        }

        // 3. Financeiro (Mensalidade)
        $basePrice = $plan ? (float)$plan['price_monthly'] : ($sub ? (float)$sub['price'] : 0.00);
        $customPriceMonthly = array_key_exists('custom_price_monthly', $user) && $user['custom_price_monthly'] !== null
            ? (float)$user['custom_price_monthly']
            : null;

        if ($customPriceMonthly !== null) {
            $totalMonthlyPrice = $customPriceMonthly;
        } else {
            $totalMonthlyPrice = round($basePrice + $extraWebsitesPrice + $extraAiTokensPrice, 2);
        }

        $planName = $isAdmin
            ? 'Administrador'
            : ($isSubscriptionExpired
                ? 'Assinatura Expirada'
                : ($plan ? $plan['name'] : 'Sem Plano'));

        return [
            'user_id'                   => (int)$user['id'],
            'user_name'                 => $user['name'],
            'user_email'                => $user['email'],
            'is_admin'                  => $isAdmin,
            'plan_id'                   => $plan ? (int)$plan['id'] : null,
            'plan'                      => $plan,
            'plan_name'                 => $planName,
            'ai_enabled'                => $aiEnabled,
            'base_max_websites'         => $baseMaxWebsites,
            'extra_websites'            => $extraWebsites,
            'extra_websites_price'      => $extraWebsitesPrice,
            'custom_max_websites'       => $customMaxWebsites,
            'effective_max_websites'    => $effectiveMaxWebsites,
            'is_websites_unlimited'     => $isWebsitesUnlimited,
            'websites_count'            => $websitesCount,
            'shared_websites_count'     => $sharedWebsitesCount,
            'total_websites_managed'    => $websitesCount + $sharedWebsitesCount,
            'websites_remaining'        => $websitesRemaining,
            'is_websites_limit_reached' => $isWebsitesLimitReached,
            'base_ai_tokens'            => $baseAiTokens,
            'extra_ai_tokens'           => $extraAiTokens,
            'extra_ai_tokens_price'     => $extraAiTokensPrice,
            'custom_ai_token_limit'     => $customAiTokenLimit,
            'effective_ai_token_limit'  => $effectiveAiTokenLimit,
            'base_price'                => $basePrice,
            'custom_price_monthly'      => $customPriceMonthly,
            'total_monthly_price'       => $totalMonthlyPrice,
            'subscription'              => $subscriptionInfo,
            'user_created_at'           => $user['created_at'] ?? null,
            'is_subscription_active'    => $isSubscriptionActive,
            'is_subscription_canceled'  => $isSubscriptionCanceled,
            'is_subscription_expired'   => $isSubscriptionExpired,
        ];
    }

    /**
     * Retorna apenas o limite efetivo de websites do usuário (null = ilimitado)
     */
    public static function getEffectiveWebsiteLimit(int $userId): ?int
    {
        $details = self::getUserPlanDetails($userId);
        return $details['effective_max_websites'];
    }

    /**
     * Retorna o limite efetivo mensal de tokens de IA
     */
    public static function getEffectiveAiTokenLimit(int $userId): int
    {
        $details = self::getUserPlanDetails($userId);
        return (int)$details['effective_ai_token_limit'];
    }

    /**
     * Valida se o usuário pode adicionar um novo website
     */
    public static function canUserAddWebsite(int $userId): array
    {
        $details = self::getUserPlanDetails($userId);

        if ($details['is_admin']) {
            return ['allowed' => true, 'current' => $details['websites_count'], 'limit' => null];
        }

        if (!empty($details['is_subscription_expired'])) {
            return [
                'allowed' => false,
                'reason'  => 'Sua assinatura expirou. Renove seu plano para voltar a adicionar e gerenciar websites.',
                'current' => $details['websites_count'],
                'limit'   => 0,
            ];
        }

        if ($details['is_websites_unlimited']) {
            return ['allowed' => true, 'current' => $details['websites_count'], 'limit' => null];
        }

        if ($details['is_websites_limit_reached']) {
            return [
                'allowed' => false,
                'reason'  => "Limite de sites do plano atingido ({$details['websites_count']}/{$details['effective_max_websites']} sites). Faça upgrade ou contrate sites adicionais.",
                'current' => $details['websites_count'],
                'limit'   => $details['effective_max_websites'],
            ];
        }

        return [
            'allowed' => true,
            'current' => $details['websites_count'],
            'limit'   => $details['effective_max_websites'],
        ];
    }

    /**
     * Atribui ou atualiza o plano de um usuário, resetando overrides e garantindo ativação da conta
     */
    public static function assignPlanToUser(int $userId, int $planId, array $addons = []): bool
    {
        $userModel = new UserModel();
        $user = $userModel->find($userId);
        if (!$user) {
            return false;
        }

        $planModel = new PlanModel();
        $plan = $planModel->find($planId);
        if (!$plan) {
            return false;
        }

        $dataToUpdate = [
            'plan_id'               => $planId,
            'is_active'             => 1,
            'extra_websites'        => max(0, (int)($addons['extra_websites'] ?? 0)),
            'extra_websites_price'  => max(0, (float)($addons['extra_websites_price'] ?? 0.00)),
            'extra_ai_tokens'       => max(0, (int)($addons['extra_ai_tokens'] ?? 0)),
            'extra_ai_tokens_price' => max(0, (float)($addons['extra_ai_tokens_price'] ?? 0.00)),
            'custom_price_monthly'  => null,
            'custom_max_websites'   => null,
            'custom_ai_token_limit' => null,
        ];

        return (bool)$userModel->update($userId, $dataToUpdate);
    }
}
