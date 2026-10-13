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
    protected $allowedFields    = ['user_id', 'name', 'url', 'environment', 'agent_token', 'is_connected', 'connected_at'];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Retorna todos os websites que o usuário é dono ou que foram compartilhados com ele.
     */
    public function getUserWebsites(int $userId): array
    {
        $db = \Config\Database::connect();
        $sql = "
            SELECT 
                w.*,
                u.name AS owner_name,
                u.email AS owner_email,
                CASE WHEN w.user_id = ? THEN 1 ELSE 0 END AS is_owner,
                CASE WHEN w.user_id = ? THEN 'owner' ELSE COALESCE(ws.role, 'viewer') END AS user_role,
                (SELECT COUNT(*) FROM website_shares WHERE website_id = w.id) AS shares_count
            FROM websites w
            INNER JOIN users u ON u.id = w.user_id
            LEFT JOIN website_shares ws ON ws.website_id = w.id AND ws.user_id = ?
            WHERE w.user_id = ? OR ws.user_id = ?
            GROUP BY w.id
            ORDER BY w.created_at DESC
        ";

        $query = $db->query($sql, [$userId, $userId, $userId, $userId, $userId]);
        return $query->getResultArray();
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

