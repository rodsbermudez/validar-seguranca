<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\UserModel;
use App\Models\PlanModel;
use App\Models\SubscriptionModel;
use App\Models\PaymentTransactionModel;
use App\Models\SettingsModel;
use App\Services\Payment\AsaasService;
use App\Services\UserPlanService;
use App\Libraries\JWTAuth;

class Checkout extends ResourceController
{
    protected $format = 'json';

    /**
     * POST /api/public/checkout/initiate
     * Cria conta (se novo), inicia assinatura e gera o Pix no Asaas
     */
    public function initiate()
    {
        $json = $this->request->getJSON(true) ?? $this->request->getPost();

        $planId = (int)($json['plan_id'] ?? 0);
        if (!$planId) {
            return $this->fail('O identificador do plano é obrigatório.', 400);
        }

        $planModel = new PlanModel();
        $plan = $planModel->find($planId);
        if (!$plan || (int)$plan['is_active'] !== 1) {
            return $this->fail('Plano selecionado não encontrado ou indisponível.', 404);
        }

        $name     = trim($json['name'] ?? '');
        $email    = strtolower(trim($json['email'] ?? ''));
        $cpfCnpj  = preg_replace('/\D/', '', $json['cpf_cnpj'] ?? '');
        $phone    = preg_replace('/\D/', '', $json['phone'] ?? '');
        $password = $json['password'] ?? '';

        if (empty($name)) {
            return $this->fail('O nome completo é obrigatório.', 400);
        }
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->fail('Um endereço de e-mail válido é obrigatório.', 400);
        }
        if (empty($cpfCnpj) || (strlen($cpfCnpj) !== 11 && strlen($cpfCnpj) !== 14)) {
            return $this->fail('CPF ou CNPJ válido é obrigatório.', 400);
        }

        // Add-ons opcionais
        $extraWebsites      = max(0, (int)($json['extra_websites'] ?? 0));
        $extraWebsitesPrice = max(0, (float)($json['extra_websites_price'] ?? 0.00));
        $extraAiTokens      = max(0, (int)($json['extra_ai_tokens'] ?? 0));
        $extraAiTokensPrice = max(0, (float)($json['extra_ai_tokens_price'] ?? 0.00));

        $basePrice   = (float)$plan['price_monthly'];
        $totalAmount = $basePrice + $extraWebsitesPrice + $extraAiTokensPrice;

        $userModel = new UserModel();
        $existingUser = $userModel->where('email', $email)->first();

        // Usuário autenticado via JWT (se houver)
        $authUser = $this->request->userData ?? null;
        $isNewSignup = !empty($json['is_new_signup']);

        if ($existingUser) {
            // Se for novo cadastro ou usuário não autenticado como o proprietário da conta:
            // Bloqueia e instrui a fazer login
            if ($isNewSignup || !$authUser || (int)$authUser->id !== (int)$existingUser['id']) {
                return $this->respond([
                    'status'      => 409,
                    'user_exists' => true,
                    'message'     => 'Este e-mail já possui cadastro na plataforma. Por favor, faça login com sua conta para contratar ou gerenciar sua assinatura.',
                ], 409);
            }
            $userId = (int)$existingUser['id'];
            $user = $existingUser;

            // Atualiza telefone/cpf se faltava
            $updateUser = [];
            if (empty($user['cpf_cnpj']) && !empty($cpfCnpj)) $updateUser['cpf_cnpj'] = $cpfCnpj;
            if (empty($user['phone']) && !empty($phone)) $updateUser['phone'] = $phone;
            if (!empty($updateUser)) {
                $userModel->update($userId, $updateUser);
                $user = array_merge($user, $updateUser);
            }
        } else {
            // Novo Usuário: validação de senha
            if (empty($password) || strlen($password) < 6) {
                return $this->fail('Defina uma senha de acesso com no mínimo 6 caracteres.', 400);
            }

            $userId = $userModel->insert([
                'name'          => $name,
                'email'         => $email,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'role'          => 'user',
                'is_active'     => 1,
                'plan_id'       => $planId,
                'cpf_cnpj'      => $cpfCnpj,
                'phone'         => $phone,
            ]);

            $user = $userModel->find($userId);
        }

        // Caso Especial: Plano Gratuito (R$ 0,00)
        if ($totalAmount <= 0.00) {
            $subscriptionModel = new SubscriptionModel();
            $existingActiveSubs = $subscriptionModel->where('user_id', $userId)
                                                    ->where('status', 'active')
                                                    ->findAll();
            $asaasService = new AsaasService();
            foreach ($existingActiveSubs as $prevSub) {
                if (!empty($prevSub['gateway_subscription_id']) && ($prevSub['gateway'] ?? '') === 'asaas') {
                    $asaasService->cancelSubscription($prevSub['gateway_subscription_id']);
                }
                $subscriptionModel->update($prevSub['id'], [
                    'status'      => 'canceled',
                    'canceled_at' => date('Y-m-d H:i:s'),
                ]);
            }

            $subId = $subscriptionModel->insert([
                'user_id'                 => $userId,
                'plan_id'                 => $planId,
                'status'                  => 'active',
                'gateway'                 => 'internal',
                'gateway_customer_id'     => null,
                'gateway_subscription_id' => 'free_' . $userId . '_' . time(),
                'billing_cycle'           => 'monthly',
                'price'                   => 0.00,
                'extra_websites'          => 0,
                'extra_websites_price'    => 0.00,
                'extra_ai_tokens'         => 0,
                'extra_ai_tokens_price'   => 0.00,
                'current_period_start'    => date('Y-m-d H:i:s'),
                'current_period_end'      => date('Y-m-d H:i:s', strtotime('+1 year')),
            ]);

            UserPlanService::assignPlanToUser($userId, $planId, [
                'extra_websites'        => 0,
                'extra_websites_price'  => 0.00,
                'extra_ai_tokens'       => 0,
                'extra_ai_tokens_price' => 0.00,
            ]);

            $token = JWTAuth::generateToken($user);

            return $this->respond([
                'status'          => 200,
                'success'         => true,
                'activated'       => true,
                'free_plan'       => true,
                'subscription_id' => $subId,
                'token'           => $token,
                'user'            => [
                    'id'    => $user['id'],
                    'name'  => $user['name'],
                    'email' => $user['email'],
                    'role'  => $user['role'] ?? 'user',
                ],
                'message'         => 'Assinatura do plano gratuito ativada com sucesso! Bem-vindo ao Vexors.',
            ]);
        }

        // Integração Asaas
        $asaasService = new AsaasService();

        // Obter ou criar cliente no Asaas
        $customerRes = $asaasService->getOrCreateCustomer([
            'name'     => $name,
            'email'    => $email,
            'cpf_cnpj' => $cpfCnpj,
            'phone'    => $phone,
        ]);

        $asaasCustomerId = $customerRes['customer_id'] ?? null;
        if ($asaasCustomerId && empty($user['asaas_customer_id'])) {
            $userModel->update($userId, ['asaas_customer_id' => $asaasCustomerId]);
        }

        $paymentMethods = SettingsModel::getPaymentMethods();
        $rawBillingType = strtoupper(trim($json['billing_type'] ?? ''));
        if (empty($rawBillingType)) {
            $billingType = $paymentMethods['credit_card'] ? 'CREDIT_CARD' : 'PIX';
        } else {
            $billingType = $rawBillingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';
        }

        if ($billingType === 'PIX' && empty($paymentMethods['pix'])) {
            return $this->fail('O pagamento via Pix está temporariamente desativado. Por favor, utilize Cartão de Crédito.', 400);
        }
        if ($billingType === 'CREDIT_CARD' && empty($paymentMethods['credit_card'])) {
            return $this->fail('O pagamento via Cartão de Crédito está desativado no momento. Por favor, utilize Pix.', 400);
        }

        // Garantia Anti-Duplicação: cancela assinatura anterior ativa no Asaas e banco antes de criar nova
        $subscriptionModel = new SubscriptionModel();
        $existingActiveSubs = $subscriptionModel->where('user_id', $userId)
                                                ->where('status', 'active')
                                                ->findAll();
        foreach ($existingActiveSubs as $prevSub) {
            if (!empty($prevSub['gateway_subscription_id'])) {
                $asaasService->cancelSubscription($prevSub['gateway_subscription_id']);
            }
            $subscriptionModel->update($prevSub['id'], [
                'status'      => 'canceled',
                'canceled_at' => date('Y-m-d H:i:s'),
            ]);
        }

        // Criar registro de assinatura pendente
        $subId = $subscriptionModel->insert([
            'user_id'                 => $userId,
            'plan_id'                 => $planId,
            'status'                  => 'pending',
            'gateway'                 => 'asaas',
            'gateway_customer_id'     => $asaasCustomerId,
            'billing_cycle'           => 'monthly',
            'price'                   => $totalAmount,
            'extra_websites'          => $extraWebsites,
            'extra_websites_price'    => $extraWebsitesPrice,
            'extra_ai_tokens'         => $extraAiTokens,
            'extra_ai_tokens_price'   => $extraAiTokensPrice,
        ]);

        $description = "Assinatura Recorrente {$plan['name']} - Vexors";
        $extRef = "sub_{$subId}_usr_{$userId}";

        if ($billingType === 'CREDIT_CARD') {
            $creditCard = $json['credit_card'] ?? [];
            $holderName  = trim($creditCard['holder_name'] ?? '');
            $cardNumber  = preg_replace('/\D/', '', $creditCard['number'] ?? '');
            $expiryMonth = trim($creditCard['expiry_month'] ?? '');
            $expiryYear  = trim($creditCard['expiry_year'] ?? '');
            $ccv         = trim($creditCard['ccv'] ?? '');
            $postalCode  = preg_replace('/\D/', '', $json['postal_code'] ?? ($creditCard['postal_code'] ?? ''));
            $addressNum  = trim($json['address_number'] ?? ($creditCard['address_number'] ?? 'S/N'));

            if (empty($holderName) || empty($cardNumber) || empty($expiryMonth) || empty($expiryYear) || empty($ccv)) {
                return $this->fail('Todos os dados do cartão de crédito (titular, número, validade e CVV) são obrigatórios.', 400);
            }

            $creditCardPayload = [
                'holder_name'  => $holderName,
                'number'       => $cardNumber,
                'expiry_month' => $expiryMonth,
                'expiry_year'  => $expiryYear,
                'ccv'          => $ccv,
            ];

            $creditCardHolderInfo = [
                'name'           => $holderName,
                'email'          => $email,
                'cpf_cnpj'       => $cpfCnpj,
                'postal_code'    => $postalCode ?: '01310000',
                'address_number' => $addressNum ?: 'S/N',
                'phone'          => $phone,
            ];

            $subRes = $asaasService->createSubscription(
                $asaasCustomerId ?: 'cus_sim',
                $totalAmount,
                $description,
                $extRef,
                date('Y-m-d'),
                'CREDIT_CARD',
                $creditCardPayload,
                $creditCardHolderInfo
            );

            if (!$subRes['success']) {
                return $this->fail('Falha ao processar assinatura no cartão: ' . ($subRes['message'] ?? 'Cartão recusado'), 400);
            }

            $asaasSubId = $subRes['subscription_id'] ?? null;
            $paymentId  = $subRes['payment_id'] ?? ('pay_' . uniqid());
            $isCardApproved = in_array(strtoupper($subRes['payment_status'] ?? ''), ['CONFIRMED', 'RECEIVED', 'ACTIVE'], true);

            $now = date('Y-m-d H:i:s');
            if ($asaasSubId) {
                $subscriptionModel->update($subId, [
                    'gateway_subscription_id' => $asaasSubId,
                    'status'                  => $isCardApproved ? 'active' : 'pending',
                    'current_period_start'    => $isCardApproved ? $now : null,
                    'current_period_end'      => $isCardApproved ? date('Y-m-d H:i:s', strtotime('+30 days')) : null,
                ]);
            }

            $transactionModel = new PaymentTransactionModel();
            $transId = $transactionModel->insert([
                'user_id'                => $userId,
                'subscription_id'        => $subId,
                'plan_id'                => $planId,
                'gateway'                => 'asaas',
                'gateway_transaction_id' => $paymentId,
                'amount'                 => $totalAmount,
                'payment_method'         => 'credit_card',
                'status'                 => $isCardApproved ? 'paid' : 'pending',
                'paid_at'                => $isCardApproved ? $now : null,
                'invoice_url'            => $subRes['invoice_url'] ?? null,
                'metadata'               => json_encode([
                    'plan_name'             => $plan['name'],
                    'billing_type'          => 'CREDIT_CARD',
                    'card_last4'            => $subRes['card_last4'] ?? substr($cardNumber, -4),
                    'card_brand'            => $subRes['card_brand'] ?? 'MASTERCARD',
                    'extra_websites'        => $extraWebsites,
                    'extra_websites_price'  => $extraWebsitesPrice,
                    'extra_ai_tokens'       => $extraAiTokens,
                    'extra_ai_tokens_price' => $extraAiTokensPrice,
                    'simulated'             => !empty($subRes['simulated']),
                ]),
            ]);

            if ($isCardApproved) {
                UserPlanService::assignPlanToUser($userId, $planId, [
                    'extra_websites'        => $extraWebsites,
                    'extra_websites_price'  => $extraWebsitesPrice,
                    'extra_ai_tokens'       => $extraAiTokens,
                    'extra_ai_tokens_price' => $extraAiTokensPrice,
                ]);
            }

            $token = JWTAuth::generateToken($user);

            return $this->respond([
                'status'                 => 200,
                'success'                => true,
                'billing_type'           => 'CREDIT_CARD',
                'activated'              => $isCardApproved,
                'transaction_id'         => $transId,
                'subscription_id'        => $subId,
                'gateway_transaction_id' => $paymentId,
                'amount'                 => $totalAmount,
                'plan_name'              => $plan['name'],
                'card_last4'             => $subRes['card_last4'] ?? substr($cardNumber, -4),
                'card_brand'             => $subRes['card_brand'] ?? 'MASTERCARD',
                'is_simulated'           => !empty($subRes['simulated']),
                'token'                  => $token,
                'user'                   => [
                    'id'    => $user['id'],
                    'name'  => $user['name'],
                    'email' => $user['email'],
                    'role'  => $user['role'] ?? 'user',
                ],
            ]);
        }

        // Fluxo PIX:
        $subRes = $asaasService->createSubscription(
            $asaasCustomerId ?: 'cus_sim',
            $totalAmount,
            $description,
            $extRef,
            date('Y-m-d', strtotime('+1 day')),
            'PIX'
        );

        if (!$subRes['success']) {
            return $this->fail('Falha ao gerar assinatura no Asaas: ' . ($subRes['message'] ?? 'Erro desconhecido'), 500);
        }

        $asaasSubId = $subRes['subscription_id'] ?? null;
        $paymentId  = $subRes['payment_id'] ?? null;

        if ($asaasSubId) {
            $subscriptionModel->update($subId, [
                'gateway_subscription_id' => $asaasSubId,
            ]);
        }

        // Se o Asaas não retornou a cobrança inicial diretamente, gera fallback
        if (empty($paymentId)) {
            $paymentRes = $asaasService->createPaymentPix(
                $asaasCustomerId ?: 'cus_sim',
                $totalAmount,
                $description,
                $extRef
            );
            $paymentId = $paymentRes['payment_id'] ?? null;
            $invoiceUrl = $paymentRes['invoice_url'] ?? null;
        } else {
            $invoiceUrl = $subRes['invoice_url'] ?? null;
        }

        // Buscar QR Code e chave Pix Copia e Cola
        $qrRes = $asaasService->getPixQrCode($paymentId);
        $pixQrCode    = $qrRes['encoded_image'] ?? null;
        $pixCopyPaste = $qrRes['payload'] ?? null;
        $pixExp       = $qrRes['expiration_date'] ?? date('Y-m-d H:i:s', strtotime('+24 hours'));

        // Salvar transação
        $transactionModel = new PaymentTransactionModel();
        $transId = $transactionModel->insert([
            'user_id'                => $userId,
            'subscription_id'        => $subId,
            'plan_id'                => $planId,
            'gateway'                => 'asaas',
            'gateway_transaction_id' => $paymentId,
            'amount'                 => $totalAmount,
            'payment_method'         => 'pix',
            'status'                 => 'pending',
            'pix_qr_code'            => $pixQrCode,
            'pix_copy_paste'         => $pixCopyPaste,
            'pix_expiration'         => $pixExp,
            'invoice_url'            => $invoiceUrl,
            'metadata'               => json_encode([
                'plan_name'             => $plan['name'],
                'billing_type'          => 'PIX',
                'extra_websites'        => $extraWebsites,
                'extra_websites_price'  => $extraWebsitesPrice,
                'extra_ai_tokens'       => $extraAiTokens,
                'extra_ai_tokens_price' => $extraAiTokensPrice,
                'simulated'             => !empty($subRes['simulated']),
            ]),
        ]);

        // Gerar token de sessão JWT para o usuário
        $token = JWTAuth::generateToken($user);

        return $this->respond([
            'status'                 => 200,
            'success'                => true,
            'billing_type'           => 'PIX',
            'activated'              => false,
            'transaction_id'         => $transId,
            'subscription_id'        => $subId,
            'gateway_transaction_id' => $paymentId,
            'amount'                 => $totalAmount,
            'plan_name'              => $plan['name'],
            'pix_qr_code'            => $pixQrCode,
            'pix_copy_paste'         => $pixCopyPaste,
            'pix_expiration'         => $pixExp,
            'invoice_url'            => $invoiceUrl,
            'is_simulated'           => !empty($subRes['simulated']),
            'token'                  => $token,
            'user'                   => [
                'id'    => $user['id'],
                'name'  => $user['name'],
                'email' => $user['email'],
                'role'  => $user['role'] ?? 'user',
            ],
        ]);
    }

    /**
     * GET /api/public/checkout/status/(:segment)
     * Verifica o status do pagamento pelo ID da transação ou gateway_transaction_id
     */
    public function status($identifier = null)
    {
        if (!$identifier) {
            return $this->fail('Identificador da transação não fornecido.', 400);
        }

        $transactionModel = new PaymentTransactionModel();
        $trans = $transactionModel->where('gateway_transaction_id', $identifier)
            ->orWhere('id', is_numeric($identifier) ? (int)$identifier : 0)
            ->first();

        if (!$trans) {
            return $this->failNotFound('Transação não encontrada.');
        }

        // Se já está pago, confirma
        if ($trans['status'] === 'paid') {
            return $this->respond([
                'status'         => 'paid',
                'activated'      => true,
                'transaction_id' => $trans['id'],
                'paid_at'        => $trans['paid_at'],
            ]);
        }

        // Se está pendente e não é simulado, consulta o gateway Asaas
        $asaasService = new AsaasService();
        $statusRes = $asaasService->getPaymentStatus($trans['gateway_transaction_id']);

        $asaasStatus = strtoupper($statusRes['status'] ?? 'PENDING');
        if (in_array($asaasStatus, ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'], true)) {
            // Pagamento confirmado pelo Asaas!
            $now = date('Y-m-d H:i:s');
            $transactionModel->update($trans['id'], [
                'status'  => 'paid',
                'paid_at' => $now,
            ]);

            // Ativar assinatura
            if (!empty($trans['subscription_id'])) {
                $subModel = new SubscriptionModel();
                $sub = $subModel->find($trans['subscription_id']);
                if ($sub) {
                    $subModel->update($sub['id'], [
                        'status'               => 'active',
                        'current_period_start' => $now,
                        'current_period_end'   => date('Y-m-d H:i:s', strtotime('+30 days')),
                    ]);

                    // Atribuir plano e add-ons ao usuário
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

            return $this->respond([
                'status'         => 'paid',
                'activated'      => true,
                'transaction_id' => $trans['id'],
                'paid_at'        => $now,
            ]);
        }

        return $this->respond([
            'status'         => 'pending',
            'activated'      => false,
            'transaction_id' => $trans['id'],
        ]);
    }

    /**
     * POST /api/public/checkout/simulate-confirm/(:segment)
     * Rota de conveniência em sandbox/desenvolvimento para simular pagamento de Pix instantâneo
     */
    public function simulateConfirm($identifier = null)
    {
        if (!$identifier) {
            return $this->fail('Identificador não fornecido.', 400);
        }

        $transactionModel = new PaymentTransactionModel();
        $trans = $transactionModel->where('gateway_transaction_id', $identifier)
            ->orWhere('id', is_numeric($identifier) ? (int)$identifier : 0)
            ->first();

        if (!$trans) {
            return $this->failNotFound('Transação não encontrada.');
        }

        $now = date('Y-m-d H:i:s');
        $transactionModel->update($trans['id'], [
            'status'  => 'paid',
            'paid_at' => $now,
        ]);

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

        return $this->respond([
            'status'         => 200,
            'message'        => 'Pagamento Pix simulado e confirmado com sucesso!',
            'transaction_id' => $trans['id'],
            'activated'      => true,
        ]);
    }

    /**
     * POST /api/public/checkout/check-email
     * Verifica se um e-mail já está cadastrado na plataforma para feedback instantâneo no checkout.
     */
    public function checkEmail()
    {
        $json = $this->request->getJSON(true) ?? [];
        $email = strtolower(trim($json['email'] ?? ''));

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->respond([
                'status'  => 400,
                'valid'   => false,
                'exists'  => false,
                'message' => 'Informe um e-mail válido.',
            ], 400);
        }

        $userModel = new UserModel();
        $user = $userModel->where('email', $email)->first();

        if ($user) {
            return $this->respond([
                'status'      => 200,
                'valid'       => true,
                'exists'      => true,
                'user_name'   => $user['name'] ?? null,
                'message'     => 'Este e-mail já possui cadastro na plataforma. Faça login com sua conta para gerenciar seu plano.',
            ]);
        }

        return $this->respond([
            'status'  => 200,
            'valid'   => true,
            'exists'  => false,
            'message' => 'E-mail disponível para novo cadastro.',
        ]);
    }
}
