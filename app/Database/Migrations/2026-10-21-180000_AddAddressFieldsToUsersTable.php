<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddAddressFieldsToUsersTable extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('users')) {
            $fields = [];

            if (!$this->db->fieldExists('postal_code', 'users')) {
                $fields['postal_code'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 20,
                    'null'       => true,
                    'after'      => 'phone',
                ];
            }

            if (!$this->db->fieldExists('address', 'users')) {
                $fields['address'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 255,
                    'null'       => true,
                    'after'      => 'postal_code',
                ];
            }

            if (!$this->db->fieldExists('address_number', 'users')) {
                $fields['address_number'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 30,
                    'null'       => true,
                    'after'      => 'address',
                ];
            }

            if (!$this->db->fieldExists('complement', 'users')) {
                $fields['complement'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                    'null'       => true,
                    'after'      => 'address_number',
                ];
            }

            if (!$this->db->fieldExists('province', 'users')) {
                $fields['province'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                    'null'       => true,
                    'after'      => 'complement',
                ];
            }

            if (!$this->db->fieldExists('city', 'users')) {
                $fields['city'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                    'null'       => true,
                    'after'      => 'province',
                ];
            }

            if (!$this->db->fieldExists('state', 'users')) {
                $fields['state'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'null'       => true,
                    'after'      => 'city',
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
            $cols = ['postal_code', 'address', 'address_number', 'complement', 'province', 'city', 'state'];
            foreach ($cols as $col) {
                if ($this->db->fieldExists($col, 'users')) {
                    $this->forge->dropColumn('users', $col);
                }
            }
        }
    }
}
