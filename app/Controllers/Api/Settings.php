<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\SettingsModel;

class Settings extends ResourceController
{
    protected $format = 'json';

    public static function getAvailableModels(): array
    {
        return [
            [
                'id'          => 'kimi-k2.7-code',
                'name'        => 'Kimi K2.7 Code',
                'provider'    => 'OpenCode Zen',
                'description' => 'Modelo padrão otimizado para análise de segurança WordPress, geração de plugins e código PHP seguro.',
                'badge'       => 'RECOMENDADO',
                'color'       => 'indigo',
            ],
            [
                'id'          => 'deepseek-v4-pro',
                'name'        => 'DeepSeek V4 Pro',
                'provider'    => 'OpenCode Zen',
                'description' => 'Modelo avançado com raciocínio profundo para triagem de vulnerabilidades complexas e guia de servidor.',
                'badge'       => 'AVANÇADO',
                'color'       => 'blue',
            ],
            [
                'id'          => 'qwen-3.8-max',
                'name'        => 'Qwen 3.8 Max',
                'provider'    => 'OpenCode Zen',
                'description' => 'Modelo Qwen de altíssima velocidade para remediação em lote e rápida geração de relatórios.',
                'badge'       => 'ALTA VELOCIDADE',
                'color'       => 'teal',
            ],
        ];
    }

    /**
     * Check if user is Admin
     */
    protected function checkAdminAccess()
    {
        $userData = $this->request->userData ?? null;
        if (!$userData || ($userData->role ?? '') !== 'admin') {
            return false;
        }
        return true;
    }

    /**
     * GET /api/settings
     */
    public function index()
    {
        if (!$this->checkAdminAccess()) {
            return $this->respond([
                'status'  => 403,
                'success' => false,
                'message' => 'Acesso negado. Apenas administradores podem acessar as configurações de IA.',
            ], 403);
        }

        $activeModel     = SettingsModel::getSetting('ai_model', env('OPENCODE_MODEL') ?: 'kimi-k2.7-code');
        $basePrice       = (float) SettingsModel::getSetting('ai_token_price_per_1k', '0.00');
        $promptPrice     = (float) SettingsModel::getSetting('ai_prompt_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');
        $completionPrice = (float) SettingsModel::getSetting('ai_completion_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');
        $apiKey          = env('OPENCODE_API_KEY');
        $hasKey          = !empty($apiKey);
        $asaasKey         = SettingsModel::getSetting('asaas_api_key', env('ASAAS_API_KEY') ?: '');
        $asaasEnv         = SettingsModel::getSetting('asaas_environment', env('ASAAS_ENVIRONMENT') ?: 'sandbox');
        $asaasSecret      = SettingsModel::getSetting('asaas_webhook_secret', env('ASAAS_WEBHOOK_SECRET') ?: '');

        return $this->respond([
            'status'                        => 200,
            'success'                       => true,
            'active_ai_model'               => $activeModel,
            'token_price_per_1k'            => $basePrice,
            'prompt_token_price_per_1k'     => $promptPrice,
            'completion_token_price_per_1k' => $completionPrice,
            'has_api_key'                   => $hasKey,
            'available_models'              => self::getAvailableModels(),
            'asaas_api_key'                 => !empty($asaasKey) ? (substr($asaasKey, 0, 8) . '...' . substr($asaasKey, -4)) : '',
            'asaas_environment'             => $asaasEnv,
            'asaas_webhook_secret'          => $asaasSecret,
            'asaas_configured'              => !empty($asaasKey),
            'payment_methods'               => SettingsModel::getPaymentMethods(),
            'addon_pricing'                 => SettingsModel::getAddonPricing(),
        ]);
    }

    /**
     * POST /api/settings
     */
    public function update($id = null)
    {
        if (!$this->checkAdminAccess()) {
            return $this->respond([
                'status'  => 403,
                'success' => false,
                'message' => 'Acesso negado. Apenas administradores podem alterar as configurações de IA.',
            ], 403);
        }

        $json                 = $this->request->getJSON(true) ?: [];
        $aiModel              = trim($json['ai_model'] ?? $this->request->getPost('ai_model') ?? '');
        $tokenPriceInput      = $json['token_price_per_1k'] ?? $this->request->getPost('token_price_per_1k') ?? null;
        $promptPriceInput     = $json['prompt_token_price_per_1k'] ?? $this->request->getPost('prompt_token_price_per_1k') ?? null;
        $completionPriceInput = $json['completion_token_price_per_1k'] ?? $this->request->getPost('completion_token_price_per_1k') ?? null;

        $asaasKeyInput        = array_key_exists('asaas_api_key', $json) ? trim($json['asaas_api_key']) : ($this->request->getPost('asaas_api_key') !== null ? trim($this->request->getPost('asaas_api_key')) : null);
        $asaasEnvInput        = array_key_exists('asaas_environment', $json) ? trim($json['asaas_environment']) : ($this->request->getPost('asaas_environment') !== null ? trim($this->request->getPost('asaas_environment')) : null);
        $asaasSecretInput     = array_key_exists('asaas_webhook_secret', $json) ? trim($json['asaas_webhook_secret']) : ($this->request->getPost('asaas_webhook_secret') !== null ? trim($this->request->getPost('asaas_webhook_secret')) : null);

        $pmCardInput          = array_key_exists('payment_method_credit_card', $json) ? $json['payment_method_credit_card'] : ($this->request->getPost('payment_method_credit_card') !== null ? $this->request->getPost('payment_method_credit_card') : null);
        $pmPixInput           = array_key_exists('payment_method_pix', $json) ? $json['payment_method_pix'] : ($this->request->getPost('payment_method_pix') !== null ? $this->request->getPost('payment_method_pix') : null);

        // Preços globais de Add-ons
        $addonWebsitesPriceInput = $json['addon_extra_website_price'] ?? ($json['addon_pricing']['extra_website_price'] ?? ($this->request->getPost('addon_extra_website_price') ?? null));
        $addonAiPackPriceInput   = $json['addon_ai_pack_price'] ?? ($json['addon_pricing']['ai_pack_price'] ?? ($this->request->getPost('addon_ai_pack_price') ?? null));
        $addonAiPackTokensInput  = $json['addon_ai_pack_tokens'] ?? ($json['addon_pricing']['ai_pack_tokens'] ?? ($this->request->getPost('addon_ai_pack_tokens') ?? null));

        if (empty($aiModel) && $tokenPriceInput === null && $promptPriceInput === null && $completionPriceInput === null && $asaasKeyInput === null && $asaasEnvInput === null && $asaasSecretInput === null && $pmCardInput === null && $pmPixInput === null && $addonWebsitesPriceInput === null && $addonAiPackPriceInput === null && $addonAiPackTokensInput === null) {
            return $this->fail('Nenhum dado informado para atualização.', 400);
        }

        if ($addonWebsitesPriceInput !== null && $addonWebsitesPriceInput !== '') {
            if (!is_numeric($addonWebsitesPriceInput) || (float) $addonWebsitesPriceInput < 0) {
                return $this->fail('O valor por website extra deve ser um número maior ou igual a zero.', 400);
            }
            SettingsModel::setSetting('addon_extra_website_price', number_format((float) $addonWebsitesPriceInput, 2, '.', ''));
        }

        if ($addonAiPackPriceInput !== null && $addonAiPackPriceInput !== '') {
            if (!is_numeric($addonAiPackPriceInput) || (float) $addonAiPackPriceInput < 0) {
                return $this->fail('O valor por pacote extra de IA deve ser um número maior ou igual a zero.', 400);
            }
            SettingsModel::setSetting('addon_ai_pack_price', number_format((float) $addonAiPackPriceInput, 2, '.', ''));
        }

        if ($addonAiPackTokensInput !== null && $addonAiPackTokensInput !== '') {
            if (!is_numeric($addonAiPackTokensInput) || (int) $addonAiPackTokensInput <= 0) {
                return $this->fail('A quantidade de tokens por pacote de IA deve ser maior que zero.', 400);
            }
            SettingsModel::setSetting('addon_ai_pack_tokens', (string) (int) $addonAiPackTokensInput);
        }

        if (!empty($aiModel)) {
            $availableIds = array_column(self::getAvailableModels(), 'id');
            if (!in_array($aiModel, $availableIds, true)) {
                return $this->fail('Modelo de IA selecionado inválido.', 400);
            }
            SettingsModel::setSetting('ai_model', $aiModel);
        }

        if ($tokenPriceInput !== null && $tokenPriceInput !== '') {
            if (!is_numeric($tokenPriceInput) || (float) $tokenPriceInput < 0) {
                return $this->fail('O valor por 1.000 tokens deve ser um número igual ou maior que zero.', 400);
            }
            SettingsModel::setSetting('ai_token_price_per_1k', number_format((float) $tokenPriceInput, 4, '.', ''));
        }

        if ($promptPriceInput !== null && $promptPriceInput !== '') {
            if (!is_numeric($promptPriceInput) || (float) $promptPriceInput < 0) {
                return $this->fail('O valor por 1.000 tokens de entrada deve ser um número igual ou maior que zero.', 400);
            }
            SettingsModel::setSetting('ai_prompt_token_price_per_1k', number_format((float) $promptPriceInput, 4, '.', ''));
        }

        if ($completionPriceInput !== null && $completionPriceInput !== '') {
            if (!is_numeric($completionPriceInput) || (float) $completionPriceInput < 0) {
                return $this->fail('O valor por 1.000 tokens de saída deve ser um número igual ou maior que zero.', 400);
            }
            SettingsModel::setSetting('ai_completion_token_price_per_1k', number_format((float) $completionPriceInput, 4, '.', ''));
        }

        // Configurações do Gateway Asaas
        if ($asaasKeyInput !== null && !str_contains($asaasKeyInput, '...')) {
            SettingsModel::setSetting('asaas_api_key', $asaasKeyInput);
        }

        if ($asaasEnvInput !== null) {
            $validEnvs = ['sandbox', 'production'];
            if (in_array($asaasEnvInput, $validEnvs, true)) {
                SettingsModel::setSetting('asaas_environment', $asaasEnvInput);
            }
        }

        if ($asaasSecretInput !== null) {
            SettingsModel::setSetting('asaas_webhook_secret', $asaasSecretInput);
        }

        // Formas de Pagamento (Cartão de Crédito / Pix)
        if ($pmCardInput !== null || $pmPixInput !== null) {
            $currentPms = SettingsModel::getPaymentMethods();
            $newCard = $pmCardInput !== null ? filter_var($pmCardInput, FILTER_VALIDATE_BOOLEAN) : $currentPms['credit_card'];
            $newPix  = $pmPixInput !== null ? filter_var($pmPixInput, FILTER_VALIDATE_BOOLEAN) : $currentPms['pix'];

            if (!$newCard && !$newPix) {
                return $this->fail('Ao menos uma forma de pagamento deve permanecer ativa na plataforma.', 400);
            }

            SettingsModel::setSetting('payment_method_credit_card', $newCard ? '1' : '0');
            SettingsModel::setSetting('payment_method_pix', $newPix ? '1' : '0');
        }

        // Keep ai_token_price_per_1k synchronised if only prompt/completion were updated
        if ($tokenPriceInput === null && ($promptPriceInput !== null || $completionPriceInput !== null)) {
            $pPrice = (float) SettingsModel::getSetting('ai_prompt_token_price_per_1k', '0.00');
            $cPrice = (float) SettingsModel::getSetting('ai_completion_token_price_per_1k', '0.00');
            $avgPrice = round(($pPrice + $cPrice) / 2, 4);
            SettingsModel::setSetting('ai_token_price_per_1k', number_format($avgPrice, 4, '.', ''));
        }

        $activeModel      = SettingsModel::getSetting('ai_model', env('OPENCODE_MODEL') ?: 'kimi-k2.7-code');
        $savedBasePrice   = (float) SettingsModel::getSetting('ai_token_price_per_1k', '0.00');
        $savedPromptPrice = (float) SettingsModel::getSetting('ai_prompt_token_price_per_1k', $savedBasePrice > 0 ? (string)$savedBasePrice : '0.00');
        $savedCompPrice   = (float) SettingsModel::getSetting('ai_completion_token_price_per_1k', $savedBasePrice > 0 ? (string)$savedBasePrice : '0.00');
        $savedAsaasKey    = SettingsModel::getSetting('asaas_api_key', env('ASAAS_API_KEY') ?: '');
        $savedAsaasEnv    = SettingsModel::getSetting('asaas_environment', env('ASAAS_ENVIRONMENT') ?: 'sandbox');
        $savedAsaasSecret = SettingsModel::getSetting('asaas_webhook_secret', env('ASAAS_WEBHOOK_SECRET') ?: '');

        return $this->respond([
            'status'                        => 200,
            'success'                       => true,
            'message'                       => 'Configurações gerais atualizadas com sucesso.',
            'active_ai_model'               => $activeModel,
            'token_price_per_1k'            => $savedBasePrice,
            'prompt_token_price_per_1k'     => $savedPromptPrice,
            'completion_token_price_per_1k' => $savedCompPrice,
            'asaas_api_key'                 => !empty($savedAsaasKey) ? (substr($savedAsaasKey, 0, 8) . '...' . substr($savedAsaasKey, -4)) : '',
            'asaas_environment'             => $savedAsaasEnv,
            'asaas_webhook_secret'          => $savedAsaasSecret,
            'asaas_configured'              => !empty($savedAsaasKey),
            'payment_methods'               => SettingsModel::getPaymentMethods(),
            'addon_pricing'                 => SettingsModel::getAddonPricing(),
        ]);
    }

    /**
     * GET /api/public/payment-methods
     * Retorna as formas de pagamento disponíveis para o público
     */
    public function publicPaymentMethods()
    {
        return $this->respond([
            'status'          => 200,
            'success'         => true,
            'payment_methods' => SettingsModel::getPaymentMethods(),
            'addon_pricing'   => SettingsModel::getAddonPricing(),
        ]);
    }
}
