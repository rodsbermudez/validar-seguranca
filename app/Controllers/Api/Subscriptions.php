<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\SubscriptionModel;
use App\Models\UserModel;
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
}
