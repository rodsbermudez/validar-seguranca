<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->get('/', 'Home::index');
$routes->get('shared-activity-log/(:segment)', 'Home::index');
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

    // Public Activity Logs route for clients (no auth required)
    $routes->get('public/activity-logs/(:segment)', 'Api\Websites::publicActivityLogs/$1');

    // Public Plans Catalog route for Landing Page
    $routes->get('public/plans', 'Api\Plans::publicIndex');
    $routes->get('public/payment-methods', 'Api\Settings::publicPaymentMethods');

    // Public Checkout & Asaas Payments
    $routes->post('public/checkout/initiate', 'Api\Checkout::initiate');
    $routes->post('public/checkout/check-email', 'Api\Checkout::checkEmail');
    $routes->get('public/checkout/status/(:segment)', 'Api\Checkout::status/$1');
    $routes->post('public/checkout/simulate-confirm/(:segment)', 'Api\Checkout::simulateConfirm/$1');

    // Asaas Webhook
    $routes->post('public/webhooks/asaas', 'Api\PaymentWebhooks::asaas');

    // Protected routes (JWT Auth required)
    $routes->group('', ['filter' => 'jwtAuth'], function ($routes) {
        $routes->get('websites', 'Api\Websites::index');
        $routes->get('websites/(:num)', 'Api\Websites::show/$1');
        $routes->post('websites', 'Api\Websites::create');
        $routes->put('websites/(:num)', 'Api\Websites::update/$1');
        $routes->delete('websites/(:num)', 'Api\Websites::delete/$1');
        $routes->get('websites/(:num)/download-plugin', 'Api\Websites::downloadPlugin/$1');
        $routes->get('websites/(:num)/logs', 'Api\Websites::logs/$1');
        $routes->post('websites/(:num)/logs/toggle', 'Api\Websites::toggleLogs/$1');
        $routes->post('websites/(:num)/logs/clear', 'Api\Websites::clearLogs/$1');
        $routes->get('websites/(:num)/updates', 'Api\Websites::updates/$1');
        $routes->post('websites/(:num)/updates/apply', 'Api\Websites::applyUpdate/$1');
        $routes->get('websites/(:num)/integrity', 'Api\Websites::integrity/$1');
        $routes->post('websites/(:num)/integrity/scan', 'Api\Websites::scanIntegrity/$1');
        $routes->post('websites/(:num)/integrity/ignore', 'Api\Websites::ignoreIntegrityIssue/$1');
        $routes->post('websites/(:num)/integrity/delete-file', 'Api\Websites::deleteIntegrityFile/$1');
        $routes->post('websites/(:num)/integrity/restore-file', 'Api\Websites::restoreIntegrityFile/$1');
        $routes->post('websites/sync-integrity', 'Api\Websites::syncIntegrityAll');
        $routes->get('websites/(:num)/diagnostic-summary', 'Api\Websites::diagnosticSummary/$1');
        $routes->get('websites/(:num)/fixes', 'Api\Websites::fixes/$1');
        $routes->post('websites/(:num)/fixes/toggle', 'Api\Websites::toggleFix/$1');
        $routes->get('websites/(:num)/shares', 'Api\Websites::shares/$1');
        $routes->post('websites/(:num)/shares', 'Api\Websites::addShare/$1');
        $routes->delete('websites/(:num)/shares/(:num)', 'Api\Websites::removeShare/$1/$2');

        // Website Maintenance Cycle routes
        $routes->post('websites/(:num)/maintenance/complete', 'Api\Websites::completeMaintenance/$1');
        $routes->delete('websites/(:num)/maintenance/complete', 'Api\Websites::uncompleteMaintenance/$1');
        $routes->get('websites/(:num)/maintenance/history', 'Api\Websites::maintenanceHistory/$1');

        // Website Activity Logs & Technical Notes routes
        $routes->get('websites/(:num)/activity-logs', 'Api\Websites::activityLogs/$1');
        $routes->get('websites/(:num)/public-log-token', 'Api\Websites::getPublicLogToken/$1');
        $routes->post('websites/(:num)/public-log-token/regenerate', 'Api\Websites::regeneratePublicLogToken/$1');
        $routes->post('websites/(:num)/notes', 'Api\Websites::createNote/$1');
        $routes->put('websites/(:num)/notes/(:num)', 'Api\Websites::updateNote/$1/$2');
        $routes->delete('websites/(:num)/notes/(:num)', 'Api\Websites::deleteNote/$1/$2');

        // Dashboard Overview route
        $routes->get('dashboard/overview', 'Api\Dashboard::overview');

        // Scan routes
        $routes->post('scan/trigger/(:num)', 'Api\Scan::trigger/$1');
        $routes->get('scan/history/(:num)', 'Api\Scan::history/$1');

        // Plans Catalog routes
        $routes->get('plans', 'Api\Plans::index');
        $routes->post('plans', 'Api\Plans::create');
        $routes->put('plans/(:num)', 'Api\Plans::update/$1');
        $routes->delete('plans/(:num)', 'Api\Plans::delete/$1');

        // User management routes (Admin)
        $routes->get('users', 'Api\Users::index');
        $routes->post('users', 'Api\Users::create');
        $routes->put('users/(:num)', 'Api\Users::update/$1');
        $routes->post('users/(:num)/toggle-status', 'Api\Users::toggleStatus/$1');
        $routes->delete('users/(:num)', 'Api\Users::delete/$1');
        $routes->get('users/(:num)/ai-metrics', 'Api\Users::aiMetrics/$1');
        $routes->put('users/(:num)/ai-limits', 'Api\Users::updateAiLimits/$1');
        $routes->get('users/(:num)/plan', 'Api\Users::planDetails/$1');
        $routes->put('users/(:num)/plan', 'Api\Users::updatePlan/$1');
        $routes->get('users/(:num)/ai-logs', 'Api\Users::aiLogs/$1');

        // Solution Catalog routes (Admin)
        $routes->get('solutions', 'Api\SolutionCatalog::index');
        $routes->put('solutions/(:num)', 'Api\SolutionCatalog::update/$1');
        $routes->post('solutions/generate-single', 'Api\SolutionCatalog::generateSingle');
        $routes->post('solutions/generate-batch', 'Api\SolutionCatalog::generateBatch');

        // Remediation Plugin Generation route
        $routes->post('remediation/generate-plugin', 'Api\Remediation::generatePlugin');
        $routes->post('remediation/generate-server-guide', 'Api\Remediation::generateServerGuide');

        // Platform Settings routes (Admin)
        $routes->get('settings', 'Api\Settings::index');
        $routes->post('settings', 'Api\Settings::update');

        // AI Global Monitoring & Reporting routes (Admin)
        $routes->get('ai-monitoring/metrics', 'Api\AiMonitoring::metrics');
        $routes->get('ai-monitoring/logs', 'Api\AiMonitoring::logs');

        // Platform Error Logs routes (Admin)
        $routes->get('platform-errors', 'Api\PlatformErrors::index');
        $routes->get('platform-errors/metrics', 'Api\PlatformErrors::metrics');
        $routes->get('platform-errors/filters', 'Api\PlatformErrors::filters');
        $routes->get('platform-errors/(:num)', 'Api\PlatformErrors::show/$1');
        $routes->put('platform-errors/(:num)/status', 'Api\PlatformErrors::updateStatus/$1');
        $routes->delete('platform-errors/clear', 'Api\PlatformErrors::clear');

        // Subscription routes
        $routes->get('subscriptions/current', 'Api\Subscriptions::current');
        $routes->post('subscriptions/cancel', 'Api\Subscriptions::cancel');
        $routes->post('subscriptions/preview-change', 'Api\Subscriptions::previewChange');
        $routes->post('subscriptions/upgrade-plan', 'Api\Subscriptions::upgradePlan');
        $routes->post('subscriptions/manage-addons', 'Api\Subscriptions::manageAddons');
        $routes->post('subscriptions/confirm-prorated-pix', 'Api\Subscriptions::confirmProratedPix');
    });
});

