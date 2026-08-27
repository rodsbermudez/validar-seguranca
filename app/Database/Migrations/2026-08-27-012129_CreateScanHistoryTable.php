<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateScanHistoryTable extends Migration
{
    public function up()
    {
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
            'status' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'default'    => 'pending',
            ],
            'score' => [
                'type'       => 'INT',
                'constraint' => 3,
                'null'       => true,
            ],
            'scan_results_json' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'executed_at' => [
                'type' => 'DATETIME',
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
        $this->forge->addForeignKey('website_id', 'websites', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('scan_history');
    }

    public function down()
    {
        $this->forge->dropTable('scan_history');
    }
}
