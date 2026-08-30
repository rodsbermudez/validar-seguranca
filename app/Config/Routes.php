<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->get('/', 'Home::index');
$routes->get('docs', 'Docs::index');
$routes->get('docs/(:segment)', 'Docs::index/$1');

// OPTIONS handler for CORS pre-flight requests
$routes->options('(:any)', static function () {
    return response()->setStatusCode(200);
});

// API Routes
$routes->group('api', function ($routes) {
    // Public Auth route
    $routes->post('auth/login', 'Api\Auth::login');

    // Public Agent Connect Handshake route
    $routes->post('websites/connect', 'Api\Websites::connect');

    // Protected routes (JWT Auth required)
    $routes->group('', ['filter' => 'jwtAuth'], function ($routes) {
        $routes->get('websites', 'Api\Websites::index');
        $routes->post('websites', 'Api\Websites::create');
        $routes->put('websites/(:num)', 'Api\Websites::update/$1');
        $routes->delete('websites/(:num)', 'Api\Websites::delete/$1');
        $routes->get('websites/(:num)/download-plugin', 'Api\Websites::downloadPlugin/$1');
        $routes->get('websites/(:num)/logs', 'Api\Websites::logs/$1');
        $routes->post('websites/(:num)/logs/toggle', 'Api\Websites::toggleLogs/$1');
        $routes->post('websites/(:num)/logs/clear', 'Api\Websites::clearLogs/$1');

        // Scan routes
        $routes->post('scan/trigger/(:num)', 'Api\Scan::trigger/$1');
        $routes->get('scan/history/(:num)', 'Api\Scan::history/$1');

        // User management routes (Admin)
        $routes->get('users', 'Api\Users::index');
        $routes->post('users', 'Api\Users::create');
        $routes->put('users/(:num)', 'Api\Users::update/$1');
        $routes->post('users/(:num)/toggle-status', 'Api\Users::toggleStatus/$1');
        $routes->delete('users/(:num)', 'Api\Users::delete/$1');

        // Solution Catalog routes (Admin)
        $routes->get('solutions', 'Api\SolutionCatalog::index');
        $routes->put('solutions/(:num)', 'Api\SolutionCatalog::update/$1');
        $routes->post('solutions/generate-single', 'Api\SolutionCatalog::generateSingle');
        $routes->post('solutions/generate-batch', 'Api\SolutionCatalog::generateBatch');

        // Remediation Plugin Generation route
        $routes->post('remediation/generate-plugin', 'Api\Remediation::generatePlugin');
        $routes->post('remediation/generate-server-guide', 'Api\Remediation::generateServerGuide');
    });
});

