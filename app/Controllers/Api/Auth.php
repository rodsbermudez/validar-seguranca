<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\UserModel;
use App\Libraries\JWTAuth;

class Auth extends ResourceController
{
    protected $format = 'json';

    public function login()
    {
        $json = $this->request->getJSON(true) ?? $this->request->getPost();

        $email    = $json['email'] ?? '';
        $password = $json['password'] ?? '';

        if (empty($email) || empty($password)) {
            return $this->fail('Email e senha são obrigatórios.', 400);
        }

        $userModel = new UserModel();
        $user = $userModel->where('email', $email)->first();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            return $this->failUnauthorized('Credenciais inválidas.');
        }

        if (isset($user['is_active']) && (int)$user['is_active'] === 0) {
            return $this->failUnauthorized('Sua conta está desativada. Entre em contato com o administrador.');
        }

        $token = JWTAuth::generateToken($user);

        return $this->respond([
            'status'  => 200,
            'message' => 'Login realizado com sucesso.',
            'token'   => $token,
            'user'    => [
                'id'    => $user['id'],
                'name'  => $user['name'],
                'email' => $user['email'],
                'role'  => $user['role'] ?? 'user',
            ]
        ]);
    }
}
