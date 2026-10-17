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

        $planModel = new PlanModel();
        $plan = !empty($user['plan_id']) ? $planModel->find($user['plan_id']) : null;

        // Se o usuário não tem plano e não é admin, tenta buscar o plano padrão
        if (!$plan && !$isAdmin) {
            $plan = $planModel->getDefaultPlan();
        }

        $websiteModel = new WebsiteModel();
        $websitesCount = $websiteModel->where('user_id', $userId)->countAllResults();
        $sharedWebsitesCount = (int) (new \App\Models\WebsiteShareModel())->where('user_id', $userId)->countAllResults();

        // 1. Limite Efetivo de Websites
        $baseMaxWebsites = $plan ? ($plan['max_websites'] !== null ? (int)$plan['max_websites'] : null) : null;
        $extraWebsites = (int)($user['extra_websites'] ?? 0);
        $extraWebsitesPrice = (float)($user['extra_websites_price'] ?? 0.00);
        $customMaxWebsites = array_key_exists('custom_max_websites', $user) && $user['custom_max_websites'] !== null
            ? (int)$user['custom_max_websites']
            : null;

        if ($isAdmin) {
            // Administradores não têm trava de sites
            $effectiveMaxWebsites = null;
            $isWebsitesUnlimited = true;
        } elseif ($customMaxWebsites !== null) {
            $effectiveMaxWebsites = $customMaxWebsites;
            $isWebsitesUnlimited = false;
        } elseif ($plan) {
            if ($baseMaxWebsites === null) {
                $effectiveMaxWebsites = null;
                $isWebsitesUnlimited = true;
            } else {
                $effectiveMaxWebsites = $baseMaxWebsites + $extraWebsites;
                $isWebsitesUnlimited = false;
            }
        } else {
            // Fallback sem plano
            $effectiveMaxWebsites = 1;
            $isWebsitesUnlimited = false;
        }

        $websitesRemaining = $effectiveMaxWebsites !== null ? max(0, $effectiveMaxWebsites - $websitesCount) : null;
        $isWebsitesLimitReached = !$isAdmin && ($effectiveMaxWebsites !== null && $websitesCount >= $effectiveMaxWebsites);

        // 2. Limite Efetivo de Tokens de IA Mensais (sempre estrito e finito)
        $aiEnabled = isset($user['ai_enabled']) ? (int)$user['ai_enabled'] : 1;
        $baseAiTokens = $plan ? (int)$plan['ai_monthly_tokens'] : 250000;
        $extraAiTokens = (int)($user['extra_ai_tokens'] ?? 0);
        $extraAiTokensPrice = (float)($user['extra_ai_tokens_price'] ?? 0.00);
        $customAiTokenLimit = array_key_exists('custom_ai_token_limit', $user) && $user['custom_ai_token_limit'] !== null
            ? (int)$user['custom_ai_token_limit']
            : null;

        // Suporte a legado ai_monthly_token_limit caso ainda não tenha sido migrado
        $legacyAiLimit = isset($user['ai_monthly_token_limit']) && $user['ai_monthly_token_limit'] !== null
            ? (int)$user['ai_monthly_token_limit']
            : null;

        if ($aiEnabled === 0) {
            $effectiveAiTokenLimit = 0;
        } elseif ($customAiTokenLimit !== null) {
            $effectiveAiTokenLimit = $customAiTokenLimit;
        } elseif ($plan) {
            $effectiveAiTokenLimit = $baseAiTokens + $extraAiTokens;
        } elseif ($legacyAiLimit !== null) {
            $effectiveAiTokenLimit = $legacyAiLimit;
        } else {
            $effectiveAiTokenLimit = 250000; // padrão
        }

        // 3. Financeiro (Mensalidade)
        $basePrice = $plan ? (float)$plan['price_monthly'] : 0.00;
        $customPriceMonthly = array_key_exists('custom_price_monthly', $user) && $user['custom_price_monthly'] !== null
            ? (float)$user['custom_price_monthly']
            : null;

        if ($customPriceMonthly !== null) {
            $totalMonthlyPrice = $customPriceMonthly;
        } else {
            $totalMonthlyPrice = round($basePrice + $extraWebsitesPrice + $extraAiTokensPrice, 2);
        }

        return [
            'user_id'                   => (int)$user['id'],
            'user_name'                 => $user['name'],
            'user_email'                => $user['email'],
            'is_admin'                  => $isAdmin,
            'plan_id'                   => $plan ? (int)$plan['id'] : null,
            'plan'                      => $plan,
            'plan_name'                 => $plan ? $plan['name'] : 'Sem Plano',
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
