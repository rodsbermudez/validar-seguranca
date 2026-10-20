<?php

namespace App\Models;

use CodeIgniter\Model;

class PlatformErrorLogModel extends Model
{
    protected $table            = 'platform_error_logs';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'severity',
        'category',
        'website_id',
        'website_name',
        'website_url',
        'user_id',
        'user_email',
        'endpoint',
        'http_method',
        'http_status',
        'error_message',
        'curl_error',
        'request_payload',
        'response_body',
        'suggested_solution',
        'status',
        'admin_notes',
        'resolved_at',
        'resolved_by',
        'ip_address',
        'user_agent',
        'created_at',
        'updated_at',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Get paginated error logs with flexible filters.
     */
    public function getFilteredLogs(array $filters = [], int $page = 1, int $perPage = 25): array
    {
        $builder = $this->builder();

        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $builder->where('status', $filters['status']);
        }

        if (!empty($filters['severity']) && $filters['severity'] !== 'all') {
            $builder->where('severity', $filters['severity']);
        }

        if (!empty($filters['category']) && $filters['category'] !== 'all') {
            $builder->where('category', $filters['category']);
        }

        if (!empty($filters['website_id']) && $filters['website_id'] !== 'all') {
            $builder->where('website_id', (int) $filters['website_id']);
        }

        if (!empty($filters['user_id']) && $filters['user_id'] !== 'all') {
            $builder->where('user_id', (int) $filters['user_id']);
        }

        if (!empty($filters['http_status'])) {
            $builder->where('http_status', (int) $filters['http_status']);
        }

        if (!empty($filters['date_from'])) {
            $builder->where('created_at >=', $filters['date_from'] . ' 00:00:00');
        }

        if (!empty($filters['date_to'])) {
            $builder->where('created_at <=', $filters['date_to'] . ' 23:59:59');
        }

        if (!empty($filters['search'])) {
            $search = trim($filters['search']);
            $builder->groupStart()
                ->like('website_name', $search)
                ->orLike('website_url', $search)
                ->orLike('user_email', $search)
                ->orLike('error_message', $search)
                ->orLike('endpoint', $search)
                ->orLike('curl_error', $search)
                ->groupEnd();
        }

        // Count total matching
        $totalBuilder = clone $builder;
        $total = $totalBuilder->countAllResults();

        // Fetch paginated results
        $offset = ($page - 1) * $perPage;
        $logs = $builder->orderBy('created_at', 'DESC')
            ->limit($perPage, $offset)
            ->get()
            ->getResultArray();

        return [
            'logs'         => $logs,
            'total'        => $total,
            'page'         => $page,
            'per_page'     => $perPage,
            'total_pages'  => ceil($total / $perPage),
        ];
    }

    /**
     * Get platform error metrics for dashboard cards.
     */
    public function getMetrics(): array
    {
        $db = \Config\Database::connect();
        $twentyFourHoursAgo = date('Y-m-d H:i:s', strtotime('-24 hours'));

        // 1. Total errors
        $totalErrors = $this->countAllResults();

        // 2. Unresolved critical / error issues
        $unresolvedCritical = $this->where('status', 'unresolved')
            ->whereIn('severity', ['critical', 'error'])
            ->countAllResults();

        // 3. Agent connection failures in last 24h
        $connectionFailures24h = $this->where('category', 'agent_connection')
            ->where('created_at >=', $twentyFourHoursAgo)
            ->countAllResults();

        // 4. Unique websites affected
        $websitesQuery = $db->query('SELECT COUNT(DISTINCT website_id) as count FROM platform_error_logs WHERE website_id IS NOT NULL');
        $affectedWebsites = (int) ($websitesQuery->getRow()->count ?? 0);

        // 5. Unique users affected
        $usersQuery = $db->query('SELECT COUNT(DISTINCT user_id) as count FROM platform_error_logs WHERE user_id IS NOT NULL');
        $affectedUsers = (int) ($usersQuery->getRow()->count ?? 0);

        // 6. Status breakdown
        $statusBreakdown = [
            'unresolved'    => $this->where('status', 'unresolved')->countAllResults(),
            'investigating' => $this->where('status', 'investigating')->countAllResults(),
            'resolved'      => $this->where('status', 'resolved')->countAllResults(),
            'ignored'       => $this->where('status', 'ignored')->countAllResults(),
        ];

        return [
            'total_errors'             => $totalErrors,
            'unresolved_critical'      => $unresolvedCritical,
            'connection_failures_24h'  => $connectionFailures24h,
            'affected_websites'        => $affectedWebsites,
            'affected_users'           => $affectedUsers,
            'status_breakdown'         => $statusBreakdown,
        ];
    }

    /**
     * Get distinct websites that have error logs, for frontend filter dropdown.
     */
    public function getFilterWebsites(): array
    {
        $db = \Config\Database::connect();
        $query = $db->query('
            SELECT DISTINCT website_id as id, website_name as name, website_url as url, COUNT(*) as error_count
            FROM platform_error_logs
            WHERE website_id IS NOT NULL
            GROUP BY website_id, website_name, website_url
            ORDER BY error_count DESC
            LIMIT 100
        ');
        return $query->getResultArray();
    }

    /**
     * Get distinct users that have error logs, for frontend filter dropdown.
     */
    public function getFilterUsers(): array
    {
        $db = \Config\Database::connect();
        $query = $db->query('
            SELECT DISTINCT user_id as id, user_email as email, COUNT(*) as error_count
            FROM platform_error_logs
            WHERE user_id IS NOT NULL
            GROUP BY user_id, user_email
            ORDER BY error_count DESC
            LIMIT 100
        ');
        return $query->getResultArray();
    }
}
