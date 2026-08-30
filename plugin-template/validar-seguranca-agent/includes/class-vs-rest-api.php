<?php

if (!defined('ABSPATH')) {
    exit;
}

class VS_Agent_REST_API {

    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
        add_filter('rest_authentication_errors', array($this, 'bypass_auth_for_agent'), 9999);
    }

    public function register_routes() {
        register_rest_route('wp-patropi/v1', '/internal-audit', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'handle_internal_audit'),
            'permission_callback' => array($this, 'check_permission'),
        ));

        register_rest_route('wp-patropi/v1', '/logs', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'handle_get_logs'),
            'permission_callback' => array($this, 'check_permission'),
        ));

        register_rest_route('wp-patropi/v1', '/logs/toggle', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'handle_toggle_logs'),
            'permission_callback' => array($this, 'check_permission'),
        ));

        register_rest_route('wp-patropi/v1', '/logs/clear', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'handle_clear_logs'),
            'permission_callback' => array($this, 'check_permission'),
        ));
    }

    public function bypass_auth_for_agent($result) {
        $route = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
        if (strpos($route, '/wp-patropi/v1/') !== false) {
            $token_saved  = get_option('vs_agent_token');
            $token_header = $this->get_token_from_request();

            if (!empty($token_saved) && is_string($token_saved) && !empty($token_header) && is_string($token_header)) {
                if (hash_equals($token_saved, $token_header)) {
                    return true;
                }
            }
        }
        return $result;
    }

    private function get_token_from_request() {
        if (isset($_SERVER['HTTP_X_VALIDAR_SEGURANCA_TOKEN'])) {
            return trim($_SERVER['HTTP_X_VALIDAR_SEGURANCA_TOKEN']);
        }
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            foreach ($headers as $name => $value) {
                if (strtolower($name) === 'x-validar-seguranca-token') {
                    return trim($value);
                }
            }
        }
        return null;
    }

    public function check_permission($request) {
        $token_header = $request->get_header('x-validar-seguranca-token');
        if (empty($token_header)) {
            $token_header = $this->get_token_from_request();
        }
        $token_saved = get_option('vs_agent_token');

        if (empty($token_saved) || !is_string($token_saved) || empty($token_header) || !is_string($token_header)) {
            return new WP_Error('vs_forbidden', 'Token de acesso não fornecido ou inválido.', array('status' => 403));
        }

        if (hash_equals($token_saved, $token_header)) {
            return true;
        }

        return new WP_Error('vs_unauthorized', 'Token de acesso incorreto.', array('status' => 401));
    }

    public function handle_internal_audit($request) {
        $collector = new VS_Agent_Collector();
        $data      = $collector->collect_all();

        return new WP_REST_Response(array(
            'status'  => 200,
            'success' => true,
            'data'    => $data,
        ), 200);
    }

    public function handle_get_logs($request) {
        $limit        = $request->get_param('limit') ? (int) $request->get_param('limit') : 100;
        $filter_level = $request->get_param('filter_level') ? sanitize_text_field($request->get_param('filter_level')) : 'all';

        $logging_enabled = (bool) get_option('vs_logging_enabled', 0);
        $logs            = VS_Agent_Logger::get_logs($limit, $filter_level);

        return new WP_REST_Response(array(
            'status'          => 200,
            'success'         => true,
            'logging_enabled' => $logging_enabled,
            'total'           => count($logs),
            'logs'            => $logs,
        ), 200);
    }

    public function handle_toggle_logs($request) {
        $current   = (int) get_option('vs_logging_enabled', 0);
        $new_state = $current ? 0 : 1;
        update_option('vs_logging_enabled', $new_state);

        if ($new_state) {
            VS_Agent_Logger::enable_error_logging();
        }

        return new WP_REST_Response(array(
            'status'          => 200,
            'success'         => true,
            'logging_enabled' => (bool) $new_state,
            'message'         => $new_state ? 'Log do WordPress ativado com sucesso.' : 'Log do WordPress desativado.',
        ), 200);
    }

    public function handle_clear_logs($request) {
        VS_Agent_Logger::clear_logs();

        return new WP_REST_Response(array(
            'status'  => 200,
            'success' => true,
            'message' => 'Arquivo de logs limpo com sucesso.',
        ), 200);
    }
}
