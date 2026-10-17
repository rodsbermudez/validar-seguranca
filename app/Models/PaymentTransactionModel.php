<?php

namespace App\Models;

use CodeIgniter\Model;

class PaymentTransactionModel extends Model
{
    protected $table            = 'payment_transactions';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'user_id',
        'subscription_id',
        'plan_id',
        'gateway',
        'gateway_transaction_id',
        'amount',
        'payment_method',
        'status',
        'pix_qr_code',
        'pix_copy_paste',
        'pix_expiration',
        'invoice_url',
        'metadata',
        'paid_at',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Busca transação por ID do gateway para validação de idempotência
     */
    public function findByGatewayId(string $gatewayId): ?array
    {
        return $this->where('gateway_transaction_id', $gatewayId)->first();
    }
}
