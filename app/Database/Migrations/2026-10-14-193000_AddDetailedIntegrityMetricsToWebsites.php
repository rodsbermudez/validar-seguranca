<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDetailedIntegrityMetricsToWebsites extends Migration
{
    public function up()
    {
        $fields = [
            'integrity_total_checked' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
                'default'    => null,
                'after'      => 'integrity_is_secure',
            ],
            'integrity_passed' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
                'default'    => null,
                'after'      => 'integrity_total_checked',
            ],
            'integrity_ignored_issues' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
                'default'    => 0,
                'after'      => 'integrity_passed',
            ],
            'integrity_modified' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
                'default'    => 0,
                'after'      => 'integrity_ignored_issues',
            ],
            'integrity_suspicious' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
                'default'    => 0,
                'after'      => 'integrity_modified',
            ],
            'integrity_summary_json' => [
                'type'       => 'LONGTEXT',
                'null'       => true,
                'default'    => null,
                'after'      => 'integrity_suspicious',
            ],
        ];

        $this->forge->addColumn('websites', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('websites', [
            'integrity_total_checked',
            'integrity_passed',
            'integrity_ignored_issues',
            'integrity_modified',
            'integrity_suspicious',
            'integrity_summary_json',
        ]);
    }
}
