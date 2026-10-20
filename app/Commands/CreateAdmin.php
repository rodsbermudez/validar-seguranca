<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Models\UserModel;

class CreateAdmin extends BaseCommand
{
    protected $group       = 'Auth';
    protected $name        = 'user:create-admin';
    protected $description = 'Cria ou redefine a senha de um usuário Administrador no sistema';
    protected $usage       = 'user:create-admin [email] [senha] [nome]';
    protected $arguments   = [
        'email'    => 'E-mail do administrador (padrão: admin@vexors.app)',
        'password' => 'Senha do administrador (padrão: admin123)',
        'name'     => 'Nome do administrador (padrão: Administrador)',
    ];

    public function run(array $params)
    {
        $email    = $params[0] ?? 'admin@vexors.app';
        $password = $params[1] ?? 'admin123';
        $name     = $params[2] ?? 'Administrador';

        $userModel = new UserModel();
        $user = $userModel->where('email', $email)->first();

        $hash = password_hash($password, PASSWORD_BCRYPT);

        if ($user) {
            $userModel->update($user['id'], [
                'name'          => $name,
                'role'          => 'admin',
                'is_active'     => 1,
                'password_hash' => $hash,
                'updated_at'    => date('Y-m-d H:i:s'),
            ]);
            CLI::write("✓ Administrador [{$email}] atualizado com sucesso!", 'green');
        } else {
            $userModel->insert([
                'name'          => $name,
                'email'         => $email,
                'role'          => 'admin',
                'is_active'     => 1,
                'password_hash' => $hash,
                'created_at'    => date('Y-m-d H:i:s'),
                'updated_at'    => date('Y-m-d H:i:s'),
            ]);
            CLI::write("✓ Novo usuário Administrador [{$email}] criado com sucesso!", 'green');
        }

        CLI::newLine();
        CLI::write("Credenciais ativas para login:", 'yellow');
        CLI::write("E-mail: " . $email, 'white');
        CLI::write("Senha:  " . $password, 'white');
        CLI::newLine();
    }
}
