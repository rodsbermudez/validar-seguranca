<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePlatformErrorLogsTable extends Migration
{
    public function up()
    {
        if (!$this->db->tableExists('platform_error_logs')) {
            $this->forge->addField([
                'id' => [
                    'type'           => 'INT',
                    'constraint'     => 11,
                    'unsigned'       => true,
                    'auto_increment' => true,
                ],
                'severity' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 20,
                    'default'    => 'error', // critical, error, warning, info
                ],
                'category' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'default'    => 'agent_connection',
                ],
                'website_id' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'null'       => true,
                ],
                'website_name' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 255,
                    'null'       => true,
                ],
                'website_url' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 255,
                    'null'       => true,
                ],
                'user_id' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'null'       => true,
                ],
                'user_email' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 255,
                    'null'       => true,
                ],
                'endpoint' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 500,
                    'null'       => true,
                ],
                'http_method' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 10,
                    'default'    => 'GET',
                ],
                'http_status' => [
                    'type'       => 'INT',
                    'constraint' => 5,
                    'null'       => true,
                ],
                'error_message' => [
                    'type' => 'TEXT',
                    'null' => true,
                ],
                'curl_error' => [
                    'type' => 'TEXT',
                    'null' => true,
                ],
                'request_payload' => [
                    'type' => 'LONGTEXT',
                    'null' => true,
                ],
                'response_body' => [
                    'type' => 'LONGTEXT',
                    'null' => true,
                ],
                'suggested_solution' => [
                    'type' => 'TEXT',
                    'null' => true,
                ],
                'status' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 20,
                    'default'    => 'unresolved', // unresolved, investigating, resolved, ignored
                ],
                'admin_notes' => [
                    'type' => 'TEXT',
                    'null' => true,
                ],
                'resolved_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
                ],
                'resolved_by' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'null'       => true,
                ],
                'ip_address' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 45,
                    'null'       => true,
                ],
                'user_agent' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 255,
                    'null'       => true,
                ],
                'created_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
                ],
                'updated_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
                ],
            ]);

            $this->forge->addKey('id', true);
            $this->forge->addKey(['status', 'created_at']);
            $this->forge->addKey(['website_id', 'created_at']);
            $this->forge->addKey(['user_id', 'created_at']);
            $this->forge->addKey('category');
            $this->forge->addKey('severity');

            $this->forge->addForeignKey('website_id', 'websites', 'id', 'SET NULL', 'SET NULL');
            $this->forge->addForeignKey('user_id', 'users', 'id', 'SET NULL', 'SET NULL');
            $this->forge->addForeignKey('resolved_by', 'users', 'id', 'SET NULL', 'SET NULL');

            $this->forge->createTable('platform_error_logs');
        }
    }

    public function down()
    {
        if ($this->db->tableExists('platform_error_logs')) {
            $this->forge->dropTable('platform_error_logs');
        }
    }
}
