<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run()
    {
        $users = [
            [
                'name'          => 'Administrador',
                'email'         => 'admin@validar.local',
                'password_hash' => password_hash('admin123', PASSWORD_BCRYPT),
                'role'          => 'admin',
                'is_active'     => 1,
                'created_at'    => date('Y-m-d H:i:s'),
                'updated_at'    => date('Y-m-d H:i:s'),
            ],
            [
                'name'          => 'Administrador',
                'email'         => 'admin@validar.seguranca',
                'password_hash' => password_hash('admin123', PASSWORD_BCRYPT),
                'role'          => 'admin',
                'is_active'     => 1,
                'created_at'    => date('Y-m-d H:i:s'),
                'updated_at'    => date('Y-m-d H:i:s'),
            ],
        ];

        $db = \Config\Database::connect();
        $builder = $db->table('users');

        foreach ($users as $data) {
            $existing = $builder->where('email', $data['email'])->get()->getRow();
            if (!$existing) {
                $builder->insert($data);
            } else {
                $builder->where('email', $data['email'])->update([
                    'role'          => 'admin',
                    'is_active'     => 1,
                    'password_hash' => password_hash('admin123', PASSWORD_BCRYPT),
                ]);
            }
        }
    }
}
