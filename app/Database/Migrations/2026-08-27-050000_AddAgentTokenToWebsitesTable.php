<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddAgentTokenToWebsitesTable extends Migration
{
    public function up()
    {
        $fields = [
            'agent_token' => [
                'type'       => 'VARCHAR',
                'constraint' => '64',
                'null'       => true,
                'after'      => 'environment',
            ],
            'is_connected' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 0,
                'after'      => 'agent_token',
            ],
            'connected_at' => [
                'type' => 'DATETIME',
                'null' => true,
                'after' => 'is_connected',
            ],
        ];

        $this->forge->addColumn('websites', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('websites', ['agent_token', 'is_connected', 'connected_at']);
    }
}
