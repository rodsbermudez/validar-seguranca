<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('WP_Upgrader_Skin')) {
    require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
}

class VS_Agent_Upgrader_Skin extends WP_Upgrader_Skin {
    public $messages = array();
    public $errors   = array();

    public function header() {}
    public function footer() {}
    public function feedback($string, ...$args) {
        if (is_string($string)) {
            $msg = @vsprintf($string, $args);
            if ($msg) {
                $this->messages[] = strip_tags($msg);
            }
        }
    }
    public function error($errors) {
        if (is_wp_error($errors)) {
            $this->errors[] = $errors->get_error_message();
        } elseif (is_string($errors)) {
            $this->errors[] = strip_tags($errors);
        }
    }
}

class VS_Agent_Upgrader {

    public function get_updates($force = false) {
        if (!function_exists('get_plugins') || !function_exists('is_plugin_active')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if (file_exists(ABSPATH . 'wp-admin/includes/update.php')) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }

        $force_refresh = $force || (!empty($_GET['force_refresh']) && $_GET['force_refresh'] === '1') || (!empty($_POST['force_refresh']) && $_POST['force_refresh'] === '1');

        $update_plugins = get_site_transient('update_plugins');
        $update_themes  = get_site_transient('update_themes');
        $update_core    = get_site_transient('update_core');

        // Only invoke heavy external WordPress.org update checks if explicitly forced OR if transients don't exist at all
        if ($force_refresh || empty($update_plugins) || empty($update_themes)) {
            if (function_exists('wp_update_plugins')) {
                @wp_update_plugins();
            }
            if (function_exists('wp_update_themes')) {
                @wp_update_themes();
            }
            if (function_exists('wp_version_check')) {
                @wp_version_check();
            }

            $update_plugins = get_site_transient('update_plugins');
            $update_themes  = get_site_transient('update_themes');
            $update_core    = get_site_transient('update_core');
        }

        $plugin_responses = (!empty($update_plugins) && is_object($update_plugins) && !empty($update_plugins->response) && is_array($update_plugins->response))
            ? $update_plugins->response
            : array();

        $theme_responses = (!empty($update_themes) && is_object($update_themes) && !empty($update_themes->response) && is_array($update_themes->response))
            ? $update_themes->response
            : array();

        // Process Plugins
        $all_plugins = function_exists('get_plugins') ? get_plugins() : array();
        $active_plugins = (array) get_option('active_plugins', array());
        $plugins_out = array();
        $pending_plugins_count = 0;

        if (!empty($all_plugins)) {
            foreach ($all_plugins as $file => $data) {
                $has_update  = isset($plugin_responses[$file]);
                $update_item = $has_update ? $plugin_responses[$file] : null;
                $new_version = $data['Version'];
                $slug        = sanitize_title($data['Name']);
                $requires_php = !empty($data['RequiresPHP']) ? $data['RequiresPHP'] : null;
                $requires_wp  = !empty($data['RequiresWP']) ? $data['RequiresWP'] : null;
                $tested_wp    = null;

                if ($has_update && !empty($update_item)) {
                    if (is_object($update_item)) {
                        $new_version = !empty($update_item->new_version) ? $update_item->new_version : $data['Version'];
                        $slug        = !empty($update_item->slug) ? $update_item->slug : $slug;
                        if (!empty($update_item->requires_php)) {
                            $requires_php = (string) $update_item->requires_php;
                        }
                        if (!empty($update_item->requires)) {
                            $requires_wp = (string) $update_item->requires;
                        }
                        if (!empty($update_item->tested)) {
                            $tested_wp = (string) $update_item->tested;
                        }
                    } elseif (is_array($update_item)) {
                        $new_version = !empty($update_item['new_version']) ? $update_item['new_version'] : $data['Version'];
                        $slug        = !empty($update_item['slug']) ? $update_item['slug'] : $slug;
                        if (!empty($update_item['requires_php'])) {
                            $requires_php = (string) $update_item['requires_php'];
                        }
                        if (!empty($update_item['requires'])) {
                            $requires_wp = (string) $update_item['requires'];
                        }
                        if (!empty($update_item['tested'])) {
                            $tested_wp = (string) $update_item['tested'];
                        }
                    }
                }

                $is_active = function_exists('is_plugin_active') ? is_plugin_active($file) : in_array($file, $active_plugins, true);
                if ($has_update) {
                    $pending_plugins_count++;
                }
                $plugins_out[] = array(
                    'file'            => $file,
                    'slug'            => $slug,
                    'name'            => $data['Name'],
                    'current_version' => $data['Version'],
                    'new_version'     => $new_version,
                    'requires_php'    => $requires_php,
                    'requires_wp'     => $requires_wp,
                    'tested_wp'       => $tested_wp,
                    'has_update'      => $has_update,
                    'is_active'       => $is_active,
                );
            }
        }

        // Process Themes
        $all_themes = function_exists('wp_get_themes') ? wp_get_themes() : array();
        $themes_out = array();
        $pending_themes_count = 0;

        if (!empty($all_themes)) {
            foreach ($all_themes as $slug => $theme) {
                $has_update  = isset($theme_responses[$slug]);
                $theme_item  = $has_update ? $theme_responses[$slug] : null;
                $new_version = $theme->get('Version');
                $requires_php = $theme->get('RequiresPHP') ?: null;
                $requires_wp  = $theme->get('RequiresWP') ?: null;

                if ($has_update && !empty($theme_item)) {
                    if (is_array($theme_item)) {
                        $new_version = !empty($theme_item['new_version']) ? $theme_item['new_version'] : $new_version;
                        if (!empty($theme_item['requires_php'])) {
                            $requires_php = (string) $theme_item['requires_php'];
                        }
                        if (!empty($theme_item['requires'])) {
                            $requires_wp = (string) $theme_item['requires'];
                        }
                    } elseif (is_object($theme_item)) {
                        $new_version = !empty($theme_item->new_version) ? $theme_item->new_version : $new_version;
                        if (!empty($theme_item->requires_php)) {
                            $requires_php = (string) $theme_item->requires_php;
                        }
                        if (!empty($theme_item->requires)) {
                            $requires_wp = (string) $theme_item->requires;
                        }
                    }
                }

                if ($has_update) {
                    $pending_themes_count++;
                }
                $themes_out[] = array(
                    'slug'            => $slug,
                    'name'            => $theme->get('Name'),
                    'current_version' => $theme->get('Version'),
                    'new_version'     => $new_version,
                    'requires_php'    => $requires_php,
                    'requires_wp'     => $requires_wp,
                    'has_update'      => $has_update,
                );
            }
        }

        // Process Core
        global $wp_version, $wpdb;
        $core_new_version = $wp_version;
        $core_has_update  = false;

        if (!empty($update_core) && is_object($update_core) && !empty($update_core->updates) && is_array($update_core->updates)) {
            foreach ($update_core->updates as $offer) {
                if (isset($offer->response) && $offer->response === 'upgrade' && version_compare($offer->current, $wp_version, '>')) {
                    $core_new_version = $offer->current;
                    $core_has_update  = true;
                    break;
                }
            }
        }

        // Collect Server Environment Diagnostics
        $disk_free = function_exists('disk_free_space') ? @disk_free_space(ABSPATH) : false;
        $disk_total = function_exists('disk_total_space') ? @disk_total_space(ABSPATH) : false;

        $server_env = array(
            'php_version'     => PHP_VERSION,
            'mysql_version'   => (isset($wpdb) && method_exists($wpdb, 'db_version')) ? $wpdb->db_version() : null,
            'wp_version'      => get_bloginfo('version'),
            'server_software' => !empty($_SERVER['SERVER_SOFTWARE']) ? $_SERVER['SERVER_SOFTWARE'] : '',
            'memory_limit'    => ini_get('memory_limit'),
            'disk_free_mb'    => ($disk_free !== false) ? round($disk_free / 1048576) : null,
            'disk_total_mb'   => ($disk_total !== false) ? round($disk_total / 1048576) : null,
        );

        return array(
            'summary' => array(
                'total_pending'   => $pending_plugins_count + $pending_themes_count + ($core_has_update ? 1 : 0),
                'pending_plugins' => $pending_plugins_count,
                'pending_themes'  => $pending_themes_count,
                'pending_core'    => $core_has_update ? 1 : 0,
            ),
            'server_environment' => $server_env,
            'core'    => array(
                'current_version' => $wp_version,
                'new_version'     => $core_new_version,
                'has_update'      => $core_has_update,
            ),
            'plugins' => $plugins_out,
            'themes'  => $themes_out,
        );
    }

    public function apply_update($type, $item = '') {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/misc.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        require_once ABSPATH . 'wp-admin/includes/admin.php';

        if (!function_exists('WP_Filesystem')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        WP_Filesystem();

        $skin = new VS_Agent_Upgrader_Skin();

        if ($type === 'plugin') {
            if (empty($item)) {
                return new WP_Error('vs_missing_item', 'Slug do plugin não fornecido.', array('status' => 400));
            }

            require_once ABSPATH . 'wp-admin/includes/plugin.php';
            require_once ABSPATH . 'wp-admin/includes/update.php';

            $was_active         = function_exists('is_plugin_active') ? is_plugin_active($item) : in_array($item, (array) get_option('active_plugins', array()), true);
            $was_network_active = function_exists('is_plugin_active_for_network') ? is_plugin_active_for_network($item) : false;

            wp_update_plugins();

            $upgrader = new Plugin_Upgrader($skin);
            $result   = $upgrader->upgrade($item);

            if (is_wp_error($result)) {
                return $result;
            }

            if (!empty($skin->errors)) {
                return new WP_Error('vs_upgrade_failed', implode(', ', $skin->errors), array('status' => 500));
            }

            if ($result === false || (is_array($result) && empty($result))) {
                $err_detail = !empty($skin->messages) ? implode(' | ', array_slice($skin->messages, -3)) : 'Erro desconhecido durante a instalação.';
                return new WP_Error('vs_upgrade_failed', 'Falha ao atualizar o plugin ' . esc_html($item) . ': ' . $err_detail, array('status' => 500));
            }

            // Restore active state
            if ($was_active || $was_network_active) {
                activate_plugin($item, '', $was_network_active);
            }

            return array(
                'success'  => true,
                'message'  => 'Plugin ' . esc_html($item) . ' atualizado com sucesso (status de ativação mantido).',
                'messages' => !empty($skin->messages) ? $skin->messages : array(),
            );
        }

        if ($type === 'theme') {
            if (empty($item)) {
                return new WP_Error('vs_missing_item', 'Slug do tema não fornecido.', array('status' => 400));
            }

            require_once ABSPATH . 'wp-admin/includes/theme.php';
            require_once ABSPATH . 'wp-admin/includes/update.php';
            wp_update_themes();

            $upgrader = new Theme_Upgrader($skin);
            $result   = $upgrader->upgrade($item);

            if (is_wp_error($result)) {
                return $result;
            }

            if (!empty($skin->errors)) {
                return new WP_Error('vs_upgrade_failed', implode(', ', $skin->errors), array('status' => 500));
            }

            if ($result === false) {
                $err_detail = !empty($skin->messages) ? implode(' | ', array_slice($skin->messages, -3)) : 'Erro desconhecido durante a instalação.';
                return new WP_Error('vs_upgrade_failed', 'Falha ao atualizar o tema ' . esc_html($item) . ': ' . $err_detail, array('status' => 500));
            }

            return array(
                'success'  => true,
                'message'  => 'Tema ' . esc_html($item) . ' atualizado com sucesso.',
                'messages' => !empty($skin->messages) ? $skin->messages : array(),
            );
        }

        if ($type === 'core') {
            require_once ABSPATH . 'wp-admin/includes/update.php';
            wp_version_check();
            $offer = get_preferred_from_update_core();

            if (!$offer) {
                return new WP_Error('vs_no_core_update', 'Nenhuma oferta de atualização do Core do WordPress disponível.', array('status' => 400));
            }

            $upgrader = new Core_Upgrader($skin);
            $result   = $upgrader->upgrade($offer);

            if (is_wp_error($result)) {
                return $result;
            }

            if (!empty($skin->errors)) {
                return new WP_Error('vs_upgrade_failed', implode(', ', $skin->errors), array('status' => 500));
            }

            return array(
                'success'  => true,
                'message'  => 'WordPress Core atualizado com sucesso para a versão ' . esc_html($offer->current),
                'messages' => !empty($skin->messages) ? $skin->messages : array(),
            );
        }

        return new WP_Error('vs_invalid_type', 'Tipo de atualização inválido.', array('status' => 400));
    }
}
