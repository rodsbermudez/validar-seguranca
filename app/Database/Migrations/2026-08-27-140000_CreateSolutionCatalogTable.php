<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSolutionCatalogTable extends Migration
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
            'check_id' => [
                'type'       => 'VARCHAR',
                'constraint' => '100',
                'unique'     => true,
            ],
            'check_name' => [
                'type'       => 'VARCHAR',
                'constraint' => '255',
            ],
            'action_type' => [
                'type'       => 'ENUM',
                'constraint' => ['PLUGIN_AUTO_FIX', 'SERVER_CONFIG', 'MANUAL_ACTION'],
                'default'    => 'PLUGIN_AUTO_FIX',
            ],
            'problem_description' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'solution_title' => [
                'type'       => 'VARCHAR',
                'constraint' => '255',
                'null'       => true,
            ],
            'solution_instructions' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'fix_code_snippet' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'ai_notes' => [
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
        $this->forge->createTable('solution_catalog');
    }

    public function down()
    {
        $this->forge->dropTable('solution_catalog');
    }
}
