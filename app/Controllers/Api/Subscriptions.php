<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\SubscriptionModel;
use App\Models\UserModel;
use App\Models\PlanModel;
use App\Models\WebsiteModel;
use App\Services\Payment\AsaasService;
use App\Services\UserPlanService;

class Subscriptions extends ResourceController
{
    protected $format = 'json';

    /**
     * GET /api/subscriptions/current
     * Retorna os dados da assinatura atual e status de vigência do usuário logado
     */
    public function current()
    {
        $userData = $this->request->userData ?? null;
        $effectiveUserId = (int)($this->request->effectiveUserId ?? ($userData->id ?? 0));

        if (!$effectiveUserId) {
            return $this->failUnauthorized('Usuário não autenticado.');
        }

        $planDetails = UserPlanService::getUserPlanDetails($effectiveUserId);

        return $this->respond([
            'status'       => 200,
            'subscription' => $planDetails['subscription'] ?? null,
            'plan_details' => $planDetails,
        ]);
    }

    /**
     * POST /api/subscriptions/cancel
     * Cancela a renovação automática da assinatura.
     * 
     * REGRA DE NEGÓCIO MANDATÓRIA:
     * O usuário continua com ACESSO TOTAL ao plano até o término do período já pago (current_period_end).
     * Somente quando essa data for ultrapassada é que o acesso expira.
     */
    public function cancel()
    {
        $userData = $this->request->userData ?? null;
        $effectiveUserId = (int)($this->request->effectiveUserId ?? ($userData->id ?? 0));
        $isAdmin = (($userData->role ?? 'user') === 'admin');

        $json = $this->request->getJSON(true) ?? $this->request->getPost();

        // Se for admin, permite cancelar a assinatura de um cliente específico via user_id
        $targetUserId = $effectiveUserId;
        if ($isAdmin && !empty($json['user_id'])) {
            $targetUserId = (int)$json['user_id'];
        }

        if (!$targetUserId) {
            return $this->failUnauthorized('Usuário não identificado.');
        }

        $subModel = new SubscriptionModel();

        // Buscar assinatura ativa
        $sub = $subModel->where('user_id', $targetUserId)
                        ->where('status', 'active')
                        ->orderBy('id', 'DESC')
                        ->first();

        if (!$sub) {
            // Verificar se já está cancelada
            $alreadyCanceled = $subModel->where('user_id', $targetUserId)
                                        ->where('status', 'canceled')
                                        ->orderBy('id', 'DESC')
                                        ->first();
            if ($alreadyCanceled) {
                $endFmt = !empty($alreadyCanceled['current_period_end'])
                    ? date('d/m/Y', strtotime($alreadyCanceled['current_period_end']))
                    : 'data indefinida';
                return $this->fail("Sua assinatura já foi cancelada anteriormente. Seu acesso permanece garantido até {$endFmt}.", 400);
            }

            return $this->failNotFound('Nenhuma assinatura ativa encontrada para este usuário.');
        }

        // Cancelar no gateway Asaas se possuir ID de assinatura registrado
        $gatewaySubId = $sub['gateway_subscription_id'] ?? null;
        if (!empty($gatewaySubId)) {
            $asaasService = new AsaasService();
            $asaasRes = $asaasService->cancelSubscription($gatewaySubId);
            if (!$asaasRes['success']) {
                log_message('warning', "[Subscriptions::cancel] Falha ao cancelar no Asaas ({$gatewaySubId}): " . ($asaasRes['message'] ?? 'Erro desconhecido'));
                // Registra aviso mas prossegue com o cancelamento local
            }
        }

        $now = date('Y-m-d H:i:s');
        $periodEnd = $sub['current_period_end'];
        if (empty($periodEnd)) {
            $periodEnd = date('Y-m-d H:i:s', strtotime('+30 days'));
        }

        // Atualizar assinatura local: status = 'canceled' e canceled_at = $now, PRESERVANDO current_period_end
        $subModel->update($sub['id'], [
            'status'             => 'canceled',
            'canceled_at'        => $now,
            'current_period_end' => $periodEnd,
        ]);

        $periodEndTimestamp = strtotime($periodEnd);
        $daysRemaining = max(0, (int)ceil(($periodEndTimestamp - time()) / 86400));
        $formattedDate = date('d/m/Y', $periodEndTimestamp);

        log_message('info', "[Subscriptions::cancel] Assinatura {$sub['id']} cancelada pelo usuário {$targetUserId}. Acesso mantido até {$formattedDate} ({$daysRemaining} dias restantes).");

        return $this->respond([
            'status'             => 200,
            'success'            => true,
            'message'            => "Assinatura cancelada com sucesso. Nenhuma nova cobrança será realizada e você continuará utilizando todos os recursos do plano até {$formattedDate} ({$daysRemaining} dias restantes).",
            'subscription_id'    => (int)$sub['id'],
            'current_period_end' => $periodEnd,
            'formatted_end_date' => $formattedDate,
            'days_remaining'     => $daysRemaining,
            'canceled_at'        => $now,
        ]);
    }

    /**
     * POST /api/subscriptions/upgrade-plan
     * Realiza o upgrade / alteração de plano do usuário.
     * 
     * REGRA DE NEGÓCIO MANDATÓRIA:
     * 1. Ao fazer o upgrade, os add-ons existentes (sites extras e tokens de IA extras) DEVEM PERMANECER.
     * 2. Se a alteração de plano resultar em um limite de sites inferior à quantidade de sites que o usuário já possui cadastrados,
     *    o sistema bloqueia e informa a quantidade que precisa ser removida.
     * 3. Se houver assinatura ativa no Asaas, atualiza o valor da recorrência diretamente no gateway.
     */
    public function upgradePlan()
    {
        $userData = $this->request->userData ?? null;
        $effectiveUserId = (int)($this->request->effectiveUserId ?? ($userData->id ?? 0));
        $isAdmin = (($userData->role ?? 'user') === 'admin');

        $json = $this->request->getJSON(true) ?? $this->request->getPost();

        $targetUserId = $effectiveUserId;
        if ($isAdmin && !empty($json['user_id'])) {
            $targetUserId = (int)$json['user_id'];
        }

        if (!$targetUserId) {
            return $this->failUnauthorized('Usuário não identificado.');
        }

        $newPlanId = (int)($json['plan_id'] ?? 0);
        if (!$newPlanId) {
            return $this->fail('Selecione o plano desejado para upgrade.', 400);
        }

        $planModel = new PlanModel();
        $newPlan = $planModel->find($newPlanId);
        if (!$newPlan || empty($newPlan['is_active'])) {
            return $this->failNotFound('Plano selecionado não encontrado ou inativo.');
        }

        $userModel = new UserModel();
        $user = $userModel->find($targetUserId);
        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        // REGRA 1: Preserva integralmente os add-ons que o usuário já possui
        $extraWebsites      = (int)($user['extra_websites'] ?? 0);
        $extraWebsitesPrice = (float)($user['extra_websites_price'] ?? 0.00);
        $extraAiTokens      = (int)($user['extra_ai_tokens'] ?? 0);
        $extraAiTokensPrice = (float)($user['extra_ai_tokens_price'] ?? 0.00);

        // REGRA 2: Valida se o novo plano comporta a quantidade atual de sites cadastrados
        $websiteModel = new WebsiteModel();
        $websitesCount = $websiteModel->where('user_id', $targetUserId)->countAllResults();

        $newBaseWebsites = $newPlan['max_websites'] !== null ? (int)$newPlan['max_websites'] : null;
        if ($newBaseWebsites !== null) {
            $newEffectiveLimit = $newBaseWebsites + $extraWebsites;
            if ($websitesCount > $newEffectiveLimit) {
                $excess = $websitesCount - $newEffectiveLimit;
                return $this->fail("Não é possível alterar para o plano {$newPlan['name']}. Você possui {$websitesCount} sites cadastrados, mas este plano suportaria no total apenas {$newEffectiveLimit} sites (com seus {$extraWebsites} sites extras). Remova pelo menos {$excess} site(s) antes de realizar este upgrade.", 400);
            }
        }

        $basePrice = (float)$newPlan['price_monthly'];
        $newTotalAmount = round($basePrice + $extraWebsitesPrice + $extraAiTokensPrice, 2);

        // Atualizar assinatura ativa no gateway Asaas e banco de dados se houver
        $subModel = new SubscriptionModel();
        $sub = $subModel->where('user_id', $targetUserId)
                        ->where('status', 'active')
                        ->orderBy('id', 'DESC')
                        ->first();

        if ($sub) {
            if (!empty($sub['gateway_subscription_id'])) {
                $asaasService = new AsaasService();
                $asaasRes = $asaasService->updateSubscription($sub['gateway_subscription_id'], [
                    'value'                 => $newTotalAmount,
                    'description'           => "Assinatura Recorrente {$newPlan['name']} - Validar Seguranca",
                    'updatePendingPayments' => true,
                ]);
                if (!$asaasRes['success']) {
                    log_message('error', "[upgradePlan] Erro ao sincronizar com Asaas: " . ($asaasRes['message'] ?? 'Erro desconhecido'));
                }
            }

            $subModel->update($sub['id'], [
                'plan_id' => $newPlanId,
                'price'   => $newTotalAmount,
            ]);
        }

        // Atribuir o novo plano ao usuário preservando os add-ons
        UserPlanService::assignPlanToUser($targetUserId, $newPlanId, [
            'extra_websites'        => $extraWebsites,
            'extra_websites_price'  => $extraWebsitesPrice,
            'extra_ai_tokens'       => $extraAiTokens,
            'extra_ai_tokens_price' => $extraAiTokensPrice,
        ]);

        $updatedDetails = UserPlanService::getUserPlanDetails($targetUserId);

        log_message('info', "[upgradePlan] Usuário {$targetUserId} atualizado para o plano {$newPlan['name']}. Add-ons preservados ({$extraWebsites} sites extras, {$extraAiTokens} tokens extras). Novo total: R$ {$newTotalAmount}");

        return $this->respond([
            'status'                  => 200,
            'success'                 => true,
            'message'                 => "Upgrade para o Plano {$newPlan['name']} realizado com sucesso! Seus add-ons existentes foram mantidos.",
            'has_active_subscription' => !empty($sub),
            'plan_details'            => $updatedDetails,
        ]);
    }

    /**
     * POST /api/subscriptions/manage-addons
     * Adiciona, atualiza ou cancela/remove add-ons do usuário.
     * 
     * REGRA DE NEGÓCIO MANDATÓRIA:
     * Para remover ou reduzir o add-on de sites, o cliente NÃO pode ter uma quantidade maior de sites
     * cadastrados do que o limite que restará no plano após a remoção.
     * Exemplo: se o plano dá direito a 4 sites e tem addon de 2 (total 6), tendo 5 sites cadastrados ele NÃO pode remover o addon.
     * O sistema deve bloquear e informar a quantidade de sites que ele precisa remover antes.
     */
    public function manageAddons()
    {
        $userData = $this->request->userData ?? null;
        $effectiveUserId = (int)($this->request->effectiveUserId ?? ($userData->id ?? 0));
        $isAdmin = (($userData->role ?? 'user') === 'admin');

        $json = $this->request->getJSON(true) ?? $this->request->getPost();

        $targetUserId = $effectiveUserId;
        if ($isAdmin && !empty($json['user_id'])) {
            $targetUserId = (int)$json['user_id'];
        }

        if (!$targetUserId) {
            return $this->failUnauthorized('Usuário não identificado.');
        }

        $userModel = new UserModel();
        $user = $userModel->find($targetUserId);
        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        $subModel = new SubscriptionModel();
        $sub = $subModel->where('user_id', $targetUserId)
                        ->where('status', 'active')
                        ->orderBy('id', 'DESC')
                        ->first();

        $planId = $user['plan_id'] ?? ($sub['plan_id'] ?? null);
        $planModel = new PlanModel();
        $plan = $planId ? $planModel->find($planId) : $planModel->getDefaultPlan();

        if (!$plan) {
            return $this->failNotFound('Plano do usuário não identificado.');
        }

        // Novos valores de add-ons
        $newExtraWebsites = isset($json['extra_websites'])
            ? max(0, (int)$json['extra_websites'])
            : (int)($user['extra_websites'] ?? 0);
        $newExtraWebsitesPrice = round($newExtraWebsites * 8.00, 2);

        if (isset($json['extra_ai_packs'])) {
            $newExtraAiPacks = max(0, (int)$json['extra_ai_packs']);
            $newExtraAiTokens = $newExtraAiPacks * 250000;
            $newExtraAiTokensPrice = round($newExtraAiPacks * 60.00, 2);
        } elseif (isset($json['extra_ai_tokens'])) {
            $newExtraAiTokens = max(0, (int)$json['extra_ai_tokens']);
            $newExtraAiTokensPrice = round(($newExtraAiTokens / 250000) * 60.00, 2);
        } else {
            $newExtraAiTokens = (int)($user['extra_ai_tokens'] ?? 0);
            $newExtraAiTokensPrice = (float)($user['extra_ai_tokens_price'] ?? 0.00);
        }

        // REGRA DE VALIDAÇÃO MANDATÓRIA:
        // Se o plano base possui limite e o novo limite for menor do que os sites cadastrados, BLOQUEAR!
        $websiteModel = new WebsiteModel();
        $websitesCount = $websiteModel->where('user_id', $targetUserId)->countAllResults();

        $baseMaxWebsites = $plan['max_websites'] !== null ? (int)$plan['max_websites'] : null;

        if ($baseMaxWebsites !== null) {
            $newEffectiveMax = $baseMaxWebsites + $newExtraWebsites;
            if ($websitesCount > $newEffectiveMax) {
                $excess = $websitesCount - $newEffectiveMax;
                return $this->fail(
                    "Não é possível remover ou reduzir o add-on de sites: você possui {$websitesCount} sites cadastrados, mas o seu limite passará a ser de {$newEffectiveMax} sites ({$baseMaxWebsites} do plano {$plan['name']} + {$newExtraWebsites} adicionais). Para remover este add-on, você deve primeiro excluir ou desvincular pelo menos {$excess} site(s).",
                    400
                );
            }
        }

        $basePrice = (float)$plan['price_monthly'];
        $newTotalAmount = round($basePrice + $newExtraWebsitesPrice + $newExtraAiTokensPrice, 2);

        // Se houver assinatura ativa, sincroniza no Asaas e banco
        if ($sub) {
            if (!empty($sub['gateway_subscription_id'])) {
                $asaasService = new AsaasService();
                $asaasRes = $asaasService->updateSubscription($sub['gateway_subscription_id'], [
                    'value'                 => $newTotalAmount,
                    'description'           => "Assinatura Recorrente {$plan['name']} - Validar Seguranca",
                    'updatePendingPayments' => true,
                ]);
                if (!$asaasRes['success']) {
                    log_message('error', "[manageAddons] Erro ao sincronizar com Asaas: " . ($asaasRes['message'] ?? 'Erro desconhecido'));
                }
            }

            $subModel->update($sub['id'], [
                'price'                => $newTotalAmount,
                'extra_websites'       => $newExtraWebsites,
                'extra_websites_price' => $newExtraWebsitesPrice,
                'extra_ai_tokens'      => $newExtraAiTokens,
                'extra_ai_tokens_price'=> $newExtraAiTokensPrice,
            ]);
        }

        // Atualiza dados no usuário
        UserPlanService::assignPlanToUser($targetUserId, (int)$plan['id'], [
            'extra_websites'        => $newExtraWebsites,
            'extra_websites_price'  => $newExtraWebsitesPrice,
            'extra_ai_tokens'       => $newExtraAiTokens,
            'extra_ai_tokens_price' => $newExtraAiTokensPrice,
        ]);

        $updatedDetails = UserPlanService::getUserPlanDetails($targetUserId);

        log_message('info', "[manageAddons] Add-ons do usuário {$targetUserId} atualizados: {$newExtraWebsites} sites extras, {$newExtraAiTokens} tokens extras. Novo total: R$ {$newTotalAmount}");

        return $this->respond([
            'status'       => 200,
            'success'      => true,
            'message'      => 'Add-ons atualizados com sucesso!',
            'plan_details' => $updatedDetails,
        ]);
    }
}
