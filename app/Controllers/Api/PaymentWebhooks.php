<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\PaymentTransactionModel;
use App\Models\SubscriptionModel;
use App\Services\Payment\AsaasService;
use App\Services\UserPlanService;

class PaymentWebhooks extends ResourceController
{
    protected $format = 'json';

    /**
     * POST /api/public/webhooks/asaas
     * Endpoint receptor dos webhooks do Asaas
     */
    public function asaas()
    {
        $asaasService = new AsaasService();

        // 1. Validação de token de segurança do webhook
        $receivedToken = $this->request->getHeaderLine('asaas-access-token');
        if (!$asaasService->validateWebhookToken($receivedToken)) {
            log_message('warning', '[Webhook Asaas] Token de acesso inválido ou rejeitado.');
            return $this->failUnauthorized('Token de webhook inválido.');
        }

        $json = $this->request->getJSON(true);
        if (empty($json) || empty($json['event'])) {
            return $this->fail('Payload do webhook inválido.', 400);
        }

        $event   = $json['event'];
        $payment = $json['payment'] ?? [];
        $paymentId = $payment['id'] ?? null;

        log_message('info', "[Webhook Asaas] Evento recebido: {$event} para pagamento {$paymentId}");

        if (empty($paymentId)) {
            return $this->respond(['received' => true, 'message' => 'Evento sem ID de pagamento ignorado.']);
        }

        $now = date('Y-m-d H:i:s');

        $transactionModel = new PaymentTransactionModel();
        $trans = $transactionModel->findByGatewayId($paymentId);

        if (!$trans) {
            // Se a transação não foi encontrada mas o pagamento pertence a uma assinatura existente (renovação mensal)
            $gatewaySubId = $payment['subscription'] ?? null;
            if (!empty($gatewaySubId)) {
                $subModel = new SubscriptionModel();
                $sub = $subModel->where('gateway_subscription_id', $gatewaySubId)->first();
                if ($sub) {
                    // Criar registro da transação recorrente no banco
                    $newTransId = $transactionModel->insert([
                        'user_id'                => $sub['user_id'],
                        'subscription_id'        => $sub['id'],
                        'plan_id'                => $sub['plan_id'],
                        'gateway'                => 'asaas',
                        'gateway_transaction_id' => $paymentId,
                        'amount'                 => (float)($payment['value'] ?? $sub['price']),
                        'payment_method'         => 'pix',
                        'status'                 => 'pending',
                        'invoice_url'            => $payment['invoiceUrl'] ?? null,
                    ]);
                    $trans = $transactionModel->find($newTransId);
                }
            }

            if (!$trans) {
                // Verificar se é um evento de cancelamento direto da assinatura
                if (in_array($event, ['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'], true)) {
                    $asaasSubId = $json['subscription']['id'] ?? ($payment['subscription'] ?? ($json['id'] ?? null));
                    if ($asaasSubId) {
                        $subModel = new SubscriptionModel();
                        $sub = $subModel->where('gateway_subscription_id', $asaasSubId)->first();
                        if ($sub && $sub['status'] === 'active') {
                            $subModel->update($sub['id'], [
                                'status'      => 'canceled',
                                'canceled_at' => $now,
                            ]);
                            log_message('info', "[Webhook Asaas] Assinatura {$sub['id']} marcada como cancelada via webhook. Acesso mantido até {$sub['current_period_end']}.");
                        }
                    }
                    return $this->respond(['received' => true, 'event' => $event]);
                }

                log_message('notice', "[Webhook Asaas] Transação {$paymentId} não encontrada no banco local.");
                return $this->respond(['received' => true, 'warning' => 'Transação não cadastrada localmente.']);
            }
        }

        switch ($event) {
            case 'PAYMENT_RECEIVED':
            case 'PAYMENT_CONFIRMED':
                // IDEMPOTÊNCIA: Se já processado como pago, não reprocessa
                if ($trans['status'] === 'paid') {
                    return $this->respond([
                        'received'          => true,
                        'already_processed' => true,
                    ]);
                }

                // 1. Atualizar transação para paga
                $transactionModel->update($trans['id'], [
                    'status'  => 'paid',
                    'paid_at' => $now,
                ]);

                // 2. Ativar assinatura e vincular plano ao usuário
                if (!empty($trans['subscription_id'])) {
                    $subModel = new SubscriptionModel();
                    $sub = $subModel->find($trans['subscription_id']);
                    if ($sub) {
                        $subModel->update($sub['id'], [
                            'status'               => 'active',
                            'current_period_start' => $now,
                            'current_period_end'   => date('Y-m-d H:i:s', strtotime('+30 days')),
                        ]);

                        UserPlanService::assignPlanToUser((int)$trans['user_id'], (int)$trans['plan_id'], [
                            'extra_websites'        => (int)($sub['extra_websites'] ?? 0),
                            'extra_websites_price'  => (float)($sub['extra_websites_price'] ?? 0.00),
                            'extra_ai_tokens'       => (int)($sub['extra_ai_tokens'] ?? 0),
                            'extra_ai_tokens_price' => (float)($sub['extra_ai_tokens_price'] ?? 0.00),
                        ]);
                    }
                } else {
                    UserPlanService::assignPlanToUser((int)$trans['user_id'], (int)$trans['plan_id']);
                }

                log_message('info', "[Webhook Asaas] Pagamento {$paymentId} confirmado! Usuário {$trans['user_id']} ativado com plano {$trans['plan_id']}.");
                break;

            case 'PAYMENT_OVERDUE':
                $transactionModel->update($trans['id'], ['status' => 'failed']);
                if (!empty($trans['subscription_id'])) {
                    $subModel = new SubscriptionModel();
                    $subModel->update($trans['subscription_id'], ['status' => 'past_due']);
                }
                break;

            case 'PAYMENT_REFUNDED':
                $transactionModel->update($trans['id'], ['status' => 'refunded']);
                if (!empty($trans['subscription_id'])) {
                    $subModel = new SubscriptionModel();
                    $subModel->update($trans['subscription_id'], [
                        'status'      => 'canceled',
                        'canceled_at' => $now,
                    ]);
                }
                break;
        }

        return $this->respond([
            'received' => true,
            'event'    => $event,
        ]);
    }
}
