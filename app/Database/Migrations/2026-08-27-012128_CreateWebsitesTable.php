<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateWebsitesTable extends Migration
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
            'user_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
            ],
            'url' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
            ],
            'environment' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'default'    => 'production',
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
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('websites');
    }

    public function down()
    {
        $this->forge->dropTable('websites');
    }
}
