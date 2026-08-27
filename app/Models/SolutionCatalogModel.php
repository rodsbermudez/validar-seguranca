<?php

namespace App\Models;

use CodeIgniter\Model;

class SolutionCatalogModel extends Model
{
    protected $table            = 'solution_catalog';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'check_id',
        'check_name',
        'action_type',
        'problem_description',
        'solution_title',
        'solution_instructions',
        'fix_code_snippet',
        'ai_notes',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    public function getByCheckId(string $checkId)
    {
        return $this->where('check_id', $checkId)->first();
    }
}
