<?php

namespace App\Models;

use CodeIgniter\Model;

class PlanModel extends Model
{
    protected $table            = 'plans';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'name',
        'slug',
        'description',
        'max_websites',
        'ai_monthly_tokens',
        'price_monthly',
        'tools_enabled',
        'is_active',
        'is_default',
        'sort_order',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Retorna o plano padrão do sistema
     */
    public function getDefaultPlan(): ?array
    {
        return $this->where('is_default', 1)->where('is_active', 1)->first()
            ?: $this->where('is_active', 1)->orderBy('sort_order', 'ASC')->first();
    }
}
