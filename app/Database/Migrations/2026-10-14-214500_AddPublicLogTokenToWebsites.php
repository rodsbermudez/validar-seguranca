<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPublicLogTokenToWebsites extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('websites')) {
            $fields = [];
            if (!$this->db->fieldExists('public_log_token', 'websites')) {
                $fields['public_log_token'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 64,
                    'null'       => true,
                    'after'      => 'integrity_summary_json',
                ];
            }

            if (!empty($fields)) {
                $this->forge->addColumn('websites', $fields);
                $this->db->query("CREATE INDEX idx_websites_public_log_token ON websites (public_log_token)");
            }
        }
    }

    public function down()
    {
        if ($this->db->tableExists('websites')) {
            if ($this->db->fieldExists('public_log_token', 'websites')) {
                $this->forge->dropColumn('websites', 'public_log_token');
            }
        }
    }
}
