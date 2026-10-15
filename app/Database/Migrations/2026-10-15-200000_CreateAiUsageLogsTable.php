<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateAiUsageLogsTable extends Migration
{
    public function up()
    {
        // 1. Criar tabela de logs de uso de IA
        if (!$this->db->tableExists('ai_usage_logs')) {
            $this->forge->addField([
                'id' => [
                    'type'           => 'INT',
                    'constraint'     => 11,
                    'unsigned'       => true,
                    'auto_increment' => true,
                ],
                'user_id' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                ],
                'website_id' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'null'       => true,
                ],
                'action_type' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                ],
                'model' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                ],
                'prompt_tokens' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'default'    => 0,
                ],
                'completion_tokens' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'default'    => 0,
                ],
                'total_tokens' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'default'    => 0,
                ],
                'duration_ms' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'default'    => 0,
                ],
                'status' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 20,
                    'default'    => 'success',
                ],
                'error_message' => [
                    'type' => 'TEXT',
                    'null' => true,
                ],
                'created_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
                ],
            ]);

            $this->forge->addKey('id', true);
            $this->forge->addKey(['user_id', 'created_at']);
            $this->forge->addKey('website_id');
            $this->forge->addKey('action_type');
            $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('website_id', 'websites', 'id', 'SET NULL', 'SET NULL');
            $this->forge->createTable('ai_usage_logs');
        }

        // 2. Adicionar campos de limites e governança de IA na tabela users
        if ($this->db->tableExists('users')) {
            $userFields = [];
            if (!$this->db->fieldExists('ai_enabled', 'users')) {
                $userFields['ai_enabled'] = [
                    'type'       => 'TINYINT',
                    'constraint' => 1,
                    'default'    => 1,
                    'after'      => 'is_active',
                ];
            }
            if (!$this->db->fieldExists('ai_monthly_token_limit', 'users')) {
                $userFields['ai_monthly_token_limit'] = [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'null'       => true,
                    'default'    => null,
                    'after'      => 'ai_enabled',
                ];
            }

            if (!empty($userFields)) {
                $this->forge->addColumn('users', $userFields);
            }
        }
    }

    public function down()
    {
        if ($this->db->tableExists('ai_usage_logs')) {
            $this->forge->dropTable('ai_usage_logs');
        }

        if ($this->db->tableExists('users')) {
            if ($this->db->fieldExists('ai_monthly_token_limit', 'users')) {
                $this->forge->dropColumn('users', 'ai_monthly_token_limit');
            }
            if ($this->db->fieldExists('ai_enabled', 'users')) {
                $this->forge->dropColumn('users', 'ai_enabled');
            }
        }
    }
}
