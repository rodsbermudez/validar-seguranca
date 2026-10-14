<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddIntegrityTrackingToWebsites extends Migration
{
    public function up()
    {
        $fields = [
            'last_integrity_scanned_at' => [
                'type' => 'DATETIME',
                'null' => true,
                'after' => 'maintenance_day',
            ],
            'integrity_issues_count' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
                'default'    => null,
                'after'      => 'last_integrity_scanned_at',
            ],
            'integrity_is_secure' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => true,
                'default'    => null,
                'after'      => 'integrity_issues_count',
            ],
        ];

        $this->forge->addColumn('websites', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('websites', [
            'last_integrity_scanned_at',
            'integrity_issues_count',
            'integrity_is_secure',
        ]);
    }
}
