<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddOnboardingToUsersTable extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('users')) {
            $fields = [];

            if (!$this->db->fieldExists('onboarding_meta', 'users')) {
                $fields['onboarding_meta'] = [
                    'type' => 'TEXT',
                    'null' => true,
                    'after' => 'purged_at',
                ];
            }

            if (!$this->db->fieldExists('onboarding_reset_at', 'users')) {
                $fields['onboarding_reset_at'] = [
                    'type' => 'DATETIME',
                    'null' => true,
                    'after' => 'onboarding_meta',
                ];
            }

            if (!empty($fields)) {
                $this->forge->addColumn('users', $fields);
            }
        }
    }

    public function down()
    {
        if ($this->db->tableExists('users')) {
            $columnsToDrop = [
                'onboarding_reset_at',
                'onboarding_meta',
            ];

            foreach ($columnsToDrop as $col) {
                if ($this->db->fieldExists($col, 'users')) {
                    $this->forge->dropColumn('users', $col);
                }
            }
        }
    }
}
