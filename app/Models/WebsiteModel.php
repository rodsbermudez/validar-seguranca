<?php

namespace App\Models;

use CodeIgniter\Model;

class WebsiteModel extends Model
{
    protected $table            = 'websites';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'user_id',
        'name',
        'url',
        'environment',
        'maintenance_day',
        'last_integrity_scanned_at',
        'integrity_issues_count',
        'integrity_is_secure',
        'integrity_total_checked',
        'integrity_passed',
        'integrity_ignored_issues',
        'integrity_modified',
        'integrity_suspicious',
        'integrity_summary_json',
        'last_updates_checked_at',
        'updates_pending_count',
        'updates_summary_json',
        'last_logs_checked_at',
        'logs_fatal_count',
        'logs_summary_json',
        'public_log_token',
        'agent_token',
        'is_connected',
        'connected_at',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Retorna todos os websites que o usuário é dono ou que foram compartilhados com ele,
     * incluindo score mais recente e status da manutenção do mês corrente.
     */
    public function getUserWebsites(int $userId, ?string $yearMonth = null): array
    {
        $db = \Config\Database::connect();
        $currentMonth = $yearMonth ?: date('Y-m');

        $sql = "
            SELECT 
                w.*,
                u.name AS owner_name,
                u.email AS owner_email,
                CASE WHEN w.user_id = ? THEN 1 ELSE 0 END AS is_owner,
                CASE WHEN w.user_id = ? THEN 'owner' ELSE COALESCE(ws.role, 'viewer') END AS user_role,
                (SELECT COUNT(*) FROM website_shares WHERE website_id = w.id) AS shares_count,
                (SELECT score FROM scan_history WHERE website_id = w.id AND status = 'completed' ORDER BY executed_at DESC, id DESC LIMIT 1) AS latest_score,
                (SELECT executed_at FROM scan_history WHERE website_id = w.id AND status = 'completed' ORDER BY executed_at DESC, id DESC LIMIT 1) AS latest_scanned_at,
                wm.completed_at AS maintenance_completed_at,
                wm.notes AS maintenance_notes,
                wmu.name AS maintenance_completed_by
            FROM websites w
            INNER JOIN users u ON u.id = w.user_id
            LEFT JOIN website_shares ws ON ws.website_id = w.id AND ws.user_id = ?
            LEFT JOIN website_maintenances wm ON wm.website_id = w.id AND wm.year_month = ?
            LEFT JOIN users wmu ON wmu.id = wm.user_id
            WHERE w.user_id = ? OR ws.user_id = ?
            GROUP BY w.id
            ORDER BY w.created_at DESC
        ";

        $query = $db->query($sql, [$userId, $userId, $userId, $currentMonth, $userId, $userId]);
        $websites = $query->getResultArray();

        foreach ($websites as &$site) {
            $this->enrichWebsiteData($site, $currentMonth);
        }

        return $websites;
    }

    /**
     * Retorna um único website do usuário com todas as métricas calculadas.
     */
    public function getUserWebsite(int $userId, int $websiteId, ?string $yearMonth = null, bool $isAdmin = false): ?array
    {
        $db = \Config\Database::connect();
        $currentMonth = $yearMonth ?: date('Y-m');

        if ($isAdmin) {
            $sql = "
                SELECT 
                    w.*,
                    u.name AS owner_name,
                    u.email AS owner_email,
                    CASE WHEN w.user_id = ? THEN 1 ELSE 0 END AS is_owner,
                    CASE WHEN w.user_id = ? THEN 'owner' ELSE COALESCE(ws.role, 'viewer') END AS user_role,
                    (SELECT COUNT(*) FROM website_shares WHERE website_id = w.id) AS shares_count,
                    (SELECT score FROM scan_history WHERE website_id = w.id AND status = 'completed' ORDER BY executed_at DESC, id DESC LIMIT 1) AS latest_score,
                    (SELECT executed_at FROM scan_history WHERE website_id = w.id AND status = 'completed' ORDER BY executed_at DESC, id DESC LIMIT 1) AS latest_scanned_at,
                    wm.completed_at AS maintenance_completed_at,
                    wm.notes AS maintenance_notes,
                    wmu.name AS maintenance_completed_by
                FROM websites w
                INNER JOIN users u ON u.id = w.user_id
                LEFT JOIN website_shares ws ON ws.website_id = w.id AND ws.user_id = ?
                LEFT JOIN website_maintenances wm ON wm.website_id = w.id AND wm.year_month = ?
                LEFT JOIN users wmu ON wmu.id = wm.user_id
                WHERE w.id = ?
                GROUP BY w.id
                LIMIT 1
            ";
            $query = $db->query($sql, [$userId, $userId, $userId, $currentMonth, $websiteId]);
        } else {
            $sql = "
                SELECT 
                    w.*,
                    u.name AS owner_name,
                    u.email AS owner_email,
                    CASE WHEN w.user_id = ? THEN 1 ELSE 0 END AS is_owner,
                    CASE WHEN w.user_id = ? THEN 'owner' ELSE COALESCE(ws.role, 'viewer') END AS user_role,
                    (SELECT COUNT(*) FROM website_shares WHERE website_id = w.id) AS shares_count,
                    (SELECT score FROM scan_history WHERE website_id = w.id AND status = 'completed' ORDER BY executed_at DESC, id DESC LIMIT 1) AS latest_score,
                    (SELECT executed_at FROM scan_history WHERE website_id = w.id AND status = 'completed' ORDER BY executed_at DESC, id DESC LIMIT 1) AS latest_scanned_at,
                    wm.completed_at AS maintenance_completed_at,
                    wm.notes AS maintenance_notes,
                    wmu.name AS maintenance_completed_by
                FROM websites w
                INNER JOIN users u ON u.id = w.user_id
                LEFT JOIN website_shares ws ON ws.website_id = w.id AND ws.user_id = ?
                LEFT JOIN website_maintenances wm ON wm.website_id = w.id AND wm.year_month = ?
                LEFT JOIN users wmu ON wmu.id = wm.user_id
                WHERE w.id = ? AND (w.user_id = ? OR ws.user_id = ?)
                GROUP BY w.id
                LIMIT 1
            ";
            $query = $db->query($sql, [$userId, $userId, $userId, $currentMonth, $websiteId, $userId, $userId]);
        }
        $site = $query->getRowArray();

        if (!$site) {
            return null;
        }

        $this->enrichWebsiteData($site, $currentMonth);
        return $site;
    }

    /**
     * Enriquece o array do website com status calculado, frescor de auditoria e manutenção.
     */
    public function enrichWebsiteData(array &$site, string $currentMonth): void
    {
        $site['id']                     = (int)$site['id'];
        $site['user_id']                = (int)$site['user_id'];
        $site['is_owner']               = (bool)$site['is_owner'];
        $site['shares_count']           = (int)($site['shares_count'] ?? 0);
        $site['maintenance_day']        = ($site['maintenance_day'] !== null && $site['maintenance_day'] !== '') ? (int)$site['maintenance_day'] : null;
        $site['latest_score']           = $site['latest_score'] !== null ? (int)$site['latest_score'] : null;
        $site['integrity_issues_count'] = $site['integrity_issues_count'] !== null ? (int)$site['integrity_issues_count'] : null;
        $site['integrity_is_secure']    = $site['integrity_is_secure'] !== null ? (bool)$site['integrity_is_secure'] : null;

        if ($site['latest_score'] !== null) {
            if ($site['latest_score'] >= 90) {
                $site['latest_grade'] = 'A';
            } elseif ($site['latest_score'] >= 75) {
                $site['latest_grade'] = 'B';
            } elseif ($site['latest_score'] >= 60) {
                $site['latest_grade'] = 'C';
            } elseif ($site['latest_score'] >= 40) {
                $site['latest_grade'] = 'D';
            } else {
                $site['latest_grade'] = 'F';
            }
        } else {
            $site['latest_grade'] = null;
        }

        // Freshness da Auditoria de Segurança
        if (!empty($site['latest_scanned_at'])) {
            $scanTimestamp = strtotime($site['latest_scanned_at']);
            $diffDays = (int)floor((time() - $scanTimestamp) / 86400);
            $site['days_since_security_scan'] = max(0, $diffDays);
            $site['security_scan_outdated']   = ($diffDays > 30);
        } else {
            $site['days_since_security_scan'] = null;
            $site['security_scan_outdated']   = true; // Nunca auditado
        }

        // Freshness da Verificação de Integridade
        if (!empty($site['last_integrity_scanned_at'])) {
            $intTimestamp = strtotime($site['last_integrity_scanned_at']);
            $diffDays = (int)floor((time() - $intTimestamp) / 86400);
            $site['days_since_integrity_scan'] = max(0, $diffDays);
            $site['integrity_scan_outdated']   = ($diffDays > 30);
        } else {
            $site['days_since_integrity_scan'] = null;
            $site['integrity_scan_outdated']   = true; // Nunca verificado
        }

        $record = !empty($site['maintenance_completed_at']) ? [
            'completed_at' => $site['maintenance_completed_at'],
            'user_name'    => $site['maintenance_completed_by'],
            'notes'        => $site['maintenance_notes'],
        ] : null;

        $site['maintenance_status'] = \App\Models\WebsiteMaintenanceModel::calculateStatus(
            $site['maintenance_day'],
            $record,
            $currentMonth
        );
        $site['maintenance'] = $site['maintenance_status'];

        // Freshness do Agente Diagnostic Vexors
        $site['latest_agent_version'] = self::getLatestAgentVersion();
        $site['agent_version']        = null;
        $site['is_agent_outdated']    = false;

        if (!empty($site['updates_summary_json'])) {
            $updates = json_decode($site['updates_summary_json'], true);
            if (!empty($updates['server_environment']['agent_version'])) {
                $site['agent_version'] = $updates['server_environment']['agent_version'];
            }
            if (empty($site['agent_version']) && !empty($updates['plugins']) && is_array($updates['plugins'])) {
                foreach ($updates['plugins'] as $p) {
                    if (!empty($p['is_protected']) || (isset($p['file']) && (strpos($p['file'], 'validar-seguranca') !== false || strpos($p['file'], 'vexors') !== false))) {
                        $site['agent_version'] = $p['current_version'] ?? null;
                        break;
                    }
                }
            }
        }

        if (!empty($site['agent_version'])) {
            $site['is_agent_outdated'] = version_compare($site['agent_version'], $site['latest_agent_version'], '<');
        }
    }

    public static function getLatestAgentVersion(): string
    {
        $mainFile = ROOTPATH . 'plugin-template/validar-seguranca-agent/validar-seguranca-agent.php';
        if (file_exists($mainFile)) {
            $content = file_get_contents($mainFile);
            if (preg_match("/define\(\s*['\"]VS_AGENT_VERSION['\"]\s*,\s*['\"]([^'\"]+)['\"]\s*\)/", $content, $m)) {
                return $m[1];
            }
        }
        return '1.0.6';
    }

    /**
     * Verifica se o usuário tem permissão para acessar ou gerenciar o website.
     */
    public function canUserAccess(int $websiteId, int $userId, bool $isAdmin = false, bool $requireOwner = false): bool
    {
        if ($isAdmin) {
            return true;
        }

        $website = $this->find($websiteId);
        if (!$website) {
            return false;
        }

        if ((int)$website['user_id'] === $userId) {
            return true;
        }

        if ($requireOwner) {
            return false;
        }

        $shareModel = new WebsiteShareModel();
        $share = $shareModel->where('website_id', $websiteId)
                            ->where('user_id', $userId)
                            ->first();

        return !empty($share);
    }
}

