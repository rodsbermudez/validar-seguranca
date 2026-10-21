<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AlterUpdatesSummaryJsonToLongtext extends Migration
{
    public function up()
    {
        $fields = [
            'updates_summary_json' => [
                'name'    => 'updates_summary_json',
                'type'    => 'LONGTEXT',
                'null'    => true,
                'default' => null,
            ],
        ];

        $this->forge->modifyColumn('websites', $fields);
    }

    public function down()
    {
        $fields = [
            'updates_summary_json' => [
                'name'    => 'updates_summary_json',
                'type'    => 'TEXT',
                'null'    => true,
                'default' => null,
            ],
        ];

        $this->forge->modifyColumn('websites', $fields);
    }
}
