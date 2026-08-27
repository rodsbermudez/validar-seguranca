<?php

namespace App\Models;

use CodeIgniter\Model;

class ScanHistoryModel extends Model
{
    protected $table            = 'scan_history';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = ['website_id', 'status', 'score', 'scan_results_json', 'executed_at'];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
