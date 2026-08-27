<?php

if (!defined('ABSPATH')) {
    exit;
}

class VS_Agent_Collector {

    public function collect_all() {
        return array(
            'timestamp'           => current_time('mysql'),
            'wp_version'          => get_bloginfo('version'),
            'site_url'            => get_site_url(),
            'moderation_settings' => $this->collect_moderation(),
            'updates_and_plugins' => $this->collect_updates_and_plugins(),
            'users_security'      => $this->collect_users_security(),
            'hardening'           => $this->collect_hardening(),
            'file_security'       => $this->collect_file_security(),
            'endpoints_security'  => $this->collect_endpoints_security(),
        );
    }

    private function collect_moderation() {
        return array(
            'comments_open'       => get_option('default_comment_status') === 'open',
            'comment_moderation'  => get_option('comment_moderation') == 1,
            'require_name_email'  => get_option('require_name_email') == 1,
            'users_can_register'  => get_option('users_can_register') == 1,
            'default_role'        => get_option('default_role'),
            'blog_public'         => get_option('blog_public') == 1,
        );
    }

    private function collect_updates_and_plugins() {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $all_plugins     = get_plugins();
        $active_plugins  = (array) get_option('active_plugins', array());

        $installed_plugins = array();
        foreach ($all_plugins as $path => $plugin_data) {
            $is_active = in_array($path, $active_plugins, true);
            $installed_plugins[] = array(
                'name'      => $plugin_data['Name'],
                'version'   => $plugin_data['Version'],
                'path'      => $path,
                'is_active' => $is_active,
            );
        }

        // Check for updates
        $core_updates   = get_site_transient('update_core');
        $plugin_updates = get_site_transient('update_plugins');
        $theme_updates  = get_site_transient('update_themes');

        $pending_core   = 0;
        if (!empty($core_updates->updates)) {
            foreach ($core_updates->updates as $up) {
                if ($up->response === 'upgrade') {
                    $pending_core++;
                }
            }
        }

        $pending_plugins = !empty($plugin_updates->response) ? count($plugin_updates->response) : 0;
        $pending_themes  = !empty($theme_updates->response) ? count($theme_updates->response) : 0;

        return array(
            'total_plugins'     => count($all_plugins),
            'active_plugins'    => count($active_plugins),
            'inactive_plugins'  => count($all_plugins) - count($active_plugins),
            'plugins_list'      => $installed_plugins,
            'pending_core_updates'   => $pending_core,
            'pending_plugin_updates' => $pending_plugins,
            'pending_theme_updates'  => $pending_themes,
        );
    }

    private function collect_users_security() {
        $args = array(
            'role'   => 'administrator',
            'fields' => array('ID', 'user_login', 'user_email'),
        );
        $admins = get_users($args);

        $has_default_admin = false;
        $admin_usernames = array();

        foreach ($admins as $admin) {
            $admin_usernames[] = $admin->user_login;
            if (in_array(strtolower($admin->user_login), array('admin', 'administrator'), true)) {
                $has_default_admin = true;
            }
        }

        return array(
            'total_admins'      => count($admins),
            'has_default_admin' => $has_default_admin,
            'admin_usernames'   => $admin_usernames,
        );
    }

    private function collect_hardening() {
        global $wpdb;

        return array(
            'wp_debug'            => defined('WP_DEBUG') && WP_DEBUG,
            'wp_debug_display'    => defined('WP_DEBUG_DISPLAY') && WP_DEBUG_DISPLAY,
            'disallow_file_edit'  => defined('DISALLOW_FILE_EDIT') && DISALLOW_FILE_EDIT,
            'disallow_file_mods'  => defined('DISALLOW_FILE_MODS') && DISALLOW_FILE_MODS,
            'db_prefix'           => $wpdb->prefix,
            'is_default_db_prefix'=> $wpdb->prefix === 'wp_',
            'php_version'         => PHP_VERSION,
            'is_php_outdated'     => version_compare(PHP_VERSION, '8.0.0', '<'),
        );
    }

    private function collect_file_security() {
        $wp_config_path = ABSPATH . 'wp-config.php';
        if (!file_exists($wp_config_path)) {
            $wp_config_path = dirname(ABSPATH) . '/wp-config.php';
        }

        $wp_config_perms = false;
        if (file_exists($wp_config_path)) {
            $wp_config_perms = substr(sprintf('%o', fileperms($wp_config_path)), -4);
        }

        return array(
            'wp_config_exists' => file_exists($wp_config_path),
            'wp_config_perms'  => $wp_config_perms,
            'htaccess_exists'  => file_exists(ABSPATH . '.htaccess'),
        );
    }

    private function collect_endpoints_security() {
        $xmlrpc_enabled = true; // By default enabled in WP
        if (has_filter('xmlrpc_enabled', '__return_false')) {
            $xmlrpc_enabled = false;
        }

        return array(
            'xmlrpc_enabled' => $xmlrpc_enabled,
        );
    }
}
