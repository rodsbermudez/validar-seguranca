<?php

namespace App\Services;

class BrandingService
{
    public const AUTHOR_NAME = 'Rodrigo Bermudez - Patropi Comunica';
    public const AUTHOR_URI  = 'https://patropicomunica.com.br';

    public static function getFaviconDataUri(): string
    {
        $baseDir = defined('ROOTPATH') ? ROOTPATH : dirname(__DIR__, 2) . '/';
        $path = $baseDir . 'public/favicon.png';
        if (file_exists($path)) {
            return 'data:image/png;base64,' . base64_encode(file_get_contents($path));
        }
        return '';
    }

    public static function getLogoDataUri(): string
    {
        $baseDir = defined('ROOTPATH') ? ROOTPATH : dirname(__DIR__, 2) . '/';
        $pathSvg = $baseDir . 'public/images/logo-sutehub.svg';
        if (file_exists($pathSvg)) {
            return 'data:image/svg+xml;base64,' . base64_encode(file_get_contents($pathSvg));
        }
        $path = $baseDir . 'public/images/logo-Patropi.png';
        if (file_exists($path)) {
            return 'data:image/png;base64,' . base64_encode(file_get_contents($path));
        }
        return '';
    }
}
