<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\AiUsageLogModel;
use App\Models\UserModel;
use App\Models\WebsiteModel;
use App\Models\SettingsModel;

class AiMonitoring extends ResourceController
{
    protected $format = 'json';

    protected function checkAdminPermission(): bool
    {
        $userData = $this->request->userData ?? null;
        if (($userData->role ?? 'user') !== 'admin') {
            return false;
        }
        return true;
    }

    /**
     * GET /api/ai-monitoring/metrics
     * Returns consolidated platform-wide AI usage statistics, costs, breakdowns, and user summaries.
     */
    public function metrics()
    {
        if (!$this->checkAdminPermission()) {
            return $this->failForbidden('Apenas administradores podem acessar o monitoramento global de IA.');
        }

        $logModel     = new AiUsageLogModel();
        $userModel    = new UserModel();
        $websiteModel = new WebsiteModel();

        $selectedMonth   = $this->request->getGet('month') ?: date('Y-m');
        $basePrice       = (float) SettingsModel::getSetting('ai_token_price_per_1k', '0.00');
        $promptPrice     = (float) SettingsModel::getSetting('ai_prompt_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');
        $completionPrice = (float) SettingsModel::getSetting('ai_completion_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');

        // Calculate month start and end dates
        $monthStart = $selectedMonth . '-01 00:00:00';
        $monthEnd   = date('Y-m-t 23:59:59', strtotime($monthStart));

        // 1. All-time global totals
        $allTimeResult = $logModel->select('
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = "success" THEN 1 ELSE 0 END) as successful_requests,
                SUM(CASE WHEN status = "error" THEN 1 ELSE 0 END) as failed_requests,
                SUM(prompt_tokens) as total_prompt_tokens,
                SUM(completion_tokens) as total_completion_tokens,
                SUM(total_tokens) as total_tokens,
                AVG(CASE WHEN duration_ms > 0 THEN duration_ms ELSE NULL END) as avg_duration_ms
            ')->first();

        $allTimeTokens      = (int) ($allTimeResult['total_tokens'] ?? 0);
        $allTimePromptToks  = (int) ($allTimeResult['total_prompt_tokens'] ?? 0);
        $allTimeCompToks    = (int) ($allTimeResult['total_completion_tokens'] ?? 0);
        $allTimePromptCost  = round(($allTimePromptToks / 1000) * $promptPrice, 2);
        $allTimeCompCost    = round(($allTimeCompToks / 1000) * $completionPrice, 2);
        $allTimeCost        = round($allTimePromptCost + $allTimeCompCost, 2);

        // 2. Selected month global totals
        $monthResult = $logModel->select('
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = "success" THEN 1 ELSE 0 END) as successful_requests,
                SUM(CASE WHEN status = "error" THEN 1 ELSE 0 END) as failed_requests,
                SUM(prompt_tokens) as total_prompt_tokens,
                SUM(completion_tokens) as total_completion_tokens,
                SUM(total_tokens) as total_tokens,
                AVG(CASE WHEN duration_ms > 0 THEN duration_ms ELSE NULL END) as avg_duration_ms
            ')
            ->where('created_at >=', $monthStart)
            ->where('created_at <=', $monthEnd)
            ->first();

        $monthTokens      = (int) ($monthResult['total_tokens'] ?? 0);
        $monthPromptToks  = (int) ($monthResult['total_prompt_tokens'] ?? 0);
        $monthCompToks    = (int) ($monthResult['total_completion_tokens'] ?? 0);
        $monthPromptCost  = round(($monthPromptToks / 1000) * $promptPrice, 2);
        $monthCompCost    = round(($monthCompToks / 1000) * $completionPrice, 2);
        $monthCost        = round($monthPromptCost + $monthCompCost, 2);

        // 3. Global monthly progression history
        $monthlyHistory = $logModel->select("
                DATE_FORMAT(created_at, '%Y-%m') as `year_month`,
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_requests,
                SUM(total_tokens) as total_tokens,
                SUM(prompt_tokens) as prompt_tokens,
                SUM(completion_tokens) as completion_tokens
            ", false)
            ->groupBy('`year_month`')
            ->orderBy('`year_month`', 'DESC')
            ->findAll();

        foreach ($monthlyHistory as &$historyItem) {
            $hTokens = (int) ($historyItem['total_tokens'] ?? 0);
            $pTokens = (int) ($historyItem['prompt_tokens'] ?? 0);
            $cTokens = (int) ($historyItem['completion_tokens'] ?? 0);
            $pCost   = round(($pTokens / 1000) * $promptPrice, 2);
            $cCost   = round(($cTokens / 1000) * $completionPrice, 2);

            $historyItem['total_requests']      = (int) ($historyItem['total_requests'] ?? 0);
            $historyItem['successful_requests'] = (int) ($historyItem['successful_requests'] ?? 0);
            $historyItem['failed_requests']     = (int) ($historyItem['failed_requests'] ?? 0);
            $historyItem['total_tokens']        = $hTokens;
            $historyItem['prompt_tokens']       = $pTokens;
            $historyItem['completion_tokens']   = $cTokens;
            $historyItem['prompt_cost']         = $pCost;
            $historyItem['completion_cost']     = $cCost;
            $historyItem['estimated_cost']      = round($pCost + $cCost, 2);
        }

        // 4. Breakdown by Action Type (all-time & selected month)
        $byActionAllTime = $logModel->select('action_type, COUNT(*) as count, SUM(prompt_tokens) as prompt_tokens, SUM(completion_tokens) as completion_tokens, SUM(total_tokens) as tokens')
            ->groupBy('action_type')
            ->findAll();

        $byActionMonth = $logModel->select('action_type, COUNT(*) as count, SUM(prompt_tokens) as prompt_tokens, SUM(completion_tokens) as completion_tokens, SUM(total_tokens) as tokens')
            ->where('created_at >=', $monthStart)
            ->where('created_at <=', $monthEnd)
            ->groupBy('action_type')
            ->findAll();

        foreach ($byActionMonth as &$act) {
            $pToks = (int) ($act['prompt_tokens'] ?? 0);
            $cToks = (int) ($act['completion_tokens'] ?? 0);
            $pCost = round(($pToks / 1000) * $promptPrice, 2);
            $cCost = round(($cToks / 1000) * $completionPrice, 2);

            $act['count']             = (int) ($act['count'] ?? 0);
            $act['tokens']            = (int) ($act['tokens'] ?? 0);
            $act['prompt_tokens']     = $pToks;
            $act['completion_tokens'] = $cToks;
            $act['prompt_cost']       = $pCost;
            $act['completion_cost']   = $cCost;
            $act['estimated_cost']    = round($pCost + $cCost, 2);
        }
        foreach ($byActionAllTime as &$act) {
            $pToks = (int) ($act['prompt_tokens'] ?? 0);
            $cToks = (int) ($act['completion_tokens'] ?? 0);
            $pCost = round(($pToks / 1000) * $promptPrice, 2);
            $cCost = round(($cToks / 1000) * $completionPrice, 2);

            $act['count']             = (int) ($act['count'] ?? 0);
            $act['tokens']            = (int) ($act['tokens'] ?? 0);
            $act['prompt_tokens']     = $pToks;
            $act['completion_tokens'] = $cToks;
            $act['prompt_cost']       = $pCost;
            $act['completion_cost']   = $cCost;
            $act['estimated_cost']    = round($pCost + $cCost, 2);
        }

        // 5. Per-User Consolidated Summary
        $allUsers = $userModel->select('id, name, email, role, is_active, ai_enabled, ai_monthly_token_limit, created_at')
            ->orderBy('id', 'ASC')
            ->findAll();

        $usersSummary = [];
        foreach ($allUsers as $u) {
            $userId = (int) $u['id'];

            // Monthly consumption stats for this user
            $userMonthStats        = $logModel->getUserMonthlyTokenStats($userId, $monthStart, $monthEnd);
            $userMonthTokens       = $userMonthStats['total_tokens'];
            $userMonthPromptToks   = $userMonthStats['prompt_tokens'];
            $userMonthCompToks     = $userMonthStats['completion_tokens'];

            // User all-time tokens & requests
            $userTotalRow = $logModel->select('COUNT(*) as total_requests, SUM(prompt_tokens) as prompt_tokens, SUM(completion_tokens) as completion_tokens, SUM(total_tokens) as total_tokens')
                ->where('user_id', $userId)
                ->first();

            $userAllTimeTokens   = (int) ($userTotalRow['total_tokens'] ?? 0);
            $userAllTimePrompt   = (int) ($userTotalRow['prompt_tokens'] ?? 0);
            $userAllTimeComp     = (int) ($userTotalRow['completion_tokens'] ?? 0);
            $userTotalRequests   = (int) ($userTotalRow['total_requests'] ?? 0);

            $userMonthPromptCost = round(($userMonthPromptToks / 1000) * $promptPrice, 2);
            $userMonthCompCost   = round(($userMonthCompToks / 1000) * $completionPrice, 2);
            $userMonthCost       = round($userMonthPromptCost + $userMonthCompCost, 2);

            $userAllTimePromptCost = round(($userAllTimePrompt / 1000) * $promptPrice, 2);
            $userAllTimeCompCost   = round(($userAllTimeComp / 1000) * $completionPrice, 2);
            $userAllTimeCost       = round($userAllTimePromptCost + $userAllTimeCompCost, 2);

            $limit = $u['ai_monthly_token_limit'] !== null ? (int) $u['ai_monthly_token_limit'] : null;
            $percent = null;
            if ($limit !== null && $limit > 0) {
                $percent = round(($userMonthTokens / $limit) * 100, 1);
            }

            $usersSummary[] = [
                'id'                      => $userId,
                'name'                    => $u['name'],
                'email'                   => $u['email'],
                'role'                    => $u['role'] ?? 'user',
                'is_active'               => (int) ($u['is_active'] ?? 1),
                'ai_enabled'              => (int) ($u['ai_enabled'] ?? 1),
                'ai_monthly_token_limit'  => $limit,
                'month_tokens'            => $userMonthTokens,
                'prompt_tokens_month'     => $userMonthPromptToks,
                'completion_tokens_month' => $userMonthCompToks,
                'prompt_cost_month'       => $userMonthPromptCost,
                'completion_cost_month'   => $userMonthCompCost,
                'all_time_tokens'         => $userAllTimeTokens,
                'total_requests'          => $userTotalRequests,
                'usage_percent'           => $percent,
                'month_cost'              => $userMonthCost,
                'all_time_cost'           => $userAllTimeCost,
            ];
        }

        // Sort users by highest month tokens consumption descending
        usort($usersSummary, fn($a, $b) => $b['month_tokens'] <=> $a['month_tokens']);

        // 6. Per-Website Consolidated Summary
        $websites = $websiteModel->select('websites.id, websites.user_id, websites.name, websites.url, users.name as owner_name, users.email as owner_email')
            ->join('users', 'users.id = websites.user_id', 'left')
            ->findAll();

        $websitesSummary = [];
        foreach ($websites as $w) {
            $wId = (int) $w['id'];

            $wMonthRow = $logModel->select('COUNT(*) as total_requests, SUM(prompt_tokens) as prompt_tokens, SUM(completion_tokens) as completion_tokens, SUM(total_tokens) as total_tokens')
                ->where('website_id', $wId)
                ->where('created_at >=', $monthStart)
                ->where('created_at <=', $monthEnd)
                ->first();

            $wMonthTokens = (int) ($wMonthRow['total_tokens'] ?? 0);
            $wMonthPrompt = (int) ($wMonthRow['prompt_tokens'] ?? 0);
            $wMonthComp   = (int) ($wMonthRow['completion_tokens'] ?? 0);
            $wMonthReqs   = (int) ($wMonthRow['total_requests'] ?? 0);
            $wMonthCost   = round((($wMonthPrompt / 1000) * $promptPrice) + (($wMonthComp / 1000) * $completionPrice), 2);

            $wAllTimeRow = $logModel->select('COUNT(*) as total_requests, SUM(prompt_tokens) as prompt_tokens, SUM(completion_tokens) as completion_tokens, SUM(total_tokens) as total_tokens')
                ->where('website_id', $wId)
                ->first();

            $wAllTimeTokens = (int) ($wAllTimeRow['total_tokens'] ?? 0);
            $wAllTimePrompt = (int) ($wAllTimeRow['prompt_tokens'] ?? 0);
            $wAllTimeComp   = (int) ($wAllTimeRow['completion_tokens'] ?? 0);
            $wAllTimeReqs   = (int) ($wAllTimeRow['total_requests'] ?? 0);
            $wAllTimeCost   = round((($wAllTimePrompt / 1000) * $promptPrice) + (($wAllTimeComp / 1000) * $completionPrice), 2);

            if ($wAllTimeReqs > 0 || $wMonthReqs > 0) {
                $websitesSummary[] = [
                    'id'                => $wId,
                    'name'              => $w['name'],
                    'url'               => $w['url'],
                    'owner_name'        => $w['owner_name'] ?? 'N/A',
                    'owner_email'       => $w['owner_email'] ?? 'N/A',
                    'month_tokens'      => $wMonthTokens,
                    'month_requests'    => $wMonthReqs,
                    'month_cost'        => $wMonthCost,
                    'all_time_tokens'   => $allTimeTokens,
                    'all_time_requests' => $wAllTimeReqs,
                    'all_time_cost'     => $wAllTimeCost,
                ];
            }
        }

        usort($websitesSummary, fn($a, $b) => $b['month_tokens'] <=> $a['month_tokens']);

        return $this->respond([
            'status'                        => 200,
            'selected_month'                => $selectedMonth,
            'token_price_per_1k'            => $basePrice,
            'prompt_token_price_per_1k'     => $promptPrice,
            'completion_token_price_per_1k' => $completionPrice,
            'month_metrics'  => [
                'total_requests'          => (int) ($monthResult['total_requests'] ?? 0),
                'successful_requests'     => (int) ($monthResult['successful_requests'] ?? 0),
                'failed_requests'         => (int) ($monthResult['failed_requests'] ?? 0),
                'total_prompt_tokens'     => $monthPromptToks,
                'total_completion_tokens' => $monthCompToks,
                'total_tokens'            => $monthTokens,
                'avg_duration_ms'         => round((float) ($monthResult['avg_duration_ms'] ?? 0)),
                'prompt_cost'             => $monthPromptCost,
                'completion_cost'         => $monthCompCost,
                'estimated_cost'          => $monthCost,
            ],
            'all_time_metrics' => [
                'total_requests'          => (int) ($allTimeResult['total_requests'] ?? 0),
                'successful_requests'     => (int) ($allTimeResult['successful_requests'] ?? 0),
                'failed_requests'         => (int) ($allTimeResult['failed_requests'] ?? 0),
                'total_prompt_tokens'     => $allTimePromptToks,
                'total_completion_tokens' => $allTimeCompToks,
                'total_tokens'            => $allTimeTokens,
                'avg_duration_ms'         => round((float) ($allTimeResult['avg_duration_ms'] ?? 0)),
                'prompt_cost'             => $allTimePromptCost,
                'completion_cost'         => $allTimeCompCost,
                'estimated_cost'          => $allTimeCost,
            ],
            'monthly_history'    => $monthlyHistory,
            'by_action_month'    => $byActionMonth,
            'by_action_all_time' => $byActionAllTime,
            'users_summary'      => $usersSummary,
            'websites_summary'   => $websitesSummary,
        ]);
    }

    /**
     * GET /api/ai-monitoring/logs
     * Returns paginated AI usage logs across all users and websites with search and filters.
     */
    public function logs()
    {
        if (!$this->checkAdminPermission()) {
            return $this->failForbidden('Apenas administradores podem acessar os logs globais de IA.');
        }

        $logModel        = new AiUsageLogModel();
        $basePrice       = (float) SettingsModel::getSetting('ai_token_price_per_1k', '0.00');
        $promptPrice     = (float) SettingsModel::getSetting('ai_prompt_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');
        $completionPrice = (float) SettingsModel::getSetting('ai_completion_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');

        $page       = max(1, (int) ($this->request->getGet('page') ?: 1));
        $limit      = min(200, max(10, (int) ($this->request->getGet('limit') ?: 50)));
        $offset     = ($page - 1) * $limit;

        $userId     = $this->request->getGet('user_id');
        $websiteId  = $this->request->getGet('website_id');
        $status     = $this->request->getGet('status');
        $actionType = $this->request->getGet('action_type');
        $month      = $this->request->getGet('month');
        $search     = trim($this->request->getGet('search') ?? '');

        $builder = $logModel->select('
                ai_usage_logs.*,
                users.name as user_name,
                users.email as user_email,
                websites.name as website_name,
                websites.url as website_url
            ')
            ->join('users', 'users.id = ai_usage_logs.user_id', 'left')
            ->join('websites', 'websites.id = ai_usage_logs.website_id', 'left');

        if (!empty($userId)) {
            $builder->where('ai_usage_logs.user_id', (int) $userId);
        }

        if (!empty($websiteId)) {
            $builder->where('ai_usage_logs.website_id', (int) $websiteId);
        }

        if (!empty($status) && in_array(strtolower($status), ['success', 'error'])) {
            $builder->where('ai_usage_logs.status', strtolower($status));
        }

        if (!empty($actionType)) {
            $builder->where('ai_usage_logs.action_type', $actionType);
        }

        if (!empty($month)) {
            $start = $month . '-01 00:00:00';
            $end   = date('Y-m-t 23:59:59', strtotime($start));
            $builder->where('ai_usage_logs.created_at >=', $start);
            $builder->where('ai_usage_logs.created_at <=', $end);
        }

        if (!empty($search)) {
            $builder->groupStart()
                ->like('users.name', $search)
                ->orLike('users.email', $search)
                ->orLike('websites.name', $search)
                ->orLike('websites.url', $search)
                ->orLike('ai_usage_logs.model', $search)
                ->orLike('ai_usage_logs.action_type', $search)
                ->groupEnd();
        }

        $totalCount = $builder->countAllResults(false);

        $logs = $builder->orderBy('ai_usage_logs.created_at', 'DESC')
            ->limit($limit, $offset)
            ->findAll();

        foreach ($logs as &$log) {
            $pTokens = (int) ($log['prompt_tokens'] ?? 0);
            $cTokens = (int) ($log['completion_tokens'] ?? 0);
            $tokens  = (int) ($log['total_tokens'] ?? ($pTokens + $cTokens));
            $pCost   = round(($pTokens / 1000) * $promptPrice, 4);
            $cCost   = round(($cTokens / 1000) * $completionPrice, 4);

            $log['id']                = (int) $log['id'];
            $log['user_id']           = (int) $log['user_id'];
            $log['website_id']        = $log['website_id'] ? (int) $log['website_id'] : null;
            $log['prompt_tokens']     = $pTokens;
            $log['completion_tokens'] = $cTokens;
            $log['total_tokens']      = $tokens;
            $log['duration_ms']       = (int) ($log['duration_ms'] ?? 0);
            $log['prompt_cost']       = $pCost;
            $log['completion_cost']   = $cCost;
            $log['estimated_cost']    = round($pCost + $cCost, 4);
        }

        return $this->respond([
            'status'                        => 200,
            'page'                          => $page,
            'limit'                         => $limit,
            'total'                         => $totalCount,
            'total_pages'                   => ceil($totalCount / $limit),
            'token_price_per_1k'            => $basePrice,
            'prompt_token_price_per_1k'     => $promptPrice,
            'completion_token_price_per_1k' => $completionPrice,
            'data'                          => $logs,
        ]);
    }
}
