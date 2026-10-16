<?php

namespace App\Models;

use CodeIgniter\Model;

class AiUsageLogModel extends Model
{
    protected $table            = 'ai_usage_logs';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'user_id',
        'website_id',
        'action_type',
        'model',
        'prompt_tokens',
        'completion_tokens',
        'total_tokens',
        'duration_ms',
        'status',
        'error_message',
        'created_at',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = '';

    /**
     * Get total tokens consumed by user in the current calendar month.
     */
    public function getUserMonthlyTokens(int $userId, ?string $monthStart = null, ?string $monthEnd = null): int
    {
        $start = $monthStart ?? date('Y-m-01 00:00:00');
        $end = $monthEnd ?? date('Y-m-t 23:59:59');

        $result = $this->selectSum('total_tokens')
            ->where('user_id', $userId)
            ->where('status', 'success')
            ->where('created_at >=', $start)
            ->where('created_at <=', $end)
            ->first();

        return (int) ($result['total_tokens'] ?? 0);
    }

    /**
     * Get detailed prompt and completion token stats for user in a month.
     */
    public function getUserMonthlyTokenStats(int $userId, ?string $monthStart = null, ?string $monthEnd = null): array
    {
        $start = $monthStart ?? date('Y-m-01 00:00:00');
        $end   = $monthEnd ?? date('Y-m-t 23:59:59');

        $result = $this->select('
                SUM(prompt_tokens) as prompt_tokens,
                SUM(completion_tokens) as completion_tokens,
                SUM(total_tokens) as total_tokens,
                COUNT(*) as total_requests
            ')
            ->where('user_id', $userId)
            ->where('status', 'success')
            ->where('created_at >=', $start)
            ->where('created_at <=', $end)
            ->first();

        return [
            'prompt_tokens'     => (int) ($result['prompt_tokens'] ?? 0),
            'completion_tokens' => (int) ($result['completion_tokens'] ?? 0),
            'total_tokens'      => (int) ($result['total_tokens'] ?? 0),
            'total_requests'    => (int) ($result['total_requests'] ?? 0),
        ];
    }

    /**
     * Get aggregate statistics for a user.
     */
    public function getUserStats(int $userId): array
    {
        $totalResult = $this->select('
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = "success" THEN 1 ELSE 0 END) as successful_requests,
                SUM(CASE WHEN status = "error" THEN 1 ELSE 0 END) as failed_requests,
                SUM(prompt_tokens) as total_prompt_tokens,
                SUM(completion_tokens) as total_completion_tokens,
                SUM(total_tokens) as total_tokens,
                AVG(CASE WHEN duration_ms > 0 THEN duration_ms ELSE NULL END) as avg_duration_ms
            ')
            ->where('user_id', $userId)
            ->first();

        $currentMonthTokens = $this->getUserMonthlyTokens($userId);

        // Group by action type
        $byAction = $this->select('action_type, COUNT(*) as count, SUM(total_tokens) as tokens')
            ->where('user_id', $userId)
            ->groupBy('action_type')
            ->findAll();

        return [
            'total_requests' => (int) ($totalResult['total_requests'] ?? 0),
            'successful_requests' => (int) ($totalResult['successful_requests'] ?? 0),
            'failed_requests' => (int) ($totalResult['failed_requests'] ?? 0),
            'total_prompt_tokens' => (int) ($totalResult['total_prompt_tokens'] ?? 0),
            'total_completion_tokens' => (int) ($totalResult['total_completion_tokens'] ?? 0),
            'total_tokens' => (int) ($totalResult['total_tokens'] ?? 0),
            'avg_duration_ms' => round((float) ($totalResult['avg_duration_ms'] ?? 0)),
            'current_month_tokens' => $currentMonthTokens,
            'by_action' => $byAction,
        ];
    }

    /**
     * Get detailed logs for a user with website info.
     */
    public function getUserLogs(int $userId, int $limit = 100, int $offset = 0): array
    {
        return $this->select('ai_usage_logs.*, websites.url as website_url, websites.name as website_name')
            ->join('websites', 'websites.id = ai_usage_logs.website_id', 'left')
            ->where('ai_usage_logs.user_id', $userId)
            ->orderBy('ai_usage_logs.created_at', 'DESC')
            ->findAll($limit, $offset);
    }

    /**
     * Get aggregate monthly consumption history for a user (grouped by YYYY-MM)
     */
    public function getUserMonthlyHistory(int $userId): array
    {
        $records = $this->select("
                DATE_FORMAT(created_at, '%Y-%m') as `year_month`,
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
                SUM(total_tokens) as total_tokens,
                SUM(prompt_tokens) as prompt_tokens,
                SUM(completion_tokens) as completion_tokens
            ", false)
            ->where('user_id', $userId)
            ->groupBy('`year_month`')
            ->orderBy('`year_month`', 'DESC')
            ->findAll();

        foreach ($records as &$rec) {
            $rec['total_requests'] = (int) ($rec['total_requests'] ?? 0);
            $rec['successful_requests'] = (int) ($rec['successful_requests'] ?? 0);
            $rec['total_tokens'] = (int) ($rec['total_tokens'] ?? 0);
            $rec['prompt_tokens'] = (int) ($rec['prompt_tokens'] ?? 0);
            $rec['completion_tokens'] = (int) ($rec['completion_tokens'] ?? 0);
        }

        return $records;
    }
}
