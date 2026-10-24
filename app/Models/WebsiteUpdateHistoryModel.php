<?php

namespace App\Models;

use CodeIgniter\Model;

class WebsiteUpdateHistoryModel extends Model
{
    protected $table            = 'website_update_history';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'website_id',
        'user_id',
        'item_type',
        'item_slug',
        'item_name',
        'file_path',
        'from_version',
        'to_version',
        'backup_file',
        'backup_created',
        'had_warnings',
        'warnings_details',
        'status',
        'rolled_back_at',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Garante a existência da tabela website_update_history em runtime.
     */
    public function ensureTableExists(): void
    {
        try {
            if (!$this->db->tableExists($this->table)) {
                $forge = \Config\Database::forge();
                $forge->addField([
                    'id' => [
                        'type'           => 'INT',
                        'constraint'     => 11,
                        'unsigned'       => true,
                        'auto_increment' => true,
                    ],
                    'website_id' => [
                        'type'       => 'INT',
                        'constraint' => 11,
                        'unsigned'   => true,
                    ],
                    'user_id' => [
                        'type'       => 'INT',
                        'constraint' => 11,
                        'unsigned'   => true,
                        'null'       => true,
                    ],
                    'item_type' => [
                        'type'       => 'VARCHAR',
                        'constraint' => 20,
                        'default'    => 'plugin',
                    ],
                    'item_slug' => [
                        'type'       => 'VARCHAR',
                        'constraint' => 191,
                    ],
                    'item_name' => [
                        'type'       => 'VARCHAR',
                        'constraint' => 191,
                    ],
                    'file_path' => [
                        'type'       => 'VARCHAR',
                        'constraint' => 255,
                    ],
                    'from_version' => [
                        'type'       => 'VARCHAR',
                        'constraint' => 50,
                    ],
                    'to_version' => [
                        'type'       => 'VARCHAR',
                        'constraint' => 50,
                    ],
                    'backup_file' => [
                        'type'       => 'VARCHAR',
                        'constraint' => 255,
                        'null'       => true,
                    ],
                    'backup_created' => [
                        'type'       => 'TINYINT',
                        'constraint' => 1,
                        'default'    => 1,
                    ],
                    'had_warnings' => [
                        'type'       => 'TINYINT',
                        'constraint' => 1,
                        'default'    => 0,
                    ],
                    'warnings_details' => [
                        'type' => 'TEXT',
                        'null' => true,
                    ],
                    'status' => [
                        'type'       => 'VARCHAR',
                        'constraint' => 30,
                        'default'    => 'applied',
                    ],
                    'created_at' => [
                        'type' => 'DATETIME',
                        'null' => true,
                    ],
                    'rolled_back_at' => [
                        'type' => 'DATETIME',
                        'null' => true,
                    ],
                    'updated_at' => [
                        'type' => 'DATETIME',
                        'null' => true,
                    ],
                ]);

                $forge->addKey('id', true);
                $forge->addKey(['website_id', 'item_type', 'item_slug']);
                $forge->addKey('created_at');
                $forge->createTable($this->table, true);
            }
        } catch (\Throwable $e) {
            log_message('error', 'Erro ao verificar/criar tabela website_update_history: ' . $e->getMessage());
        }
    }

    /**
     * Retorna o histórico de atualizações para um website, ordenado pelos mais recentes.
     */
    public function getHistoryForWebsite(int $websiteId, int $limit = 30): array
    {
        $this->ensureTableExists();
        return $this->where('website_id', $websiteId)
                    ->orderBy('id', 'DESC')
                    ->findAll($limit);
    }

    /**
     * Retorna a última atualização aplicada de um item específico que ainda permite rollback.
     */
    public function getLatestRollbackableItem(int $websiteId, string $itemType, string $itemSlug): ?array
    {
        $this->ensureTableExists();
        return $this->where('website_id', $websiteId)
                    ->where('item_type', $itemType)
                    ->where('item_slug', $itemSlug)
                    ->whereIn('status', ['applied', 'deleted'])
                    ->orderBy('id', 'DESC')
                    ->first();
    }
}
