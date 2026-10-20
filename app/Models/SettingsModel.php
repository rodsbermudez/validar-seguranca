<?php

namespace App\Models;

use CodeIgniter\Model;

class SettingsModel extends Model
{
    protected $table      = 'settings';
    protected $primaryKey = 'key';

    protected $useAutoIncrement = false;
    protected $returnType       = 'array';

    protected $allowedFields = ['key', 'value', 'updated_at'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = '';
    protected $updatedField  = 'updated_at';

    /**
     * Get a setting by key with fallback default
     */
    public static function getSetting(string $key, string $default = ''): string
    {
        try {
            $model = new self();
            $record = $model->find($key);
            if ($record && isset($record['value'])) {
                return $record['value'];
            }
        } catch (\Throwable $e) {
            log_message('error', 'Error fetching setting ' . $key . ': ' . $e->getMessage());
        }

        return $default;
    }

    /**
     * Set/update a setting value
     */
    public static function setSetting(string $key, string $value): bool
    {
        try {
            $model = new self();
            $existing = $model->find($key);
            $data = [
                'key'        => $key,
                'value'      => $value,
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            if ($existing) {
                return (bool) $model->update($key, $data);
            } else {
                return (bool) $model->insert($data);
            }
        } catch (\Throwable $e) {
            log_message('error', 'Error saving setting ' . $key . ': ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Retorna a configuração das formas de pagamento habilitadas na plataforma.
     * Padrão atual: Cartão de Crédito ativo, Pix inativo (configurável pelo admin).
     * Garante que ao menos uma forma de pagamento permaneça ativa.
     */
    public static function getPaymentMethods(): array
    {
        $creditCard = self::getSetting('payment_method_credit_card', '1') === '1';
        $pix        = self::getSetting('payment_method_pix', '0') === '1';

        // Garante que ao menos uma opção esteja habilitada
        if (!$creditCard && !$pix) {
            $creditCard = true;
        }

        return [
            'credit_card' => $creditCard,
            'pix'         => $pix,
        ];
    }

    /**
     * Retorna a tabela global de precificação de add-ons da plataforma.
     * Valores padrão:
     * - extra_website_price: R$ 8.00/mês por site adicional
     * - ai_pack_price: R$ 60.00/mês por pacote de tokens
     * - ai_pack_tokens: 250.000 tokens por pacote
     */
    public static function getAddonPricing(): array
    {
        $extraWebsitePrice = (float) self::getSetting('addon_extra_website_price', '8.00');
        $aiPackPrice       = (float) self::getSetting('addon_ai_pack_price', '60.00');
        $aiPackTokens      = (int) self::getSetting('addon_ai_pack_tokens', '250000');

        return [
            'extra_website_price' => $extraWebsitePrice >= 0 ? $extraWebsitePrice : 8.00,
            'ai_pack_price'       => $aiPackPrice >= 0 ? $aiPackPrice : 60.00,
            'ai_pack_tokens'      => $aiPackTokens > 0 ? $aiPackTokens : 250000,
        ];
    }
}

