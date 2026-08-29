<?php
/**
 * Plugin Name: WP Patropi - Diagnóstico
 * Plugin URI: https://patropicomunica.com.br
 * Description: Plugin Agente para diagnóstico interno profundo de segurança em sites WordPress.
 * Version: 1.0.0
 * Author: Rodrigo Bermudez - Patropi Comunica
 * Author URI: https://patropicomunica.com.br
 * License: GPLv2 or later
 * Text Domain: wp-patropi-diagnostico
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

define('VS_AGENT_VERSION', '1.0.0');
define('VS_AGENT_PATH', plugin_dir_path(__FILE__));
define('VS_AGENT_URL', plugin_dir_url(__FILE__));

// Settings link on Plugins list page (plugins.php)
add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
    $settings_link = '<a href="' . esc_url(admin_url('admin.php?page=wp-patropi')) . '">' . __('Configurações', 'wp-patropi-diagnostico') . '</a>';
    array_unshift($links, $settings_link);
    return $links;
});

require_path_once(VS_AGENT_PATH . 'includes/class-vs-collector.php');
require_path_once(VS_AGENT_PATH . 'includes/class-vs-rest-api.php');
require_path_once(VS_AGENT_PATH . 'includes/class-vs-admin.php');

function require_path_once($file) {
    if (file_exists($file)) {
        require_once $file;
    }
}

class Validar_Seguranca_Agent {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->load_config();
        $this->init_hooks();
    }

    private function load_config() {
        // Read injected config.json if not already saved in options
        $saved_token = get_option('vs_agent_token');
        $config_file  = VS_AGENT_PATH . 'config.json';

        if (file_exists($config_file)) {
            $config = json_decode(file_get_contents($config_file), true);
            if (!empty($config['site_id']) && !empty($config['agent_token'])) {
                update_option('vs_site_id', $config['site_id']);
                update_option('vs_agent_token', $config['agent_token']);
                if (!empty($config['saas_url'])) {
                    update_option('vs_saas_url', $config['saas_url']);
                }

                // Delete the config file after processing to save I/O reads on future requests
                @unlink($config_file);
            }
        }
    }

    private function init_hooks() {
        add_action('plugins_loaded', array($this, 'bootstrap'));
    }

    public function bootstrap() {
        new VS_Agent_Collector();
        new VS_Agent_REST_API();
        if (is_admin()) {
            new VS_Agent_Admin();
        }
    }
}

// Initialize
Validar_Seguranca_Agent::get_instance();
