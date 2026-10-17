<?php

namespace App\Models;

use CodeIgniter\Model;

class SubscriptionModel extends Model
{
    protected $table            = 'subscriptions';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'user_id',
        'plan_id',
        'status',
        'gateway',
        'gateway_subscription_id',
        'gateway_customer_id',
        'billing_cycle',
        'price',
        'extra_websites',
        'extra_websites_price',
        'extra_ai_tokens',
        'extra_ai_tokens_price',
        'current_period_start',
        'current_period_end',
        'canceled_at',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Retorna a assinatura ativa ou mais recente de um usuário
     */
    public function getActiveSubscription(int $userId): ?array
    {
        return $this->where('user_id', $userId)
            ->where('status', 'active')
            ->orderBy('id', 'DESC')
            ->first();
    }
}
