<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\UserModel;

class Users extends ResourceController
{
    protected $format = 'json';

    public function index()
    {
        $userData = $this->request->userData ?? null;

        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Acesso restrito a administradores.');
        }

        $userModel = new UserModel();
        $users = $userModel
            ->select('id, name, email, role, is_active, created_at')
            ->orderBy('created_at', 'DESC')
            ->findAll();

        return $this->respond([
            'status' => 200,
            'data'   => $users,
        ]);
    }

    public function create()
    {
        $userData = $this->request->userData ?? null;

        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Acesso restrito a administradores.');
        }

        $json = $this->request->getJSON(true) ?? $this->request->getPost();

        $name     = trim($json['name'] ?? '');
        $email    = trim($json['email'] ?? '');
        $password = trim($json['password'] ?? '');
        $isAdmin  = !empty($json['is_admin']) || ($json['role'] ?? '') === 'admin';

        if (empty($name) || empty($email) || empty($password)) {
            return $this->fail('Nome, email e senha são obrigatórios.', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->fail('Formato de e-mail inválido.', 400);
        }

        $userModel = new UserModel();

        if ($userModel->where('email', $email)->first()) {
            return $this->fail('Este e-mail já está cadastrado no sistema.', 400);
        }

        $role = $isAdmin ? 'admin' : 'user';

        $newId = $userModel->insert([
            'name'          => $name,
            'email'         => $email,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
            'role'          => $role,
            'is_active'     => 1,
        ]);

        $createdUser = $userModel->select('id, name, email, role, is_active, created_at')->find($newId);

        return $this->respondCreated([
            'status'  => 201,
            'message' => 'Usuário cadastrado com sucesso.',
            'data'    => $createdUser,
        ]);
    }

    public function update($id = null)
    {
        $userData = $this->request->userData ?? null;

        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Acesso restrito a administradores.');
        }

        if (!$id) {
            return $this->fail('ID do usuário não informado.', 400);
        }

        $userModel = new UserModel();
        $user = $userModel->find($id);

        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        $json = $this->request->getJSON(true) ?? $this->request->getRawInput();

        $name     = trim($json['name'] ?? $user['name']);
        $email    = trim($json['email'] ?? $user['email']);
        $password = trim($json['password'] ?? '');
        $isAdmin  = isset($json['is_admin']) ? !empty($json['is_admin']) : (isset($json['role']) ? $json['role'] === 'admin' : $user['role'] === 'admin');

        if (empty($name) || empty($email)) {
            return $this->fail('Nome e e-mail são obrigatórios.', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->fail('Formato de e-mail inválido.', 400);
        }

        // Check unique email for another user
        $existing = $userModel->where('email', $email)->where('id !=', $id)->first();
        if ($existing) {
            return $this->fail('Este e-mail já está em uso por outro usuário.', 400);
        }

        $dataToUpdate = [
            'name'  => $name,
            'email' => $email,
            'role'  => $isAdmin ? 'admin' : 'user',
        ];

        if (isset($json['is_active'])) {
            // Prevent admin deactivating their logged in account
            if ($id == $userData->id && (int)$json['is_active'] === 0) {
                return $this->fail('Você não pode desativar sua própria conta de administrador.', 400);
            }
            $dataToUpdate['is_active'] = (int) $json['is_active'];
        }

        if (!empty($password)) {
            $dataToUpdate['password_hash'] = password_hash($password, PASSWORD_BCRYPT);
        }

        $userModel->update($id, $dataToUpdate);

        $updatedUser = $userModel->select('id, name, email, role, is_active, created_at')->find($id);

        return $this->respond([
            'status'  => 200,
            'message' => 'Usuário atualizado com sucesso.',
            'data'    => $updatedUser,
        ]);
    }

    public function toggleStatus($id = null)
    {
        $userData = $this->request->userData ?? null;

        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Acesso restrito a administradores.');
        }

        if (!$id) {
            return $this->fail('ID do usuário não informado.', 400);
        }

        if ($id == $userData->id) {
            return $this->fail('Você não pode desativar sua própria conta de administrador.', 400);
        }

        $userModel = new UserModel();
        $user = $userModel->find($id);

        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        $newStatus = (int)$user['is_active'] === 1 ? 0 : 1;
        $userModel->update($id, ['is_active' => $newStatus]);

        return $this->respond([
            'status'  => 200,
            'message' => $newStatus === 1 ? 'Usuário ativado com sucesso.' : 'Usuário desativado com sucesso.',
            'is_active' => $newStatus,
        ]);
    }

    public function delete($id = null)
    {
        $userData = $this->request->userData ?? null;

        if (($userData->role ?? 'user') !== 'admin') {
            return $this->failForbidden('Acesso restrito a administradores.');
        }

        if (!$id) {
            return $this->fail('ID do usuário não informado.', 400);
        }

        if ($id == $userData->id) {
            return $this->fail('Você não pode excluir sua própria conta de administrador.', 400);
        }

        $userModel = new UserModel();
        $user = $userModel->find($id);

        if (!$user) {
            return $this->failNotFound('Usuário não encontrado.');
        }

        $userModel->delete($id);

        return $this->respond([
            'status'  => 200,
            'message' => 'Usuário removido com sucesso.',
        ]);
    }
}
