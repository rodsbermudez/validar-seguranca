<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateWebsiteUpdateHistoryTable extends Migration
{
    public function up()
    {
        if (!$this->db->tableExists('website_update_history')) {
            $this->forge->addField([
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
                    'default'    => 'plugin', // 'plugin', 'theme', 'core'
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
                    'default'    => 'applied', // 'applied', 'rolled_back', 'failed'
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

            $this->forge->addKey('id', true);
            $this->forge->addKey(['website_id', 'item_type', 'item_slug']);
            $this->forge->addKey('created_at');

            if ($this->db->tableExists('websites')) {
                $this->forge->addForeignKey('website_id', 'websites', 'id', 'CASCADE', 'CASCADE');
            }

            $this->forge->createTable('website_update_history');
        }
    }

    public function down()
    {
        if ($this->db->tableExists('website_update_history')) {
            $this->forge->dropTable('website_update_history');
        }
    }
}
