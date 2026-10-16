<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\WebsiteModel;
use App\Models\WebsiteMaintenanceModel;
use App\Models\ScanHistoryModel;

class Dashboard extends ResourceController
{
    protected $format = 'json';

    public function overview()
    {
        $effectiveUserId = (int) ($this->request->effectiveUserId ?? ($this->request->userData->id ?? 0));
        $yearMonth       = $this->request->getGet('year_month') ?: date('Y-m');

        // Valida formato YYYY-MM
        if (!preg_match('/^\d{4}-\d{2}$/', $yearMonth)) {
            $yearMonth = date('Y-m');
        }

        $websiteModel = new WebsiteModel();
        $websites     = $websiteModel->getUserWebsites($effectiveUserId, $yearMonth);

        // Tradução de mês para português
        $mesesPt = [
            '01' => 'Janeiro', '02' => 'Fevereiro', '03' => 'Março',
            '04' => 'Abril',   '05' => 'Maio',      '06' => 'Junho',
            '07' => 'Julho',   '08' => 'Agosto',    '09' => 'Setembro',
            '10' => 'Outubro', '11' => 'Novembro',  '12' => 'Dezembro'
        ];
        [$ano, $mes] = explode('-', $yearMonth);
        $yearMonthLabel = ($mesesPt[$mes] ?? $mes) . ' de ' . $ano;

        // Cálculos e Agrupamentos
        $totalWebsites      = count($websites);
        $connectedWebsites  = 0;
        $scores             = [];
        $totalScheduled     = 0;
        $completedCount     = 0;
        $overdueCount       = 0;
        $todayCount         = 0;
        $upcomingCount      = 0;
        $notScheduledCount  = 0;

        $maintenanceTasks = [];
        $securityRadar    = [];
        $integrityRadar   = [];

        foreach ($websites as $site) {
            if (!empty($site['is_connected']) && (int)$site['is_connected'] === 1) {
                $connectedWebsites++;
            }

            if ($site['latest_score'] !== null) {
                $scores[] = (int)$site['latest_score'];
            }

            $mStatus = $site['maintenance_status'] ?? [];
            $statusKey = $mStatus['status'] ?? 'not_scheduled';

            if (!empty($site['maintenance_day'])) {
                $totalScheduled++;
            } else {
                $notScheduledCount++;
            }

            switch ($statusKey) {
                case 'completed':
                    $completedCount++;
                    break;
                case 'overdue':
                    $overdueCount++;
                    break;
                case 'today':
                    $todayCount++;
                    break;
                case 'upcoming':
                    $upcomingCount++;
                    break;
            }

            // Item para a fila de manutenções
            $maintenanceTasks[] = [
                'website_id'       => $site['id'],
                'website_name'     => $site['name'],
                'website_url'      => $site['url'],
                'environment'      => $site['environment'],
                'is_owner'         => (bool)$site['is_owner'],
                'owner_name'       => $site['owner_name'],
                'maintenance_day'  => $site['maintenance_day'],
                'status'           => $statusKey,
                'label'            => $mStatus['label'] ?? 'N/A',
                'badge_color'      => $mStatus['badge_color'] ?? 'gray',
                'target_day'       => $mStatus['target_day'] ?? $site['maintenance_day'],
                'target_date'      => $mStatus['target_date'] ?? null,
                'completed_at'     => $mStatus['completed_at'] ?? null,
                'completed_by'     => $mStatus['completed_by'] ?? null,
                'notes'            => $mStatus['notes'] ?? null,
                'latest_score'     => $site['latest_score'],
                'latest_grade'     => $site['latest_grade'] ?? null,
            ];

            // Item para o radar de segurança
            $securityRadar[] = [
                'website_id'        => $site['id'],
                'website_name'      => $site['name'],
                'website_url'       => $site['url'],
                'environment'       => $site['environment'],
                'is_connected'      => (int)$site['is_connected'] === 1,
                'latest_score'      => $site['latest_score'],
                'latest_grade'      => $site['latest_grade'] ?? null,
                'latest_scanned_at' => $site['latest_scanned_at'] ?? null,
                'days_since_scan'   => $site['days_since_security_scan'] ?? null,
                'is_outdated'       => (bool)($site['security_scan_outdated'] ?? true),
                'is_critical'       => ($site['latest_score'] !== null && $site['latest_score'] < 70),
                'needs_scan'        => empty($site['latest_scanned_at']),
            ];

            // Item para o radar de integridade do core
            $integrityRadar[] = [
                'website_id'        => $site['id'],
                'website_name'      => $site['name'],
                'website_url'       => $site['url'],
                'environment'       => $site['environment'],
                'is_connected'      => (int)$site['is_connected'] === 1,
                'total_checked'     => isset($site['integrity_total_checked']) ? (int)$site['integrity_total_checked'] : null,
                'passed'            => isset($site['integrity_passed']) ? (int)$site['integrity_passed'] : null,
                'issues_count'      => isset($site['integrity_issues_count']) ? (int)$site['integrity_issues_count'] : null,
                'ignored_issues'    => isset($site['integrity_ignored_issues']) ? (int)$site['integrity_ignored_issues'] : 0,
                'modified'          => isset($site['integrity_modified']) ? (int)$site['integrity_modified'] : 0,
                'suspicious'        => isset($site['integrity_suspicious']) ? (int)$site['integrity_suspicious'] : 0,
                'is_secure'         => $site['integrity_is_secure'] ?? null,
                'last_scanned_at'   => $site['last_integrity_scanned_at'] ?? null,
                'days_since_scan'   => $site['days_since_integrity_scan'] ?? null,
                'is_outdated'       => (bool)($site['integrity_scan_outdated'] ?? true),
                'needs_scan'        => empty($site['last_integrity_scanned_at']),
            ];
        }

        // Ordenação das tarefas de manutenção por prioridade:
        // 1. overdue -> 2. today -> 3. upcoming -> 4. completed -> 5. not_scheduled
        $priorityOrder = [
            'overdue'       => 1,
            'today'         => 2,
            'upcoming'      => 3,
            'completed'     => 4,
            'not_scheduled' => 5,
        ];

        usort($maintenanceTasks, function ($a, $b) use ($priorityOrder) {
            $pA = $priorityOrder[$a['status']] ?? 99;
            $pB = $priorityOrder[$b['status']] ?? 99;
            if ($pA !== $pB) {
                return $pA <=> $pB;
            }
            if ($a['status'] === 'upcoming') {
                return ($a['target_day'] ?? 99) <=> ($b['target_day'] ?? 99);
            }
            return strcmp($a['website_name'], $b['website_name']);
        });

        // Ordenar radar de segurança: os 6 piores sites
        // Critérios: menor score primeiro (sem score = -1 vem antes), quem está desatualizado (+30 dias) tem prioridade
        usort($securityRadar, function ($a, $b) {
            $scoreA = $a['latest_score'] ?? -1;
            $scoreB = $b['latest_score'] ?? -1;

            if ($scoreA !== $scoreB) {
                return $scoreA <=> $scoreB; // menor score primeiro
            }

            if ($a['is_outdated'] !== $b['is_outdated']) {
                return $b['is_outdated'] <=> $a['is_outdated'];
            }

            $daysA = $a['days_since_scan'] ?? 9999;
            $daysB = $b['days_since_scan'] ?? 9999;
            if ($daysA !== $daysB) {
                return $daysB <=> $daysA;
            }

            return strcmp($a['website_name'], $b['website_name']);
        });
        $securityRadar = array_slice($securityRadar, 0, 6);

        // Ordenar radar de integridade: os 6 piores sites
        // Critérios: maior quantidade de arquivos com problema primeiro; quem nunca checou ou está > 30 dias sem checar vem antes de sites limpos
        usort($integrityRadar, function ($a, $b) {
            $issuesA = $a['issues_count'] ?? -1;
            $issuesB = $b['issues_count'] ?? -1;

            // Se algum tem issues detectadas (> 0), o maior número de erros é pior
            if ($issuesA > 0 || $issuesB > 0) {
                if ($issuesA !== $issuesB) {
                    return $issuesB <=> $issuesA; // mais erros primeiro
                }
            }

            // Nunca checado (-1) é pior do que checado e limpo (0)
            if ($issuesA !== $issuesB) {
                return $issuesA <=> $issuesB;
            }

            // Desatualizado (>30 dias) vem antes de checado recentemente
            if ($a['is_outdated'] !== $b['is_outdated']) {
                return $b['is_outdated'] <=> $a['is_outdated'];
            }

            $daysA = $a['days_since_scan'] ?? 9999;
            $daysB = $b['days_since_scan'] ?? 9999;
            if ($daysA !== $daysB) {
                return $daysB <=> $daysA;
            }

            return strcmp($a['website_name'], $b['website_name']);
        });
        $integrityRadar = array_slice($integrityRadar, 0, 6);

        $averageScore = count($scores) > 0 ? (int)round(array_sum($scores) / count($scores)) : null;
        $progressPercent = $totalScheduled > 0 ? (int)round(($completedCount / $totalScheduled) * 100) : 0;

        // Consumo, Cota de IA e Detalhes do Plano do Usuário
        $planDetails = $effectiveUserId ? \App\Services\UserPlanService::getUserPlanDetails($effectiveUserId) : null;

        $aiLogModel      = new \App\Models\AiUsageLogModel();
        $basePrice       = (float) \App\Models\SettingsModel::getSetting('ai_token_price_per_1k', '0.00');
        $promptPrice     = (float) \App\Models\SettingsModel::getSetting('ai_prompt_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');
        $completionPrice = (float) \App\Models\SettingsModel::getSetting('ai_completion_token_price_per_1k', $basePrice > 0 ? (string)$basePrice : '0.00');

        $monthStats = $effectiveUserId ? $aiLogModel->getUserMonthlyTokenStats($effectiveUserId) : [
            'prompt_tokens'     => 0,
            'completion_tokens' => 0,
            'total_tokens'      => 0,
            'total_requests'    => 0,
        ];

        $aiEnabled = $planDetails ? (int)$planDetails['ai_enabled'] : 1;
        $aiMonthlyTokenLimit = $planDetails ? (int)$planDetails['effective_ai_token_limit'] : 250000;
        $isUnlimited = false; // Regra de segurança: IA nunca é ilimitada
        $usedTokens = (int) $monthStats['total_tokens'];
        $percentUsed = $aiMonthlyTokenLimit > 0 ? min(100, (int) round(($usedTokens / $aiMonthlyTokenLimit) * 100)) : 100;
        $tokensRemaining = max(0, $aiMonthlyTokenLimit - $usedTokens);
        $estimatedCost = round((($monthStats['prompt_tokens'] / 1000) * $promptPrice) + (($monthStats['completion_tokens'] / 1000) * $completionPrice), 2);

        $aiUsage = [
            'ai_enabled'            => $aiEnabled,
            'monthly_token_limit'   => $aiMonthlyTokenLimit,
            'is_unlimited'          => $isUnlimited,
            'current_month_tokens'  => $usedTokens,
            'percent_used'          => $percentUsed,
            'tokens_remaining'      => $tokensRemaining,
            'estimated_cost'        => $estimatedCost,
            'token_price_per_1k'    => $basePrice,
        ];

        return $this->respond([
            'status' => 200,
            'data'   => [
                'year_month'       => $yearMonth,
                'year_month_label' => $yearMonthLabel,
                'metrics'          => [
                    'total_websites'      => $totalWebsites,
                    'connected_websites'  => $connectedWebsites,
                    'pending_websites'    => $totalWebsites - $connectedWebsites,
                    'average_score'       => $averageScore,
                    'total_scheduled'     => $totalScheduled,
                    'completed_count'     => $completedCount,
                    'overdue_count'       => $overdueCount,
                    'today_count'         => $todayCount,
                    'upcoming_count'      => $upcomingCount,
                    'not_scheduled_count' => $notScheduledCount,
                    'progress_percent'    => $progressPercent,
                    'urgent_tasks_count'  => $overdueCount + $todayCount,
                ],
                'plan_details'     => $planDetails,
                'ai_usage'         => $aiUsage,
                'maintenances'     => $maintenanceTasks,
                'security_radar'   => $securityRadar,
                'integrity_radar'  => $integrityRadar,
            ],
        ]);
    }
}
