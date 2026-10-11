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
        $namespaces = array('wp-patropi/v1', 'validar-seguranca/v1');

        foreach ($namespaces as $ns) {
            register_rest_route($ns, '/internal-audit', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_internal_audit'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/logs', array(
                'methods'             => array('GET', 'POST'),
                'callback'            => array($this, 'handle_get_logs'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/logs/toggle', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_toggle_logs'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/logs/clear', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_clear_logs'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/updates', array(
                'methods'             => array('GET', 'POST'),
                'callback'            => array($this, 'handle_get_updates'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/updates/apply', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_apply_update'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/integrity', array(
                'methods'             => array('GET', 'POST'),
                'callback'            => array($this, 'handle_get_integrity'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/integrity/scan', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_scan_integrity'),
                'permission_callback' => array($this, 'check_permission'),
            ));
        }
    }

    public function bypass_auth_for_agent($result) {
        $route = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
        if (
            strpos($route, '/wp-patropi/v1/') !== false ||
            strpos($route, '/validar-seguranca/v1/') !== false ||
            strpos($route, 'rest_route=%2Fwp-patropi') !== false ||
            strpos($route, 'rest_route=/wp-patropi') !== false ||
            strpos($route, 'rest_route=%2Fvalidar-seguranca') !== false ||
            strpos($route, 'rest_route=/validar-seguranca') !== false
        ) {
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

    private function get_token_from_request($request = null) {
        // 1. Header X-Validar-Seguranca-Token
        if (isset($_SERVER['HTTP_X_VALIDAR_SEGURANCA_TOKEN']) && !empty($_SERVER['HTTP_X_VALIDAR_SEGURANCA_TOKEN'])) {
            return trim($_SERVER['HTTP_X_VALIDAR_SEGURANCA_TOKEN']);
        }

        // 2. Authorization: Bearer <token>
        $auth_header = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] : '');
        if (empty($auth_header) && function_exists('getallheaders')) {
            $headers = getallheaders();
            foreach ($headers as $name => $value) {
                if (strtolower($name) === 'authorization') {
                    $auth_header = $value;
                    break;
                }
            }
        }
        if (!empty($auth_header) && preg_match('/Bearer\s+(\S+)/i', $auth_header, $matches)) {
            return trim($matches[1]);
        }

        // 3. Query string / GET parameters (vs_token, agent_token, token)
        if (isset($_GET['vs_token']) && !empty($_GET['vs_token'])) {
            return trim($_GET['vs_token']);
        }
        if (isset($_GET['agent_token']) && !empty($_GET['agent_token'])) {
            return trim($_GET['agent_token']);
        }

        // 4. POST parameters
        if (isset($_POST['vs_token']) && !empty($_POST['vs_token'])) {
            return trim($_POST['vs_token']);
        }

        // 5. WP_REST_Request object parameter check
        if ($request && is_a($request, 'WP_REST_Request')) {
            $param_token = $request->get_param('vs_token') ?: $request->get_param('agent_token');
            if (!empty($param_token)) {
                return trim($param_token);
            }
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
        $token_header = $this->get_token_from_request($request);
        $token_saved  = get_option('vs_agent_token');

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

    public function handle_get_updates($request) {
        $upgrader = new VS_Agent_Upgrader();
        $data     = $upgrader->get_updates();

        return new WP_REST_Response(array(
            'status'  => 200,
            'success' => true,
            'data'    => $data,
        ), 200);
    }

    public function handle_apply_update($request) {
        $type = $request->get_param('type');
        $item = $request->get_param('item');

        if (empty($type)) {
            $json = $request->get_json_params();
            if (!empty($json)) {
                $type = isset($json['type']) ? $json['type'] : null;
                $item = isset($json['item']) ? $json['item'] : null;
            }
        }

        $upgrader = new VS_Agent_Upgrader();
        $res      = $upgrader->apply_update($type, $item);

        if (is_wp_error($res)) {
            $status = is_array($res->get_error_data()) && isset($res->get_error_data()['status']) ? $res->get_error_data()['status'] : 500;
            return new WP_REST_Response(array(
                'status'  => $status,
                'success' => false,
                'message' => $res->get_error_message(),
            ), $status);
        }

        return new WP_REST_Response(array(
            'status'  => 200,
            'success' => true,
            'message' => isset($res['message']) ? $res['message'] : 'Atualização realizada com sucesso.',
        ), 200);
    }

    public function handle_get_integrity($request) {
        $integrity = new VS_Agent_Integrity();
        $res       = $integrity->get_last_result();

        return new WP_REST_Response($res, isset($res['status']) ? (int)$res['status'] : 200);
    }

    public function handle_scan_integrity($request) {
        $integrity = new VS_Agent_Integrity();
        $res       = $integrity->verify_core_integrity();

        return new WP_REST_Response($res, isset($res['status']) ? (int)$res['status'] : 200);
    }
}
