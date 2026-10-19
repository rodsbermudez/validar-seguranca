<?php

namespace App\Services;

class BrandingService
{
    public const AUTHOR_NAME = 'Vexores';
    public const AUTHOR_URI  = 'https://vexors.app';

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
        $pathVexors = $baseDir . 'public/images/vexors-logo.svg';
        if (file_exists($pathVexors)) {
            return 'data:image/svg+xml;base64,' . base64_encode(file_get_contents($pathVexors));
        }
        $pathSvg = $baseDir . 'public/images/logo-sitehub.svg';
        if (file_exists($pathSvg)) {
            return 'data:image/svg+xml;base64,' . base64_encode(file_get_contents($pathSvg));
        }
        $pathSvgOld = $baseDir . 'public/images/logo-sutehub.svg';
        if (file_exists($pathSvgOld)) {
            return 'data:image/svg+xml;base64,' . base64_encode(file_get_contents($pathSvgOld));
        }
        $path = $baseDir . 'public/images/logo-Patropi.png';
        if (file_exists($path)) {
            return 'data:image/png;base64,' . base64_encode(file_get_contents($path));
        }
        return '';
    }
}
