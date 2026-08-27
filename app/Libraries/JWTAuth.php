<?php

namespace App\Libraries;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Exception;

class JWTAuth
{
    private static function getSecretKey(): string
    {
        return getenv('JWT_SECRET') ?: 'validar_seguranca_secret_key_2026_super_secure';
    }

    public static function generateToken(array $userData): string
    {
        $issuedAt = time();
        $expirationTime = $issuedAt + (60 * 60 * 24); // 24 hours validity

        $payload = [
            'iat'  => $issuedAt,
            'exp'  => $expirationTime,
            'data' => [
                'id'    => $userData['id'],
                'name'  => $userData['name'],
                'email' => $userData['email'],
                'role'  => $userData['role'] ?? 'user',
            ]
        ];

        return JWT::encode($payload, self::getSecretKey(), 'HS256');
    }

    public static function validateToken(?string $token): ?object
    {
        if (empty($token)) {
            return null;
        }

        try {
            $decoded = JWT::decode($token, new Key(self::getSecretKey(), 'HS256'));
            return $decoded->data ?? null;
        } catch (Exception $e) {
            return null;
        }
    }
}
