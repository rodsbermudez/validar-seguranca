<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddMaintenanceCycleToWebsites extends Migration
{
    public function up()
    {
        // 1. Adicionar maintenance_day na tabela websites
        if (!$this->db->fieldExists('maintenance_day', 'websites')) {
            $this->forge->addColumn('websites', [
                'maintenance_day' => [
                    'type'       => 'TINYINT',
                    'constraint' => 2,
                    'unsigned'   => true,
                    'null'       => true,
                    'default'    => null,
                    'after'      => 'environment',
                ],
            ]);
        }

        // 2. Criar tabela website_maintenances para histórico mês a mês
        if (!$this->db->tableExists('website_maintenances')) {
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
                'year_month' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 7, // 'YYYY-MM', ex: '2026-10'
                ],
                'completed_at' => [
                    'type' => 'DATETIME',
                ],
                'notes' => [
                    'type' => 'TEXT',
                    'null' => true,
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
            $this->forge->addUniqueKey(['website_id', 'year_month']);
            $this->forge->addKey('year_month');
            $this->forge->addKey('website_id');
            $this->forge->addForeignKey('website_id', 'websites', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('website_maintenances');
        }
    }

    public function down()
    {
        if ($this->db->tableExists('website_maintenances')) {
            $this->forge->dropTable('website_maintenances');
        }

        if ($this->db->fieldExists('maintenance_day', 'websites')) {
            $this->forge->dropColumn('websites', 'maintenance_day');
        }
    }
}
