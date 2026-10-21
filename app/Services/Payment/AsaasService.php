<?php

namespace App\Services\Payment;

use App\Models\SettingsModel;

class AsaasService
{
    protected ?string $apiKey;
    protected string $environment;
    protected ?string $webhookSecret;
    protected string $baseUrl;

    public function __construct()
    {
        $this->apiKey = SettingsModel::getSetting('asaas_api_key', env('ASAAS_API_KEY') ?: '');
        $this->environment = SettingsModel::getSetting('asaas_environment', env('ASAAS_ENVIRONMENT') ?: 'sandbox');
        $this->webhookSecret = SettingsModel::getSetting('asaas_webhook_secret', env('ASAAS_WEBHOOK_SECRET') ?: '');

        if ($this->environment === 'production') {
            $this->baseUrl = 'https://api.asaas.com/v3';
        } else {
            $this->baseUrl = 'https://sandbox.asaas.com/api/v3';
        }
    }

    /**
     * Verifica se a API do Asaas possui chave configurada
     */
    public function isConfigured(): bool
    {
        return !empty($this->apiKey) && strlen(trim($this->apiKey)) > 10;
    }

    public function getEnvironment(): string
    {
        return $this->environment;
    }

    public function getWebhookSecret(): ?string
    {
        return $this->webhookSecret;
    }

    /**
     * Valida o token recebido no header 'asaas-access-token'
     */
    public function validateWebhookToken(?string $token): bool
    {
        if (empty($this->webhookSecret)) {
            // Se nenhum segredo foi configurado no sistema, aceita durante homologação inicial
            return true;
        }

        return hash_equals($this->webhookSecret, (string)$token);
    }

    /**
     * Extrai o IP público real do cliente pagador (obrigatório para análise de risco de cartão)
     */
    public function getClientIp(?string $providedIp = null): string
    {
        if (!empty($providedIp) && filter_var($providedIp, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return $providedIp;
        }

        $ipSources = [
            $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
            $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null,
            $_SERVER['HTTP_X_REAL_IP'] ?? null,
            $_SERVER['REMOTE_ADDR'] ?? null,
        ];

        foreach ($ipSources as $ipList) {
            if (empty($ipList)) continue;
            $ips = explode(',', $ipList);
            foreach ($ips as $candidate) {
                $candidate = trim($candidate);
                if (filter_var($candidate, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $candidate;
                }
            }
        }

        // Em localhost/ambiente de testes/privado, retorna um IP público padrão para evitar recusa pelo antifraude
        return '177.18.20.10';
    }

    /**
     * Executa requisição HTTP cURL para a API do Asaas
     */
    protected function request(string $endpoint, string $method = 'GET', array $data = []): array
    {
        $url = rtrim($this->baseUrl, '/') . '/' . ltrim($endpoint, '/');

        $headers = [
            'Content-Type: application/json',
            'access_token: ' . $this->apiKey,
            'User-Agent: ValidarSeguranca/1.0',
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        if (strtoupper($method) === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif (strtoupper($method) === 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif (strtoupper($method) === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            return [
                'success' => false,
                'status'  => 500,
                'message' => 'Erro de conexão com o Asaas: ' . $error,
            ];
        }

        $decoded = json_decode($response, true);
        if ($httpCode >= 200 && $httpCode < 300) {
            return [
                'success' => true,
                'status'  => $httpCode,
                'data'    => $decoded,
            ];
        }

        $errorMessage = 'Erro no Asaas';
        if (isset($decoded['errors']) && is_array($decoded['errors'])) {
            $messages = array_column($decoded['errors'], 'description');
            $errorMessage = implode('; ', $messages);
        } elseif (isset($decoded['message'])) {
            $errorMessage = $decoded['message'];
        }

        return [
            'success' => false,
            'status'  => $httpCode,
            'message' => $errorMessage,
            'data'    => $decoded,
        ];
    }

    /**
     * Localiza ou cria um cliente no Asaas
     */
    public function getOrCreateCustomer(array $params): array
    {
        $name    = trim($params['name'] ?? '');
        $email   = trim($params['email'] ?? '');
        $cpfCnpj = preg_replace('/\D/', '', $params['cpf_cnpj'] ?? '');
        $phone   = preg_replace('/\D/', '', $params['phone'] ?? '');

        if (!$this->isConfigured()) {
            // Modo Simulação para desenvolvimento / sem chave Asaas
            return [
                'success'     => true,
                'customer_id' => 'cus_sim_' . md5($email ?: uniqid()),
                'simulated'   => true,
            ];
        }

        // 1. Tentar buscar cliente existente pelo e-mail
        if (!empty($email)) {
            $search = $this->request('customers?email=' . urlencode($email));
            if ($search['success'] && !empty($search['data']['data'][0]['id'])) {
                return [
                    'success'     => true,
                    'customer_id' => $search['data']['data'][0]['id'],
                    'data'        => $search['data']['data'][0],
                    'simulated'   => false,
                ];
            }
        }

        // 2. Criar novo cliente
        $payload = [
            'name'                 => $name,
            'email'                => $email,
            'cpfCnpj'              => !empty($cpfCnpj) ? $cpfCnpj : null,
            'mobilePhone'          => !empty($phone) ? $phone : null,
            'notificationDisabled' => false,
        ];

        if (!empty($params['postal_code'])) $payload['postalCode'] = preg_replace('/\D/', '', $params['postal_code']);
        if (!empty($params['address'])) $payload['address'] = trim($params['address']);
        if (!empty($params['address_number'])) $payload['addressNumber'] = trim($params['address_number']);
        if (!empty($params['complement'])) $payload['complement'] = trim($params['complement']);
        if (!empty($params['province'])) $payload['province'] = trim($params['province']);

        $creation = $this->request('customers', 'POST', $payload);
        if (!$creation['success']) {
            return $creation;
        }

        return [
            'success'     => true,
            'customer_id' => $creation['data']['id'],
            'data'        => $creation['data'],
            'simulated'   => false,
        ];
    }

    /**
     * Cria uma cobrança Pix no Asaas
     */
    public function createPaymentPix(string $customerId, float $amount, string $description, string $externalReference, ?string $dueDate = null): array
    {
        if (empty($dueDate)) {
            $dueDate = date('Y-m-d', strtotime('+1 day'));
        }

        if (!$this->isConfigured()) {
            // Modo Simulação
            $simPayId = 'pay_sim_' . uniqid();
            return [
                'success'           => true,
                'payment_id'        => $simPayId,
                'status'            => 'PENDING',
                'amount'            => $amount,
                'invoice_url'       => 'https://sandbox.asaas.com/simulated/' . $simPayId,
                'simulated'         => true,
            ];
        }

        $payload = [
            'customer'          => $customerId,
            'billingType'       => 'PIX',
            'value'             => round($amount, 2),
            'dueDate'           => $dueDate,
            'description'       => $description,
            'externalReference' => $externalReference,
        ];

        $response = $this->request('payments', 'POST', $payload);
        if (!$response['success']) {
            return $response;
        }

        $paymentData = $response['data'];
        return [
            'success'     => true,
            'payment_id'  => $paymentData['id'],
            'status'      => $paymentData['status'],
            'amount'      => (float) $paymentData['value'],
            'invoice_url' => $paymentData['invoiceUrl'] ?? null,
            'data'        => $paymentData,
            'simulated'   => false,
        ];
    }

    /**
     * Obtém o QR Code e chave Copia e Cola para uma cobrança Pix existente
     */
    public function getPixQrCode(string $paymentId): array
    {
        if (!$this->isConfigured() || str_starts_with($paymentId, 'pay_sim_')) {
            // Gera chave e QR Code simulados para teste visual
            $mockCopyPaste = '00020101021226830014br.gov.bcb.pix2561pix.asaas.com/qr/v2/' . $paymentId . '5204000053039865802BR5911Vexors Saas6009Sao Paulo62070503***6304ABCD';
            
            // SVG QR Code simplificado convertido para base64
            $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" fill="#ffffff"/><rect x="20" y="20" width="40" height="40" fill="#000000"/><rect x="140" y="20" width="40" height="40" fill="#000000"/><rect x="20" y="140" width="40" height="40" fill="#000000"/><rect x="70" y="70" width="60" height="60" fill="#4f46e5"/><text x="100" y="105" font-family="sans-serif" font-size="12" fill="#ffffff" text-anchor="middle" font-weight="bold">PIX ASAAS</text><text x="100" y="185" font-family="sans-serif" font-size="10" fill="#666666" text-anchor="middle">Modo Homologação</text></svg>';
            $encodedImage = 'data:image/svg+xml;base64,' . base64_encode($svg);

            return [
                'success'        => true,
                'encoded_image'  => $encodedImage,
                'payload'        => $mockCopyPaste,
                'expiration_date'=> date('Y-m-d H:i:s', strtotime('+24 hours')),
                'simulated'      => true,
            ];
        }

        $response = $this->request('payments/' . $paymentId . '/pixQrCode');
        if (!$response['success']) {
            return $response;
        }

        $data = $response['data'];
        $encodedImage = $data['encodedImage'] ?? null;
        if ($encodedImage && !str_starts_with($encodedImage, 'data:image')) {
            $encodedImage = 'data:image/png;base64,' . $encodedImage;
        }

        return [
            'success'        => true,
            'encoded_image'  => $encodedImage,
            'payload'        => $data['payload'] ?? '',
            'expiration_date'=> $data['expirationDate'] ?? null,
            'simulated'      => false,
        ];
    }

    /**
     * Consulta o status atual de um pagamento no Asaas
     */
    public function getPaymentStatus(string $paymentId): array
    {
        if (!$this->isConfigured() || str_starts_with($paymentId, 'pay_sim_')) {
            return [
                'success'   => true,
                'status'    => 'PENDING',
                'simulated' => true,
            ];
        }

        $response = $this->request('payments/' . $paymentId);
        if (!$response['success']) {
            return $response;
        }

        return [
            'success' => true,
            'status'  => $response['data']['status'] ?? 'PENDING',
            'data'    => $response['data'],
            'simulated' => false,
        ];
    }

    /**
     * Cria cobrança avulsa de cartão de crédito para pagamento de diferença pró-rata
     */
    public function createPaymentCreditCard(
        string $customerId,
        float $amount,
        string $description,
        string $externalReference,
        ?array $creditCard = null,
        ?array $creditCardHolderInfo = null,
        ?string $remoteIp = null
    ): array {
        if (!$this->isConfigured()) {
            $simPayId = 'pay_sim_' . uniqid();
            return [
                'success'        => true,
                'payment_id'     => $simPayId,
                'status'         => 'CONFIRMED',
                'payment_status' => 'CONFIRMED',
                'amount'         => round($amount, 2),
                'simulated'      => true,
            ];
        }

        $payload = [
            'customer'          => $customerId,
            'billingType'       => 'CREDIT_CARD',
            'value'             => round($amount, 2),
            'dueDate'           => date('Y-m-d'),
            'description'       => $description,
            'externalReference' => $externalReference,
        ];

        if (!empty($creditCard)) {
            $payload['remoteIp'] = $this->getClientIp($remoteIp);
            $payload['creditCard'] = [
                'holderName'  => trim($creditCard['holder_name'] ?? $creditCard['holderName'] ?? ''),
                'number'      => preg_replace('/\D/', '', $creditCard['number'] ?? ''),
                'expiryMonth' => str_pad(trim($creditCard['expiry_month'] ?? $creditCard['expiryMonth'] ?? ''), 2, '0', STR_PAD_LEFT),
                'expiryYear'  => trim($creditCard['expiry_year'] ?? $creditCard['expiryYear'] ?? ''),
                'ccv'         => trim($creditCard['ccv'] ?? ''),
            ];

            $cpf = preg_replace('/\D/', '', $creditCardHolderInfo['cpf_cnpj'] ?? $creditCardHolderInfo['cpfCnpj'] ?? $creditCard['cpf_cnpj'] ?? '');
            $phone = preg_replace('/\D/', '', $creditCardHolderInfo['phone'] ?? $creditCard['phone'] ?? '');

            // Se o CPF não foi informado e temos o customerId real do Asaas, busca no cadastro do cliente
            if (empty($cpf) && str_starts_with($customerId, 'cus_')) {
                $cusSearch = $this->request('customers/' . $customerId);
                if ($cusSearch['success'] && !empty($cusSearch['data']['cpfCnpj'])) {
                    $cpf = preg_replace('/\D/', '', $cusSearch['data']['cpfCnpj']);
                }
                if (empty($phone) && $cusSearch['success'] && !empty($cusSearch['data']['mobilePhone'])) {
                    $phone = preg_replace('/\D/', '', $cusSearch['data']['mobilePhone']);
                }
            }

            if (!empty($creditCardHolderInfo) || !empty($cpf)) {
                $payload['creditCardHolderInfo'] = [
                    'name'          => trim($creditCardHolderInfo['name'] ?? $creditCard['holder_name'] ?? ''),
                    'email'         => trim($creditCardHolderInfo['email'] ?? ''),
                    'cpfCnpj'       => $cpf,
                    'postalCode'    => preg_replace('/\D/', '', $creditCardHolderInfo['postal_code'] ?? $creditCardHolderInfo['postalCode'] ?? $creditCard['postal_code'] ?? '01310000'),
                    'addressNumber' => trim($creditCardHolderInfo['address_number'] ?? $creditCardHolderInfo['addressNumber'] ?? $creditCard['address_number'] ?? 'S/N'),
                    'phone'         => $phone,
                    'mobilePhone'   => $phone,
                ];
            }
        }

        $response = $this->request('payments', 'POST', $payload);
        if (!$response['success']) {
            return $response;
        }

        $paymentData = $response['data'];
        $status = $paymentData['status'] ?? 'PENDING';
        return [
            'success'        => true,
            'payment_id'     => $paymentData['id'],
            'status'         => $status,
            'payment_status' => $status,
            'amount'         => (float)($paymentData['value'] ?? $amount),
            'invoice_url'    => $paymentData['invoiceUrl'] ?? null,
            'simulated'      => false,
            'data'           => $paymentData,
        ];
    }

    /**
     * Cria uma assinatura recorrente no Asaas (ciclo mensal via Pix ou Cartão de Crédito)
     */
    public function createSubscription(
        string $customerId,
        float $amount,
        string $description,
        string $externalReference,
        ?string $nextDueDate = null,
        string $billingType = 'PIX',
        ?array $creditCard = null,
        ?array $creditCardHolderInfo = null,
        ?string $remoteIp = null
    ): array {
        $billingType = strtoupper(trim($billingType)) === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';

        if (empty($nextDueDate)) {
            $nextDueDate = $billingType === 'CREDIT_CARD' ? date('Y-m-d') : date('Y-m-d', strtotime('+1 day'));
        }

        if (!$this->isConfigured()) {
            $simSubId = 'sub_sim_' . uniqid();
            $simPayId = 'pay_sim_' . uniqid();
            $cleanCard = preg_replace('/\D/', '', $creditCard['number'] ?? '4242');
            $last4 = substr($cleanCard, -4) ?: '4242';

            return [
                'success'         => true,
                'subscription_id' => $simSubId,
                'payment_id'      => $simPayId,
                'status'          => 'ACTIVE',
                'payment_status'  => $billingType === 'CREDIT_CARD' ? 'CONFIRMED' : 'PENDING',
                'billing_type'    => $billingType,
                'card_last4'      => $last4,
                'card_brand'      => 'MASTERCARD',
                'amount'          => $amount,
                'invoice_url'     => 'https://sandbox.asaas.com/simulated/' . $simPayId,
                'simulated'       => true,
            ];
        }

        $payload = [
            'customer'          => $customerId,
            'billingType'       => $billingType,
            'value'             => round($amount, 2),
            'nextDueDate'       => $nextDueDate,
            'cycle'             => 'MONTHLY',
            'description'       => $description,
            'externalReference' => $externalReference,
        ];

        if ($billingType === 'CREDIT_CARD' && !empty($creditCard)) {
            $payload['remoteIp'] = $this->getClientIp($remoteIp);
            $payload['creditCard'] = [
                'holderName'  => trim($creditCard['holder_name'] ?? $creditCard['holderName'] ?? ''),
                'number'      => preg_replace('/\D/', '', $creditCard['number'] ?? ''),
                'expiryMonth' => str_pad(trim($creditCard['expiry_month'] ?? $creditCard['expiryMonth'] ?? ''), 2, '0', STR_PAD_LEFT),
                'expiryYear'  => trim($creditCard['expiry_year'] ?? $creditCard['expiryYear'] ?? ''),
                'ccv'         => trim($creditCard['ccv'] ?? ''),
            ];

            $cpf = preg_replace('/\D/', '', $creditCardHolderInfo['cpf_cnpj'] ?? $creditCardHolderInfo['cpfCnpj'] ?? $creditCard['cpf_cnpj'] ?? '');
            $phone = preg_replace('/\D/', '', $creditCardHolderInfo['phone'] ?? $creditCard['phone'] ?? '');

            if (empty($cpf) && str_starts_with($customerId, 'cus_')) {
                $cusSearch = $this->request('customers/' . $customerId);
                if ($cusSearch['success'] && !empty($cusSearch['data']['cpfCnpj'])) {
                    $cpf = preg_replace('/\D/', '', $cusSearch['data']['cpfCnpj']);
                }
                if (empty($phone) && $cusSearch['success'] && !empty($cusSearch['data']['mobilePhone'])) {
                    $phone = preg_replace('/\D/', '', $cusSearch['data']['mobilePhone']);
                }
            }

            if (!empty($creditCardHolderInfo) || !empty($cpf)) {
                $payload['creditCardHolderInfo'] = [
                    'name'          => trim($creditCardHolderInfo['name'] ?? $creditCard['holder_name'] ?? ''),
                    'email'         => trim($creditCardHolderInfo['email'] ?? ''),
                    'cpfCnpj'       => $cpf,
                    'postalCode'    => preg_replace('/\D/', '', $creditCardHolderInfo['postal_code'] ?? $creditCardHolderInfo['postalCode'] ?? $creditCard['postal_code'] ?? '01310000'),
                    'addressNumber' => trim($creditCardHolderInfo['address_number'] ?? $creditCardHolderInfo['addressNumber'] ?? $creditCard['address_number'] ?? 'S/N'),
                    'phone'         => $phone,
                    'mobilePhone'   => $phone,
                ];
            }
        }

        $response = $this->request('subscriptions', 'POST', $payload);
        if (!$response['success']) {
            return $response;
        }

        $subData = $response['data'];
        $subId = $subData['id'];

        // Buscar a cobrança inicial gerada pelo Asaas para esta assinatura
        $paymentsRes = $this->request('subscriptions/' . $subId . '/payments');
        $firstPayment = $paymentsRes['success'] && !empty($paymentsRes['data']['data'][0])
            ? $paymentsRes['data']['data'][0]
            : null;

        $paymentId = $firstPayment['id'] ?? null;
        $paymentStatus = $firstPayment['status'] ?? ($billingType === 'CREDIT_CARD' ? 'CONFIRMED' : 'PENDING');

        return [
            'success'         => true,
            'subscription_id' => $subId,
            'payment_id'      => $paymentId,
            'status'          => $subData['status'] ?? 'ACTIVE',
            'payment_status'  => $paymentStatus,
            'billing_type'    => $billingType,
            'card_last4'      => $subData['creditCard']['creditCardNumber'] ?? null,
            'card_brand'      => $subData['creditCard']['creditCardBrand'] ?? null,
            'amount'          => (float) ($subData['value'] ?? $amount),
            'invoice_url'     => $firstPayment['invoiceUrl'] ?? null,
            'data'            => $subData,
            'simulated'       => false,
        ];
    }

    /**
     * Cancela a renovação da assinatura no Asaas
     */
    public function cancelSubscription(string $subscriptionId): array
    {
        if (!$this->isConfigured() || str_starts_with($subscriptionId, 'sub_sim_')) {
            return [
                'success'   => true,
                'status'    => 'INACTIVE',
                'simulated' => true,
            ];
        }

        return $this->request('subscriptions/' . $subscriptionId, 'DELETE');
    }

    /**
     * Atualiza o valor ou dados de uma assinatura existente no Asaas
     */
    public function updateSubscription(string $subscriptionId, array $data): array
    {
        if (!$this->isConfigured() || str_starts_with($subscriptionId, 'sub_sim_')) {
            return [
                'success'   => true,
                'status'    => 'ACTIVE',
                'simulated' => true,
                'data'      => $data,
            ];
        }

        $payload = [];
        if (isset($data['value'])) {
            $payload['value'] = round((float)$data['value'], 2);
        }
        if (isset($data['description'])) {
            $payload['description'] = $data['description'];
        }
        if (isset($data['updatePendingPayments'])) {
            $payload['updatePendingPayments'] = (bool)$data['updatePendingPayments'];
        }

        // Asaas v3 endpoint para atualização de assinatura é POST /v3/subscriptions/{id}
        return $this->request('subscriptions/' . $subscriptionId, 'POST', $payload);
    }
}
