<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDiagnosticMetricsToWebsites extends Migration
{
    public function up()
    {
        $fields = [
            'last_updates_checked_at' => [
                'type'    => 'DATETIME',
                'null'    => true,
                'default' => null,
                'after'   => 'integrity_summary_json',
            ],
            'updates_pending_count' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
                'default'    => null,
                'after'      => 'last_updates_checked_at',
            ],
            'updates_summary_json' => [
                'type'    => 'TEXT',
                'null'    => true,
                'default' => null,
                'after'   => 'updates_pending_count',
            ],
            'last_logs_checked_at' => [
                'type'    => 'DATETIME',
                'null'    => true,
                'default' => null,
                'after'   => 'updates_summary_json',
            ],
            'logs_fatal_count' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
                'default'    => null,
                'after'      => 'last_logs_checked_at',
            ],
            'logs_summary_json' => [
                'type'    => 'TEXT',
                'null'    => true,
                'default' => null,
                'after'   => 'logs_fatal_count',
            ],
        ];

        $this->forge->addColumn('websites', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('websites', [
            'last_updates_checked_at',
            'updates_pending_count',
            'updates_summary_json',
            'last_logs_checked_at',
            'logs_fatal_count',
            'logs_summary_json',
        ]);
    }
}
