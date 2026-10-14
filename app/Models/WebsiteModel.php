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
                (SELECT score FROM scan_history WHERE website_id = w.id AND status = 'completed' ORDER BY executed_at DESC LIMIT 1) AS latest_score,
                (SELECT executed_at FROM scan_history WHERE website_id = w.id AND status = 'completed' ORDER BY executed_at DESC LIMIT 1) AS latest_scanned_at,
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
        }

        return $websites;
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

