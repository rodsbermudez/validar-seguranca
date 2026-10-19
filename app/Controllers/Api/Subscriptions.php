<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\SubscriptionModel;
use App\Models\UserModel;
use App\Models\PlanModel;
use App\Models\WebsiteModel;
use App\Models\PaymentTransactionModel;
use App\Models\SettingsModel;
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
    /**
     * POST /api/subscriptions/preview-change
     * Calcula em tempo real o pró-rata, dias restantes, valores proporcionais e validações de capacidade
     */
    public function previewChange()
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

        $planModel = new PlanModel();
        $currentPlanId = $user['plan_id'] ?? ($sub['plan_id'] ?? null);
        $currentPlan = $currentPlanId ? $planModel->find($currentPlanId) : $planModel->getDefaultPlan();

        $newPlanId = !empty($json['plan_id']) ? (int)$json['plan_id'] : (int)($currentPlan['id'] ?? 1);
        $newPlan = $planModel->find($newPlanId) ?: $currentPlan;

        // Add-ons e valores atuais
        $currentExtraWebsites      = (int)($user['extra_websites'] ?? 0);
        $currentExtraWebsitesPrice = (float)($user['extra_websites_price'] ?? 0.00);
        $currentExtraAiTokens      = (int)($user['extra_ai_tokens'] ?? 0);
        $currentExtraAiTokensPrice = (float)($user['extra_ai_tokens_price'] ?? 0.00);
        $currentBasePrice          = (float)($currentPlan['price_monthly'] ?? 0.00);
        $currentTotalMonthly       = round($currentBasePrice + $currentExtraWebsitesPrice + $currentExtraAiTokensPrice, 2);

        // Novos add-ons propostos
        $newExtraWebsites = isset($json['extra_websites'])
            ? max(0, (int)$json['extra_websites'])
            : $currentExtraWebsites;
        $newExtraWebsitesPrice = round($newExtraWebsites * 8.00, 2);

        if (isset($json['extra_ai_packs'])) {
            $newExtraAiPacks = max(0, (int)$json['extra_ai_packs']);
            $newExtraAiTokens = $newExtraAiPacks * 250000;
            $newExtraAiTokensPrice = round($newExtraAiPacks * 60.00, 2);
        } elseif (isset($json['extra_ai_tokens'])) {
            $newExtraAiTokens = max(0, (int)$json['extra_ai_tokens']);
            $newExtraAiTokensPrice = round(($newExtraAiTokens / 250000) * 60.00, 2);
        } else {
            $newExtraAiTokens = $currentExtraAiTokens;
            $newExtraAiTokensPrice = $currentExtraAiTokensPrice;
        }

        $newBasePrice = (float)$newPlan['price_monthly'];
        $newTotalMonthly = round($newBasePrice + $newExtraWebsitesPrice + $newExtraAiTokensPrice, 2);
        $difference = round($newTotalMonthly - $currentTotalMonthly, 2);
        $isDowngrade = ($difference <= 0);

        // Dias restantes no ciclo atual
        $hasActiveSub = !empty($sub);
        $currentPeriodEnd = $sub['current_period_end'] ?? null;
        $now = time();

        if ($hasActiveSub && !empty($currentPeriodEnd) && strtotime($currentPeriodEnd) > $now) {
            $endTs = strtotime($currentPeriodEnd);
            $daysRemaining = max(1, (int)ceil(($endTs - $now) / 86400));
            $daysInCycle = 30;
            $nextDueDate = date('Y-m-d', $endTs);
        } else {
            $daysRemaining = 30;
            $daysInCycle = 30;
            $nextDueDate = date('Y-m-d', strtotime('+30 days'));
        }

        $proratedRatio = min(1.0, max(0.033, $daysRemaining / 30.0));
        $proratedAmount = $difference > 0 ? round($difference * $proratedRatio, 2) : 0.00;

        // Validação de Capacidade
        $websiteModel = new WebsiteModel();
        $websitesCount = $websiteModel->where('user_id', $targetUserId)->countAllResults();
        $newBaseMax = $newPlan['max_websites'] !== null ? (int)$newPlan['max_websites'] : null;
        $newEffectiveMax = $newBaseMax !== null ? ($newBaseMax + $newExtraWebsites) : null;
        $isCapacityBlocked = ($newEffectiveMax !== null && $websitesCount > $newEffectiveMax);
        $excessWebsites = $isCapacityBlocked ? ($websitesCount - $newEffectiveMax) : 0;

        // Dados de pagamento da assinatura
        $transModel = new PaymentTransactionModel();
        $lastTrans = $hasActiveSub
            ? $transModel->where('subscription_id', $sub['id'])->orderBy('id', 'DESC')->first()
            : null;
        $meta = !empty($lastTrans['metadata']) ? json_decode($lastTrans['metadata'], true) : [];
        $billingType = ($lastTrans['payment_method'] ?? '') === 'credit_card' ? 'CREDIT_CARD' : ($meta['billing_type'] ?? 'CREDIT_CARD');
        $cardLast4 = $meta['card_last4'] ?? null;
        $cardBrand = $meta['card_brand'] ?? 'Mastercard';

        return $this->respond([
            'status'                     => 200,
            'current_plan_name'          => $currentPlan['name'],
            'current_monthly'            => $currentTotalMonthly,
            'new_plan_name'              => $newPlan['name'],
            'new_monthly'                => $newTotalMonthly,
            'difference'                 => $difference,
            'is_downgrade'               => $isDowngrade,
            'days_remaining'             => $daysRemaining,
            'next_due_date'              => $nextDueDate,
            'next_due_date_formatted'    => date('d/m/Y', strtotime($nextDueDate)),
            'prorated_amount'            => $proratedAmount,
            'websites_count'             => $websitesCount,
            'new_effective_max_websites' => $newEffectiveMax,
            'is_capacity_blocked'        => $isCapacityBlocked,
            'excess_websites'            => $excessWebsites,
            'billing_type'               => $billingType,
            'card_last4'                 => $cardLast4,
            'card_brand'                 => $cardBrand,
            'has_active_subscription'    => $hasActiveSub,
            'gateway_subscription_id'    => $sub['gateway_subscription_id'] ?? null,
        ]);
    }

    /**
     * POST /api/subscriptions/upgrade-plan
     * Realiza upgrade do plano base preservando add-ons e calculando pró-rata
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

        // REGRA 2: Validação de capacidade
        $websiteModel = new WebsiteModel();
        $websitesCount = $websiteModel->where('user_id', $targetUserId)->countAllResults();

        $newBaseWebsites = $newPlan['max_websites'] !== null ? (int)$newPlan['max_websites'] : null;
        if ($newBaseWebsites !== null) {
            $newEffectiveLimit = $newBaseWebsites + $extraWebsites;
            if ($websitesCount > $newEffectiveLimit) {
                $excess = $websitesCount - $newEffectiveLimit;
                return $this->fail("Não é possível alterar para o plano {$newPlan['name']}. Você possui {$websitesCount} sites cadastrados, mas este plano suportaria no total apenas {$newEffectiveLimit} sites (com seus {$extraWebsites} sites extras). Remova pelo menos {$excess} site(s) antes de realizar esta alteração.", 400);
            }
        }

        $basePrice = (float)$newPlan['price_monthly'];
        $newTotalAmount = round($basePrice + $extraWebsitesPrice + $extraAiTokensPrice, 2);

        $subModel = new SubscriptionModel();
        $sub = $subModel->where('user_id', $targetUserId)
                        ->where('status', 'active')
                        ->orderBy('id', 'DESC')
                        ->first();

        $currentPlanId = $user['plan_id'] ?? ($sub['plan_id'] ?? null);
        $currentPlan = $currentPlanId ? $planModel->find($currentPlanId) : $planModel->getDefaultPlan();
        $currentTotalMonthly = round((float)($currentPlan['price_monthly'] ?? 0) + $extraWebsitesPrice + $extraAiTokensPrice, 2);
        $difference = round($newTotalAmount - $currentTotalMonthly, 2);

        $asaasService = new AsaasService();

        // 1. DOWNGRADE / MESMO VALOR: Não há cobrança
        if ($difference <= 0) {
            if ($sub && !empty($sub['gateway_subscription_id'])) {
                $asaasService->updateSubscription($sub['gateway_subscription_id'], [
                    'value'                 => $newTotalAmount,
                    'description'           => "Assinatura Recorrente {$newPlan['name']} - Vexors",
                    'updatePendingPayments' => true,
                ]);
                $subModel->update($sub['id'], [
                    'plan_id' => $newPlanId,
                    'price'   => $newTotalAmount,
                ]);
            }

            UserPlanService::assignPlanToUser($targetUserId, $newPlanId, [
                'extra_websites'        => $extraWebsites,
                'extra_websites_price'  => $extraWebsitesPrice,
                'extra_ai_tokens'       => $extraAiTokens,
                'extra_ai_tokens_price' => $extraAiTokensPrice,
            ]);

            $updatedDetails = UserPlanService::getUserPlanDetails($targetUserId);
            $endDateFmt = !empty($sub['current_period_end']) ? date('d/m/Y', strtotime($sub['current_period_end'])) : date('d/m/Y', strtotime('+30 days'));

            return $this->respond([
                'status'       => 200,
                'success'      => true,
                'message'      => "Alteração para o plano {$newPlan['name']} programada com sucesso! Nenhuma cobrança foi realizada agora. A partir de {$endDateFmt}, sua mensalidade será de R$ " . number_format($newTotalAmount, 2, ',', '.') . "/mês.",
                'plan_details' => $updatedDetails,
            ]);
        }

        // 2. UPGRADE COM DIFERENÇA (PRÓ-RATA)
        $now = time();
        $currentPeriodEnd = $sub['current_period_end'] ?? null;
        if ($sub && !empty($currentPeriodEnd) && strtotime($currentPeriodEnd) > $now) {
            $endTs = strtotime($currentPeriodEnd);
            $daysRemaining = max(1, (int)ceil(($endTs - $now) / 86400));
            $nextDueDateFmt = date('d/m/Y', $endTs);
        } else {
            $daysRemaining = 30;
            $nextDueDateFmt = date('d/m/Y', strtotime('+30 days'));
        }

        $proratedRatio = min(1.0, max(0.033, $daysRemaining / 30.0));
        $proratedAmount = round($difference * $proratedRatio, 2);

        $paymentMethods = SettingsModel::getPaymentMethods();
        $requestedBillingType = strtoupper(trim($json['billing_type'] ?? ''));
        if (empty($requestedBillingType)) {
            $requestedBillingType = $paymentMethods['credit_card'] ? 'CREDIT_CARD' : 'PIX';
        }

        if ($requestedBillingType === 'PIX' && empty($paymentMethods['pix'])) {
            return $this->fail('O pagamento via Pix está temporariamente desativado. Por favor, utilize Cartão de Crédito.', 400);
        }
        if ($requestedBillingType === 'CREDIT_CARD' && empty($paymentMethods['credit_card'])) {
            return $this->fail('O pagamento via Cartão de Crédito está desativado no momento. Por favor, utilize Pix.', 400);
        }

        // Se o usuário solicitou pagamento com CARTÃO DE CRÉDITO
        if ($sub && $requestedBillingType === 'CREDIT_CARD') {
            $transModel = new PaymentTransactionModel();
            $userModel = new UserModel();

            $creditCard = $json['credit_card'] ?? [];
            $holderName  = trim($creditCard['holder_name'] ?? '');
            $cardNumber  = preg_replace('/\D/', '', $creditCard['number'] ?? '');
            $expiryMonth = trim($creditCard['expiry_month'] ?? '');
            $expiryYear  = trim($creditCard['expiry_year'] ?? '');
            $ccv         = trim($creditCard['ccv'] ?? '');
            $postalCode  = preg_replace('/\D/', '', $creditCard['postal_code'] ?? ($user['postal_code'] ?? '01310000'));
            $addressNum  = trim($creditCard['address_number'] ?? 'S/N');
            $cpfCnpj     = preg_replace('/\D/', '', $creditCard['cpf_cnpj'] ?? ($user['cpf_cnpj'] ?? ''));
            $phone       = preg_replace('/\D/', '', $creditCard['phone'] ?? ($user['phone'] ?? ''));

            if (!empty($cpfCnpj) && empty($user['cpf_cnpj'])) {
                $userModel->update($targetUserId, ['cpf_cnpj' => $cpfCnpj]);
            }
            if (!empty($phone) && empty($user['phone'])) {
                $userModel->update($targetUserId, ['phone' => $phone]);
            }

            if (empty($holderName) || empty($cardNumber) || empty($expiryMonth) || empty($expiryYear) || empty($ccv)) {
                return $this->fail('Todos os dados do cartão de crédito (titular, número, validade e CVV) são obrigatórios.', 400);
            }

            $creditCardPayload = [
                'holder_name'  => $holderName,
                'number'       => $cardNumber,
                'expiry_month' => $expiryMonth,
                'expiry_year'  => $expiryYear,
                'ccv'          => $ccv,
                'cpf_cnpj'     => $cpfCnpj,
                'phone'        => $phone,
            ];

            $creditCardHolderInfo = [
                'name'           => $holderName,
                'email'          => $user['email'] ?? '',
                'cpf_cnpj'       => $cpfCnpj,
                'postal_code'    => $postalCode ?: '01310000',
                'address_number' => $addressNum ?: 'S/N',
                'phone'          => $phone,
            ];

            $asaasCustomerId = $sub['gateway_customer_id'] ?? ($user['asaas_customer_id'] ?? 'cus_sim');
            $extRef = "prorated_upg_{$sub['id']}_usr_{$targetUserId}_" . time();
            $desc = "Diferenca Pro-rata Upgrade {$newPlan['name']} ({$daysRemaining} dias)";
            $clientIp = $this->request->getIPAddress();

            $cardPayRes = $asaasService->createPaymentCreditCard(
                $asaasCustomerId,
                $proratedAmount,
                $desc,
                $extRef,
                $creditCardPayload,
                $creditCardHolderInfo,
                $clientIp
            );

            if (!$cardPayRes['success']) {
                return $this->fail('Falha ao processar pagamento no cartão: ' . ($cardPayRes['message'] ?? 'Cartão recusado'), 400);
            }

            $cardStatus = strtoupper($cardPayRes['status'] ?? ($cardPayRes['payment_status'] ?? 'PENDING'));
            $isApproved = in_array($cardStatus, ['CONFIRMED', 'RECEIVED', 'ACTIVE', 'AUTHORIZED', 'PAID'], true) || !empty($cardPayRes['simulated']);

            if (!$isApproved) {
                return $this->fail('O pagamento não foi autorizado pela operadora do cartão (status: ' . $cardStatus . '). Verifique os dados ou o limite disponível.', 400);
            }

            // Grava transação do pró-rata
            $transModel->insert([
                'user_id'                => $targetUserId,
                'subscription_id'        => $sub['id'],
                'plan_id'                => $newPlanId,
                'gateway'                => 'asaas',
                'gateway_transaction_id' => $cardPayRes['payment_id'] ?? ('pay_prorated_' . uniqid()),
                'amount'                 => $proratedAmount,
                'payment_method'         => 'credit_card',
                'status'                 => 'paid',
                'paid_at'                => date('Y-m-d H:i:s'),
                'metadata'               => json_encode([
                    'type'            => 'prorated_upgrade',
                    'new_plan'        => $newPlan['name'],
                    'days_remaining'  => $daysRemaining,
                    'prorated_amount' => $proratedAmount,
                    'new_monthly'     => $newTotalAmount,
                    'card_last4'      => substr($cardNumber, -4),
                ]),
            ]);

            // Atualiza ou cria a assinatura recorrente no Asaas para os próximos ciclos
            $isPrevInternal = empty($sub['gateway_subscription_id']) || 
                              strpos($sub['gateway_subscription_id'], 'free_') === 0 || 
                              strpos($sub['gateway_subscription_id'], 'sub_internal_') === 0 ||
                              ($sub['gateway'] ?? '') === 'internal';

            $gatewaySubId = $sub['gateway_subscription_id'] ?? null;
            if (!$isPrevInternal && !empty($gatewaySubId)) {
                $asaasService->updateSubscription($gatewaySubId, [
                    'value'                 => $newTotalAmount,
                    'description'           => "Assinatura Recorrente {$newPlan['name']} - Vexors",
                    'updatePendingPayments' => false,
                ]);
            } else {
                $subRes = $asaasService->createSubscription(
                    $asaasCustomerId,
                    $newTotalAmount,
                    "Assinatura Recorrente {$newPlan['name']} - Vexors",
                    "sub_{$sub['id']}_usr_{$targetUserId}",
                    date('Y-m-d', strtotime('+30 days')),
                    'CREDIT_CARD',
                    $creditCardPayload,
                    $creditCardHolderInfo,
                    $clientIp
                );
                $gatewaySubId = $subRes['subscription_id'] ?? ('sub_card_' . uniqid());
            }

            $subModel->update($sub['id'], [
                'plan_id'                 => $newPlanId,
                'price'                   => $newTotalAmount,
                'gateway'                 => 'asaas',
                'gateway_subscription_id' => $gatewaySubId,
            ]);

            UserPlanService::assignPlanToUser($targetUserId, $newPlanId, [
                'extra_websites'        => $extraWebsites,
                'extra_websites_price'  => $extraWebsitesPrice,
                'extra_ai_tokens'       => $extraAiTokens,
                'extra_ai_tokens_price' => $extraAiTokensPrice,
            ]);

            $updatedDetails = UserPlanService::getUserPlanDetails($targetUserId);

            return $this->respond([
                'status'       => 200,
                'success'      => true,
                'paid'         => true,
                'message'      => "Upgrade para o Plano {$newPlan['name']} ativado com sucesso! O pagamento proporcional de R$ " . number_format($proratedAmount, 2, ',', '.') . " foi aprovado no cartão.",
                'plan_details' => $updatedDetails,
            ]);
        }

        // Se o usuário tem assinatura ativa e solicitou PIX (ou não informou cartão):
        if ($sub && ($requestedBillingType === 'PIX' || empty($requestedBillingType))) {
            $asaasCustomerId = $sub['gateway_customer_id'] ?? ($user['asaas_customer_id'] ?? 'cus_sim');
            $extRef = "prorated_pix_upg_{$sub['id']}_usr_{$targetUserId}_" . time();
            $desc = "Diferenca Pro-rata Upgrade {$newPlan['name']} ({$daysRemaining} dias)";

            $pixRes = $asaasService->createPaymentPix($asaasCustomerId, $proratedAmount, $desc, $extRef);
            if (!$pixRes['success']) {
                return $this->fail('Falha ao gerar cobrança PIX pró-rata: ' . ($pixRes['message'] ?? 'Erro no Asaas'), 400);
            }

            $pixDetails = $asaasService->getPixQrCode($pixRes['payment_id']);

            return $this->respond([
                'status'                  => 200,
                'require_pix'             => true,
                'payment_id'              => $pixRes['payment_id'],
                'prorated_amount'         => $proratedAmount,
                'pix_qr_code'             => $pixDetails['encoded_image'] ?? null,
                'pix_copy_paste'          => $pixDetails['payload'] ?? null,
                'days_remaining'          => $daysRemaining,
                'next_due_date_formatted' => $nextDueDateFmt,
                'new_monthly'             => $newTotalAmount,
                'new_plan_id'             => $newPlanId,
                'message'                 => "Para ativar seu upgrade, efetue o pagamento da diferença proporcional de R$ " . number_format($proratedAmount, 2, ',', '.') . " via PIX.",
            ]);
        }

        // Sem assinatura ativa vinculada no gateway Asaas
        if (!$sub || empty($sub['gateway_subscription_id'])) {
            if ($isAdmin && !empty($json['user_id']) && (int)$json['user_id'] !== $effectiveUserId) {
                UserPlanService::assignPlanToUser($targetUserId, $newPlanId, [
                    'extra_websites'        => $extraWebsites,
                    'extra_websites_price'  => $extraWebsitesPrice,
                    'extra_ai_tokens'       => $extraAiTokens,
                    'extra_ai_tokens_price' => $extraAiTokensPrice,
                ]);

                $updatedDetails = UserPlanService::getUserPlanDetails($targetUserId);

                return $this->respond([
                    'status'       => 200,
                    'success'      => true,
                    'message'      => "Plano {$newPlan['name']} atribuído manualmente pelo administrador.",
                    'plan_details' => $updatedDetails,
                ]);
            }

            // Cliente sem assinatura ativa: requer contratação pelo Checkout
            return $this->respond([
                'status'           => 200,
                'require_checkout' => true,
                'plan_id'          => $newPlanId,
                'extra_websites'   => $extraWebsites,
                'extra_ai_packs'   => (int)($extraAiTokens / 250000),
                'message'          => 'Para realizar upgrade, conclua a contratação informando seu método de pagamento (Cartão ou PIX).',
            ]);
        }
    }

    /**
     * POST /api/subscriptions/manage-addons
     * Adiciona, atualiza ou remove add-ons do usuário com controle de pró-rata e transparência
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

        // Valores atuais
        $currentExtraWebsites      = (int)($user['extra_websites'] ?? 0);
        $currentExtraWebsitesPrice = (float)($user['extra_websites_price'] ?? 0.00);
        $currentExtraAiTokens      = (int)($user['extra_ai_tokens'] ?? 0);
        $currentExtraAiTokensPrice = (float)($user['extra_ai_tokens_price'] ?? 0.00);
        $basePrice                 = (float)$plan['price_monthly'];
        $currentTotalMonthly       = round($basePrice + $currentExtraWebsitesPrice + $currentExtraAiTokensPrice, 2);

        // Novos valores de add-ons
        $newExtraWebsites = isset($json['extra_websites'])
            ? max(0, (int)$json['extra_websites'])
            : $currentExtraWebsites;
        $newExtraWebsitesPrice = round($newExtraWebsites * 8.00, 2);

        if (isset($json['extra_ai_packs'])) {
            $newExtraAiPacks = max(0, (int)$json['extra_ai_packs']);
            $newExtraAiTokens = $newExtraAiPacks * 250000;
            $newExtraAiTokensPrice = round($newExtraAiPacks * 60.00, 2);
        } elseif (isset($json['extra_ai_tokens'])) {
            $newExtraAiTokens = max(0, (int)$json['extra_ai_tokens']);
            $newExtraAiTokensPrice = round(($newExtraAiTokens / 250000) * 60.00, 2);
        } else {
            $newExtraAiTokens = $currentExtraAiTokens;
            $newExtraAiTokensPrice = $currentExtraAiTokensPrice;
        }

        // REGRA DE CAPACIDADE MANDATÓRIA:
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

        $newTotalAmount = round($basePrice + $newExtraWebsitesPrice + $newExtraAiTokensPrice, 2);
        $difference = round($newTotalAmount - $currentTotalMonthly, 2);

        $asaasService = new AsaasService();

        // 1. DOWNGRADE / REDUÇÃO / CANCELAMENTO DE ADD-ONS (SEM COBRANÇA AGORA)
        if ($difference <= 0) {
            if ($sub && !empty($sub['gateway_subscription_id'])) {
                $asaasService->updateSubscription($sub['gateway_subscription_id'], [
                    'value'                 => $newTotalAmount,
                    'description'           => "Assinatura Recorrente {$plan['name']} - Vexors",
                    'updatePendingPayments' => true,
                ]);

                $subModel->update($sub['id'], [
                    'price'                => $newTotalAmount,
                    'extra_websites'       => $newExtraWebsites,
                    'extra_websites_price' => $newExtraWebsitesPrice,
                    'extra_ai_tokens'      => $newExtraAiTokens,
                    'extra_ai_tokens_price'=> $newExtraAiTokensPrice,
                ]);
            }

            UserPlanService::assignPlanToUser($targetUserId, (int)$plan['id'], [
                'extra_websites'        => $newExtraWebsites,
                'extra_websites_price'  => $newExtraWebsitesPrice,
                'extra_ai_tokens'       => $newExtraAiTokens,
                'extra_ai_tokens_price' => $newExtraAiTokensPrice,
            ]);

            $updatedDetails = UserPlanService::getUserPlanDetails($targetUserId);
            $endDateFmt = !empty($sub['current_period_end']) ? date('d/m/Y', strtotime($sub['current_period_end'])) : date('d/m/Y', strtotime('+30 days'));

            return $this->respond([
                'status'       => 200,
                'success'      => true,
                'message'      => "Redução de add-ons programada com sucesso! Nenhuma cobrança foi realizada agora. Seus recursos continuam ativos até {$endDateFmt}. A partir do próximo ciclo ({$endDateFmt}), sua fatura será reduzida para R$ " . number_format($newTotalAmount, 2, ',', '.') . "/mês.",
                'plan_details' => $updatedDetails,
            ]);
        }

        // 2. AUMENTO DE ADD-ONS COM PRÓ-RATA
        $now = time();
        $currentPeriodEnd = $sub['current_period_end'] ?? null;
        if ($sub && !empty($currentPeriodEnd) && strtotime($currentPeriodEnd) > $now) {
            $endTs = strtotime($currentPeriodEnd);
            $daysRemaining = max(1, (int)ceil(($endTs - $now) / 86400));
            $nextDueDateFmt = date('d/m/Y', $endTs);
        } else {
            $daysRemaining = 30;
            $nextDueDateFmt = date('d/m/Y', strtotime('+30 days'));
        }

        $proratedRatio = min(1.0, max(0.033, $daysRemaining / 30.0));
        $proratedAmount = round($difference * $proratedRatio, 2);

        $paymentMethods = SettingsModel::getPaymentMethods();
        $requestedBillingType = strtoupper(trim($json['billing_type'] ?? ''));
        if (empty($requestedBillingType)) {
            $requestedBillingType = $paymentMethods['credit_card'] ? 'CREDIT_CARD' : 'PIX';
        }

        if ($requestedBillingType === 'PIX' && empty($paymentMethods['pix'])) {
            return $this->fail('O pagamento via Pix está temporariamente desativado. Por favor, utilize Cartão de Crédito.', 400);
        }
        if ($requestedBillingType === 'CREDIT_CARD' && empty($paymentMethods['credit_card'])) {
            return $this->fail('O pagamento via Cartão de Crédito está desativado no momento. Por favor, utilize Pix.', 400);
        }

        // Se o cliente escolheu Cartão de Crédito
        if ($sub && $requestedBillingType === 'CREDIT_CARD') {
            $transModel = new PaymentTransactionModel();
            $userModel = new UserModel();

            $creditCard = $json['credit_card'] ?? [];
            $holderName  = trim($creditCard['holder_name'] ?? '');
            $cardNumber  = preg_replace('/\D/', '', $creditCard['number'] ?? '');
            $expiryMonth = trim($creditCard['expiry_month'] ?? '');
            $expiryYear  = trim($creditCard['expiry_year'] ?? '');
            $ccv         = trim($creditCard['ccv'] ?? '');
            $postalCode  = preg_replace('/\D/', '', $creditCard['postal_code'] ?? ($user['postal_code'] ?? '01310000'));
            $addressNum  = trim($creditCard['address_number'] ?? 'S/N');
            $cpfCnpj     = preg_replace('/\D/', '', $creditCard['cpf_cnpj'] ?? ($user['cpf_cnpj'] ?? ''));
            $phone       = preg_replace('/\D/', '', $creditCard['phone'] ?? ($user['phone'] ?? ''));

            if (!empty($cpfCnpj) && empty($user['cpf_cnpj'])) {
                $userModel->update($targetUserId, ['cpf_cnpj' => $cpfCnpj]);
            }
            if (!empty($phone) && empty($user['phone'])) {
                $userModel->update($targetUserId, ['phone' => $phone]);
            }

            if (empty($holderName) || empty($cardNumber) || empty($expiryMonth) || empty($expiryYear) || empty($ccv)) {
                return $this->fail('Todos os dados do cartão de crédito (titular, número, validade e CVV) são obrigatórios para realizar o pagamento.', 400);
            }

            $creditCardPayload = [
                'holder_name'  => $holderName,
                'number'       => $cardNumber,
                'expiry_month' => $expiryMonth,
                'expiry_year'  => $expiryYear,
                'ccv'          => $ccv,
                'cpf_cnpj'     => $cpfCnpj,
                'phone'        => $phone,
            ];

            $creditCardHolderInfo = [
                'name'           => $holderName,
                'email'          => $user['email'] ?? '',
                'cpf_cnpj'       => $cpfCnpj,
                'postal_code'    => $postalCode ?: '01310000',
                'address_number' => $addressNum ?: 'S/N',
                'phone'          => $phone,
            ];

            $asaasCustomerId = $sub['gateway_customer_id'] ?? ($user['asaas_customer_id'] ?? 'cus_sim');
            $extRef = "prorated_addons_{$sub['id']}_usr_{$targetUserId}_" . time();
            $desc = "Diferenca Pro-rata Add-ons ({$daysRemaining} dias)";
            $clientIp = $this->request->getIPAddress();

            $cardPayRes = $asaasService->createPaymentCreditCard(
                $asaasCustomerId,
                $proratedAmount,
                $desc,
                $extRef,
                $creditCardPayload,
                $creditCardHolderInfo,
                $clientIp
            );

            if (!$cardPayRes['success']) {
                return $this->fail('Falha ao processar pagamento no cartão: ' . ($cardPayRes['message'] ?? 'Cartão recusado pela operadora.'), 400);
            }

            $cardStatus = strtoupper($cardPayRes['status'] ?? ($cardPayRes['payment_status'] ?? 'PENDING'));
            $isApproved = in_array($cardStatus, ['CONFIRMED', 'RECEIVED', 'ACTIVE', 'AUTHORIZED', 'PAID'], true) || !empty($cardPayRes['simulated']);

            if (!$isApproved) {
                return $this->fail('O pagamento não foi autorizado pela operadora do cartão (status: ' . $cardStatus . '). Verifique os dados ou o limite disponível.', 400);
            }

            // Pagamento APROVADO: Grava transação do pró-rata
            $transModel->insert([
                'user_id'                => $targetUserId,
                'subscription_id'        => $sub['id'],
                'plan_id'                => (int)$plan['id'],
                'gateway'                => 'asaas',
                'gateway_transaction_id' => $cardPayRes['payment_id'] ?? ('pay_prorated_' . uniqid()),
                'amount'                 => $proratedAmount,
                'payment_method'         => 'credit_card',
                'status'                 => 'paid',
                'paid_at'                => date('Y-m-d H:i:s'),
                'metadata'               => json_encode([
                    'type'                 => 'prorated_addons',
                    'extra_websites'       => $newExtraWebsites,
                    'extra_ai_tokens'      => $newExtraAiTokens,
                    'days_remaining'       => $daysRemaining,
                    'prorated_amount'      => $proratedAmount,
                    'new_monthly'          => $newTotalAmount,
                    'card_last4'           => substr($cardNumber, -4),
                ]),
            ]);

            // Atualiza assinatura no Asaas com novo valor integral para as próximas faturas
            if (!empty($sub['gateway_subscription_id'])) {
                $asaasService->updateSubscription($sub['gateway_subscription_id'], [
                    'value'                 => $newTotalAmount,
                    'description'           => "Assinatura Recorrente {$plan['name']} - Vexors",
                    'updatePendingPayments' => false,
                ]);
            }

            $subModel->update($sub['id'], [
                'price'                => $newTotalAmount,
                'extra_websites'       => $newExtraWebsites,
                'extra_websites_price' => $newExtraWebsitesPrice,
                'extra_ai_tokens'      => $newExtraAiTokens,
                'extra_ai_tokens_price'=> $newExtraAiTokensPrice,
            ]);

            UserPlanService::assignPlanToUser($targetUserId, (int)$plan['id'], [
                'extra_websites'        => $newExtraWebsites,
                'extra_websites_price'  => $newExtraWebsitesPrice,
                'extra_ai_tokens'       => $newExtraAiTokens,
                'extra_ai_tokens_price' => $newExtraAiTokensPrice,
            ]);

            $updatedDetails = UserPlanService::getUserPlanDetails($targetUserId);

            return $this->respond([
                'status'       => 200,
                'success'      => true,
                'paid'         => true,
                'message'      => "Add-ons ativados com sucesso! O pagamento proporcional de R$ " . number_format($proratedAmount, 2, ',', '.') . " foi aprovado no seu cartão. A partir de {$nextDueDateFmt}, sua fatura regular será de R$ " . number_format($newTotalAmount, 2, ',', '.') . "/mês.",
                'plan_details' => $updatedDetails,
            ]);
        }

        // Se o cliente escolheu PIX (ou não informou cartão):
        if ($sub && ($requestedBillingType === 'PIX' || empty($requestedBillingType))) {
            $asaasCustomerId = $sub['gateway_customer_id'] ?? ($user['asaas_customer_id'] ?? 'cus_sim');
            $extRef = "prorated_pix_addons_{$sub['id']}_usr_{$targetUserId}_" . time();
            $desc = "Diferenca Pro-rata Add-ons ({$daysRemaining} dias)";

            $pixRes = $asaasService->createPaymentPix($asaasCustomerId, $proratedAmount, $desc, $extRef);
            if (!$pixRes['success']) {
                return $this->fail('Falha ao gerar cobrança PIX pró-rata: ' . ($pixRes['message'] ?? 'Erro no Asaas'), 400);
            }

            $pixDetails = $asaasService->getPixQrCode($pixRes['payment_id']);

            return $this->respond([
                'status'                  => 200,
                'require_pix'             => true,
                'payment_id'              => $pixRes['payment_id'],
                'prorated_amount'         => $proratedAmount,
                'pix_qr_code'             => $pixDetails['encoded_image'] ?? null,
                'pix_copy_paste'          => $pixDetails['payload'] ?? null,
                'days_remaining'          => $daysRemaining,
                'next_due_date_formatted' => $nextDueDateFmt,
                'new_monthly'             => $newTotalAmount,
                'extra_websites'          => $newExtraWebsites,
                'extra_ai_tokens'         => $newExtraAiTokens,
                'message'                 => "Para ativar seus add-ons, efetue o pagamento da diferença proporcional de R$ " . number_format($proratedAmount, 2, ',', '.') . " via PIX.",
            ]);
        }

        // Sem assinatura ativa no gateway (conta cortesia ou admin)
        if (!$sub || empty($sub['gateway_subscription_id'])) {
            if ($isAdmin && !empty($json['user_id']) && (int)$json['user_id'] !== $effectiveUserId) {
                UserPlanService::assignPlanToUser($targetUserId, (int)$plan['id'], [
                    'extra_websites'        => $newExtraWebsites,
                    'extra_websites_price'  => $newExtraWebsitesPrice,
                    'extra_ai_tokens'       => $newExtraAiTokens,
                    'extra_ai_tokens_price' => $newExtraAiTokensPrice,
                ]);

                $updatedDetails = UserPlanService::getUserPlanDetails($targetUserId);

                return $this->respond([
                    'status'       => 200,
                    'success'      => true,
                    'message'      => 'Add-ons atribuídos manualmente pelo administrador.',
                    'plan_details' => $updatedDetails,
                ]);
            }

            // Cliente sem assinatura ativa: requer contratação pelo Checkout
            return $this->respond([
                'status'           => 200,
                'require_checkout' => true,
                'plan_id'          => (int)$plan['id'],
                'extra_websites'   => $newExtraWebsites,
                'extra_ai_packs'   => isset($json['extra_ai_packs']) ? (int)$json['extra_ai_packs'] : (int)($newExtraAiTokens / 250000),
                'message'          => 'Para adicionar recursos pagos, é necessário possuir uma assinatura ativa no Asaas. Por favor, conclua a contratação informando seu método de pagamento (Cartão ou PIX).',
            ]);
        }
    }

    /**
     * POST /api/subscriptions/confirm-prorated-pix
     * Confirma o pagamento PIX da diferença proporcional e ativa os novos limites
     */
    public function confirmProratedPix()
    {
        $userData = $this->request->userData ?? null;
        $effectiveUserId = (int)($this->request->effectiveUserId ?? ($userData->id ?? 0));
        $isAdmin = (($userData->role ?? 'user') === 'admin');

        $json = $this->request->getJSON(true) ?? $this->request->getPost();
        $targetUserId = $effectiveUserId;
        if ($isAdmin && !empty($json['user_id'])) {
            $targetUserId = (int)$json['user_id'];
        }

        $paymentId = trim($json['payment_id'] ?? '');
        if (empty($paymentId)) {
            return $this->fail('ID do pagamento não informado.', 400);
        }

        $asaasService = new AsaasService();
        $statusRes = $asaasService->getPaymentStatus($paymentId);
        $status = strtoupper($statusRes['status'] ?? 'PENDING');
        $isPaid = in_array($status, ['CONFIRMED', 'RECEIVED'], true) || !empty($statusRes['simulated']);

        if (!$isPaid) {
            return $this->respond([
                'status'  => 200,
                'paid'    => false,
                'message' => 'Pagamento PIX ainda não foi confirmado. Aguarde alguns instantes.',
            ]);
        }

        $subModel = new SubscriptionModel();
        $sub = $subModel->where('user_id', $targetUserId)
                        ->where('status', 'active')
                        ->orderBy('id', 'DESC')
                        ->first();

        $planModel = new PlanModel();
        $planId = !empty($json['plan_id']) ? (int)$json['plan_id'] : ($sub['plan_id'] ?? 1);
        $plan = $planModel->find($planId) ?: $planModel->getDefaultPlan();

        $extraWebsites = isset($json['extra_websites']) ? max(0, (int)$json['extra_websites']) : 0;
        $extraWebsitesPrice = round($extraWebsites * 8.00, 2);

        $extraAiTokens = isset($json['extra_ai_tokens']) ? max(0, (int)$json['extra_ai_tokens']) : 0;
        $extraAiTokensPrice = round(($extraAiTokens / 250000) * 60.00, 2);

        $newTotalAmount = round((float)$plan['price_monthly'] + $extraWebsitesPrice + $extraAiTokensPrice, 2);

        // Atualiza no Asaas
        if ($sub && !empty($sub['gateway_subscription_id'])) {
            $asaasService->updateSubscription($sub['gateway_subscription_id'], [
                'value'                 => $newTotalAmount,
                'description'           => "Assinatura Recorrente {$plan['name']} - Vexors",
                'updatePendingPayments' => false,
            ]);

            $subModel->update($sub['id'], [
                'plan_id'              => $planId,
                'price'                => $newTotalAmount,
                'extra_websites'       => $extraWebsites,
                'extra_websites_price' => $extraWebsitesPrice,
                'extra_ai_tokens'      => $extraAiTokens,
                'extra_ai_tokens_price'=> $extraAiTokensPrice,
            ]);
        }

        // Aplica limites no usuário
        UserPlanService::assignPlanToUser($targetUserId, $planId, [
            'extra_websites'        => $extraWebsites,
            'extra_websites_price'  => $extraWebsitesPrice,
            'extra_ai_tokens'       => $extraAiTokens,
            'extra_ai_tokens_price' => $extraAiTokensPrice,
        ]);

        $updatedDetails = UserPlanService::getUserPlanDetails($targetUserId);

        return $this->respond([
            'status'       => 200,
            'paid'         => true,
            'success'      => true,
            'message'      => 'Pagamento confirmado com sucesso! Seus novos limites já estão ativos.',
            'plan_details' => $updatedDetails,
        ]);
    }
}
