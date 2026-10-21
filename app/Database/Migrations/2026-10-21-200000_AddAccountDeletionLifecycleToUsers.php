<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddAccountDeletionLifecycleToUsers extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('users')) {
            $fields = [];

            if (!$this->db->fieldExists('account_status', 'users')) {
                $fields['account_status'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 30,
                    'default'    => 'active',
                    'after'      => 'is_active',
                ];
            }

            if (!$this->db->fieldExists('deletion_requested_at', 'users')) {
                $fields['deletion_requested_at'] = [
                    'type' => 'DATETIME',
                    'null' => true,
                    'after' => 'account_status',
                ];
            }

            if (!$this->db->fieldExists('deletion_scheduled_at', 'users')) {
                $fields['deletion_scheduled_at'] = [
                    'type' => 'DATETIME',
                    'null' => true,
                    'after' => 'deletion_requested_at',
                ];
            }

            if (!$this->db->fieldExists('previous_plan_id', 'users')) {
                $fields['previous_plan_id'] = [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'null'       => true,
                    'after'      => 'deletion_scheduled_at',
                ];
            }

            if (!$this->db->fieldExists('previous_sites_count', 'users')) {
                $fields['previous_sites_count'] = [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'null'       => true,
                    'after'      => 'previous_plan_id',
                ];
            }

            if (!$this->db->fieldExists('purged_at', 'users')) {
                $fields['purged_at'] = [
                    'type' => 'DATETIME',
                    'null' => true,
                    'after' => 'previous_sites_count',
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
                'account_status',
                'deletion_requested_at',
                'deletion_scheduled_at',
                'previous_plan_id',
                'previous_sites_count',
                'purged_at',
            ];

            foreach ($columnsToDrop as $col) {
                if ($this->db->fieldExists($col, 'users')) {
                    $this->forge->dropColumn('users', $col);
                }
            }
        }
    }
}
