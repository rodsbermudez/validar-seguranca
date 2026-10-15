<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateWebsiteNotesTable extends Migration
{
    public function up()
    {
        if (!$this->db->tableExists('website_notes')) {
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
                ],
                'title' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 255,
                    'null'       => true,
                ],
                'category' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'default'    => 'geral',
                ],
                'content' => [
                    'type' => 'TEXT',
                ],
                'action_date' => [
                    'type' => 'DATETIME',
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
            $this->forge->addKey('website_id');
            $this->forge->addKey('action_date');

            if ($this->db->tableExists('websites')) {
                $this->forge->addForeignKey('website_id', 'websites', 'id', 'CASCADE', 'CASCADE');
            }
            if ($this->db->tableExists('users')) {
                $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
            }

            $this->forge->createTable('website_notes');
        }
    }

    public function down()
    {
        if ($this->db->tableExists('website_notes')) {
            $this->forge->dropTable('website_notes');
        }
    }
}
