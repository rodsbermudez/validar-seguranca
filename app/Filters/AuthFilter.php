<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use App\Libraries\JWTAuth;
use App\Models\UserModel;
use Config\Services;

class AuthFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $header = $request->getHeaderLine('Authorization');
        $token = null;

        if (!empty($header)) {
            if (preg_match('/Bearer\s(\S+)/', $header, $matches)) {
                $token = $matches[1];
            }
        }

        $userData = JWTAuth::validateToken($token);

        if (!$userData) {
            $response = Services::response();
            return $response->setStatusCode(401)->setJSON([
                'status'  => 401,
                'error'   => 'Não autorizado. Token de acesso ausente ou inválido.'
            ]);
        }

        // Default effective user ID is the authenticated user ID
        $effectiveUserId = (int) $userData->id;
        $isImpersonating = false;

        // Impersonation feature for admins
        $impersonateHeader = $request->getHeaderLine('X-Impersonate-User-Id');
        if (!empty($impersonateHeader) && isset($userData->role) && $userData->role === 'admin') {
            $userModel = new UserModel();
            $targetUser = $userModel->find((int) $impersonateHeader);
            if ($targetUser) {
                $effectiveUserId = (int) $targetUser['id'];
                $isImpersonating = true;
            }
        }

        $request->userData = $userData;
        $request->effectiveUserId = $effectiveUserId;
        $request->isImpersonating = $isImpersonating;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        // No post-processing needed
    }
}
