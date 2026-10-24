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
        $namespaces = array('vexors/v1', 'wp-patropi/v1', 'validar-seguranca/v1');

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

            register_rest_route($ns, '/updates/rollback', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_rollback_update'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/plugins/status', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_toggle_plugin_status'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/plugins/delete', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_delete_plugin'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/themes/delete', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_delete_theme'),
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

            register_rest_route($ns, '/integrity/ignore', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_toggle_ignore_integrity'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/integrity/delete-file', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_delete_integrity_file'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/integrity/restore-file', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_restore_integrity_file'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/fixes', array(
                'methods'             => array('GET', 'POST'),
                'callback'            => array($this, 'handle_get_fixes'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/fixes/toggle', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_toggle_fix'),
                'permission_callback' => array($this, 'check_permission'),
            ));

            register_rest_route($ns, '/connection/status', array(
                'methods'             => array('POST', 'GET'),
                'callback'            => array($this, 'handle_connection_status'),
                'permission_callback' => array($this, 'check_permission'),
            ));
        }
    }

    public function bypass_auth_for_agent($result) {
        $route = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
        if (
            strpos($route, '/vexors/v1/') !== false ||
            strpos($route, '/wp-patropi/v1/') !== false ||
            strpos($route, '/validar-seguranca/v1/') !== false ||
            strpos($route, 'rest_route=%2Fvexors') !== false ||
            strpos($route, 'rest_route=/vexors') !== false ||
            strpos($route, 'rest_route=%2Fwp-patropi') !== false ||
            strpos($route, 'rest_route=/wp-patropi') !== false ||
            strpos($route, 'rest_route=%2Fvalidar-seguranca') !== false ||
            strpos($route, 'rest_route=/validar-seguranca') !== false
        ) {
            $token_saved  = trim((string) get_option('vs_agent_token'));
            $token_header = trim((string) $this->get_token_from_request());

            if (!empty($token_saved) && !empty($token_header)) {
                if (hash_equals($token_saved, $token_header)) {
                    return true;
                }
            }
        }
        return $result;
    }

    private function get_token_from_request($request = null) {
        // 1. Header X-Vexors-Token or X-Validar-Seguranca-Token
        if (isset($_SERVER['HTTP_X_VEXORS_TOKEN']) && !empty($_SERVER['HTTP_X_VEXORS_TOKEN'])) {
            return trim($_SERVER['HTTP_X_VEXORS_TOKEN']);
        }
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
        $token_header = trim((string) $this->get_token_from_request($request));
        $token_saved  = trim((string) get_option('vs_agent_token'));

        if (empty($token_saved) || empty($token_header)) {
            return new WP_Error('vs_forbidden', 'Token de acesso não fornecido ou inválido.', array('status' => 403));
        }

        if (hash_equals($token_saved, $token_header)) {
            // Sincronização automática: se receber chamada autenticada válida do SaaS, marca como conectado no WordPress
            $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
            $param_conn = ($request && is_a($request, 'WP_REST_Request')) ? $request->get_param('connected') : null;
            $is_disconnect_call = (strpos($uri, '/connection/status') !== false && $param_conn !== null && (int)$param_conn === 0);

            if (!$is_disconnect_call && !get_option('vs_is_connected', 0)) {
                update_option('vs_is_connected', 1);
            }

            return true;
        }

        return new WP_Error('vs_unauthorized', 'Token de acesso incorreto.', array('status' => 401));
    }

    public function handle_connection_status($request) {
        $connected = ($request && is_a($request, 'WP_REST_Request')) ? $request->get_param('connected') : null;
        if ($connected !== null) {
            $is_conn = (int)$connected === 1 ? 1 : 0;
            update_option('vs_is_connected', $is_conn);
            return new WP_REST_Response(array(
                'status'    => 200,
                'success'   => true,
                'connected' => $is_conn,
                'message'   => $is_conn ? 'Plugin sincronizado como conectado.' : 'Plugin sincronizado como desconectado.',
            ), 200);
        }

        return new WP_REST_Response(array(
            'status'    => 200,
            'success'   => true,
            'connected' => (int) get_option('vs_is_connected', 0),
        ), 200);
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
        $force    = $request->get_param('force_refresh') === '1' || $request->get_param('force_refresh') === 1;
        $upgrader = new VS_Agent_Upgrader();
        $data     = $upgrader->get_updates($force);

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
            'data'    => $res,
        ), 200);
    }

    public function handle_rollback_update($request) {
        $type           = $request->get_param('type');
        $item           = $request->get_param('item');
        $target_version = $request->get_param('target_version');
        $backup_file    = $request->get_param('backup_file');

        if (empty($type)) {
            $json = $request->get_json_params();
            if (!empty($json)) {
                $type           = isset($json['type']) ? $json['type'] : null;
                $item           = isset($json['item']) ? $json['item'] : null;
                $target_version = isset($json['target_version']) ? $json['target_version'] : null;
                $backup_file    = isset($json['backup_file']) ? $json['backup_file'] : null;
            }
        }

        if (empty($type) || empty($item)) {
            return new WP_REST_Response(array(
                'status'  => 400,
                'success' => false,
                'message' => 'Parâmetros tipo e item são obrigatórios para rollback.',
            ), 400);
        }

        $upgrader = new VS_Agent_Upgrader();
        $res      = $upgrader->rollback($type, $item, $target_version, $backup_file);

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
            'message' => isset($res['message']) ? $res['message'] : 'Reversão concluída com sucesso.',
            'data'    => $res,
        ), 200);
    }

    public function handle_toggle_plugin_status($request) {
        $plugin = $request->get_param('plugin');
        $action = $request->get_param('action');

        if (empty($plugin)) {
            $json = $request->get_json_params();
            if (!empty($json)) {
                $plugin = isset($json['plugin']) ? $json['plugin'] : null;
                $action = isset($json['action']) ? $json['action'] : null;
            }
        }

        if (empty($plugin) || empty($action)) {
            return new WP_REST_Response(array(
                'status'  => 400,
                'success' => false,
                'message' => 'Parâmetros plugin e action (activate/deactivate) são obrigatórios.',
            ), 400);
        }

        $upgrader = new VS_Agent_Upgrader();
        $res      = $upgrader->toggle_plugin_status($plugin, $action);

        if (is_wp_error($res)) {
            $status = is_array($res->get_error_data()) && isset($res->get_error_data()['status']) ? $res->get_error_data()['status'] : 500;
            return new WP_REST_Response(array(
                'status'  => $status,
                'success' => false,
                'message' => $res->get_error_message(),
            ), $status);
        }

        $fresh = $upgrader->get_updates();

        return new WP_REST_Response(array(
            'status'        => 200,
            'success'       => true,
            'message'       => isset($res['message']) ? $res['message'] : 'Status do plugin alterado com sucesso.',
            'data'          => $res,
            'fresh_updates' => $fresh,
        ), 200);
    }

    public function handle_delete_plugin($request) {
        $plugin = $request->get_param('plugin');

        if (empty($plugin)) {
            $json = $request->get_json_params();
            if (!empty($json)) {
                $plugin = isset($json['plugin']) ? $json['plugin'] : null;
            }
        }

        if (empty($plugin)) {
            return new WP_REST_Response(array(
                'status'  => 400,
                'success' => false,
                'message' => 'Parâmetro plugin não informado para exclusão.',
            ), 400);
        }

        $upgrader = new VS_Agent_Upgrader();
        $res      = $upgrader->delete_plugin($plugin);

        if (is_wp_error($res)) {
            $status = is_array($res->get_error_data()) && isset($res->get_error_data()['status']) ? $res->get_error_data()['status'] : 500;
            return new WP_REST_Response(array(
                'status'  => $status,
                'success' => false,
                'message' => $res->get_error_message(),
            ), $status);
        }

        $fresh = $upgrader->get_updates();

        return new WP_REST_Response(array(
            'status'        => 200,
            'success'       => true,
            'message'       => isset($res['message']) ? $res['message'] : 'Plugin removido com sucesso.',
            'data'          => $res,
            'fresh_updates' => $fresh,
        ), 200);
    }

    public function handle_delete_theme($request) {
        $theme = $request->get_param('theme');

        if (empty($theme)) {
            $json = $request->get_json_params();
            if (!empty($json)) {
                $theme = isset($json['theme']) ? $json['theme'] : null;
            }
        }

        if (empty($theme)) {
            return new WP_REST_Response(array(
                'status'  => 400,
                'success' => false,
                'message' => 'Parâmetro theme não informado para exclusão.',
            ), 400);
        }

        $upgrader = new VS_Agent_Upgrader();
        $res      = $upgrader->delete_theme($theme);

        if (is_wp_error($res)) {
            $status = is_array($res->get_error_data()) && isset($res->get_error_data()['status']) ? $res->get_error_data()['status'] : 500;
            return new WP_REST_Response(array(
                'status'  => $status,
                'success' => false,
                'message' => $res->get_error_message(),
            ), $status);
        }

        $fresh = $upgrader->get_updates();

        return new WP_REST_Response(array(
            'status'        => 200,
            'success'       => true,
            'message'       => isset($res['message']) ? $res['message'] : 'Tema removido com sucesso.',
            'data'          => $res,
            'fresh_updates' => $fresh,
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

    public function handle_toggle_ignore_integrity($request) {
        $file   = $request->get_param('file');
        $ignore = $request->get_param('ignore');
        $note   = $request->get_param('note');

        if ($file === null) {
            $json = $request->get_json_params();
            if (!empty($json)) {
                $file   = isset($json['file']) ? $json['file'] : null;
                $ignore = isset($json['ignore']) ? $json['ignore'] : true;
                $note   = isset($json['note']) ? $json['note'] : '';
            }
        }

        $ignore_bool = ($ignore === null) ? true : filter_var($ignore, FILTER_VALIDATE_BOOLEAN);

        $integrity = new VS_Agent_Integrity();
        $res       = $integrity->toggle_ignore_issue($file, $ignore_bool, $note ? $note : '');

        return new WP_REST_Response($res, isset($res['status']) ? (int)$res['status'] : 200);
    }

    public function handle_delete_integrity_file($request) {
        $file = $request->get_param('file');

        if ($file === null) {
            $json = $request->get_json_params();
            if (!empty($json) && isset($json['file'])) {
                $file = $json['file'];
            }
        }

        $integrity = new VS_Agent_Integrity();
        $res       = $integrity->delete_file($file);

        return new WP_REST_Response($res, isset($res['status']) ? (int)$res['status'] : 200);
    }

    public function handle_restore_integrity_file($request) {
        $file = $request->get_param('file');

        if ($file === null) {
            $json = $request->get_json_params();
            if (!empty($json) && isset($json['file'])) {
                $file = $json['file'];
            }
        }

        $integrity = new VS_Agent_Integrity();
        $res       = $integrity->restore_core_file($file);

        return new WP_REST_Response($res, isset($res['status']) ? (int)$res['status'] : 200);
    }

    public function handle_get_fixes($request) {
        if (!function_exists('is_plugin_active')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $installed = false;
        $active    = false;

        if (function_exists('vs_get_registered_fixes')) {
            $installed = true;
            $active    = true;
        } else {
            $candidate_files = array(
                'vexors-fixes/vexors-fixes.php',
                'wp-patropi-fixes/wp-patropi-fixes.php',
            );
            foreach ($candidate_files as $plugin_file) {
                $full_path = WP_PLUGIN_DIR . '/' . $plugin_file;
                if (file_exists($full_path)) {
                    $installed = true;
                    $active    = is_plugin_active($plugin_file);
                    @include_once $full_path;
                    break;
                }
            }
            if (!$installed) {
                $matches = glob(WP_PLUGIN_DIR . '/*fixes*/*.php');
                if (!empty($matches)) {
                    foreach ($matches as $match) {
                        @include_once $match;
                        if (function_exists('vs_get_registered_fixes')) {
                            $installed = true;
                            $active    = true;
                            break;
                        }
                    }
                }
            }
        }

        if (function_exists('vs_get_registered_fixes')) {
            $registered = vs_get_registered_fixes();
            $settings   = function_exists('vs_get_fixes_settings')
                ? vs_get_fixes_settings()
                : (get_option('vexors_fixes_settings', null) ?: (get_option('wp_patropi_fixes_settings', null) ?: (array) get_option('vs_patropi_fixes_settings', array())));
            $items      = array();

            foreach ($registered as $check_id => $data) {
                $is_active = function_exists('vs_is_fix_active')
                    ? vs_is_fix_active($check_id)
                    : (!isset($settings[$check_id]) || !empty($settings[$check_id]));

                $items[] = array(
                    'check_id'    => $check_id,
                    'title'       => isset($data['title']) ? $data['title'] : $check_id,
                    'description' => isset($data['description']) ? $data['description'] : '',
                    'active'      => (bool) $is_active,
                );
            }

            return new WP_REST_Response(array(
                'success'   => true,
                'installed' => true,
                'active'    => $active,
                'version'   => defined('VS_FIXES_VERSION') ? VS_FIXES_VERSION : '1.0.0',
                'fixes'     => $items,
            ), 200);
        }

        return new WP_REST_Response(array(
            'success'   => true,
            'installed' => $installed,
            'active'    => $active,
            'version'   => null,
            'fixes'     => array(),
        ), 200);
    }

    public function handle_toggle_fix($request) {
        $check_id = $request->get_param('check_id');
        $enabled  = $request->get_param('enabled');

        if ($check_id === null || $enabled === null) {
            $json = $request->get_json_params();
            if (!empty($json)) {
                if (isset($json['check_id'])) {
                    $check_id = $json['check_id'];
                }
                if (isset($json['enabled'])) {
                    $enabled = $json['enabled'];
                }
            }
        }

        if (empty($check_id)) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Parâmetro check_id obrigatório.',
            ), 400);
        }

        $enabled_bool = filter_var($enabled, FILTER_VALIDATE_BOOLEAN);

        if (!function_exists('vs_set_fix_status')) {
            $candidate_files = array(
                'vexors-fixes/vexors-fixes.php',
                'wp-patropi-fixes/wp-patropi-fixes.php',
            );
            foreach ($candidate_files as $plugin_file) {
                $full_path = WP_PLUGIN_DIR . '/' . $plugin_file;
                if (file_exists($full_path)) {
                    @include_once $full_path;
                    if (function_exists('vs_set_fix_status')) {
                        break;
                    }
                }
            }
            if (!function_exists('vs_set_fix_status')) {
                $matches = glob(WP_PLUGIN_DIR . '/*fixes*/*.php');
                if (!empty($matches)) {
                    foreach ($matches as $match) {
                        @include_once $match;
                        if (function_exists('vs_set_fix_status')) {
                            break;
                        }
                    }
                }
            }
        }

        if (function_exists('vs_set_fix_status')) {
            vs_set_fix_status($check_id, $enabled_bool);
        } else {
            $settings = (array) (get_option('vexors_fixes_settings', null) ?: get_option('wp_patropi_fixes_settings', array()));
            $settings[$check_id] = $enabled_bool;
            update_option('vexors_fixes_settings', $settings);
            update_option('wp_patropi_fixes_settings', $settings);
            update_option('vs_patropi_fixes_settings', $settings);
        }

        return new WP_REST_Response(array(
            'success'  => true,
            'check_id' => $check_id,
            'active'   => $enabled_bool,
            'message'  => 'Status da correção atualizado com sucesso.',
        ), 200);
    }
}
