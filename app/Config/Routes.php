<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->get('/', 'Home::index');

// OPTIONS handler for CORS pre-flight requests
$routes->options('(:any)', static function () {
    return response()->setStatusCode(200);
});

// API Routes
$routes->group('api', function ($routes) {
    // Public Auth route
    $routes->post('auth/login', 'Api\Auth::login');

    // Protected routes (JWT Auth required)
    $routes->group('', ['filter' => 'jwtAuth'], function ($routes) {
        $routes->get('websites', 'Api\Websites::index');
        $routes->post('websites', 'Api\Websites::create');
        $routes->put('websites/(:num)', 'Api\Websites::update/$1');
        $routes->delete('websites/(:num)', 'Api\Websites::delete/$1');

        // Scan routes
        $routes->post('scan/trigger/(:num)', 'Api\Scan::trigger/$1');
        $routes->get('scan/history/(:num)', 'Api\Scan::history/$1');

        // User management routes (Admin)
        $routes->get('users', 'Api\Users::index');
        $routes->post('users', 'Api\Users::create');
        $routes->put('users/(:num)', 'Api\Users::update/$1');
        $routes->post('users/(:num)/toggle-status', 'Api\Users::toggleStatus/$1');
        $routes->delete('users/(:num)', 'Api\Users::delete/$1');
    });
});
