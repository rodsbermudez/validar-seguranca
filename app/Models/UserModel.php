<?php

namespace App\Models;

use CodeIgniter\Model;

class UserModel extends Model
{
    protected $table            = 'users';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'name',
        'email',
        'password_hash',
        'role',
        'is_active',
        'ai_enabled',
        'ai_monthly_token_limit',
        'plan_id',
        'extra_websites',
        'extra_websites_price',
        'extra_ai_tokens',
        'extra_ai_tokens_price',
        'custom_price_monthly',
        'custom_max_websites',
        'custom_ai_token_limit',
        'cpf_cnpj',
        'phone',
        'asaas_customer_id',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
