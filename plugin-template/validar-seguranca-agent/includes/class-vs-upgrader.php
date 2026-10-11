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

    public function get_updates() {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        require_once ABSPATH . 'wp-admin/includes/update.php';

        // Force check for updates
        wp_update_plugins();
        wp_update_themes();
        wp_version_check();

        $update_plugins = get_site_transient('update_plugins');
        $update_themes  = get_site_transient('update_themes');
        $update_core    = get_site_transient('update_core');

        // Process Plugins
        $all_plugins = get_plugins();
        $plugins_out = array();
        $pending_plugins_count = 0;

        if (!empty($all_plugins)) {
            foreach ($all_plugins as $file => $data) {
                $has_update  = isset($update_plugins->response[$file]);
                $new_version = $has_update ? $update_plugins->response[$file]->new_version : $data['Version'];
                $is_active   = is_plugin_active($file);
                if ($has_update) {
                    $pending_plugins_count++;
                }
                $plugins_out[] = array(
                    'file'            => $file,
                    'slug'            => isset($update_plugins->response[$file]->slug) ? $update_plugins->response[$file]->slug : sanitize_title($data['Name']),
                    'name'            => $data['Name'],
                    'current_version' => $data['Version'],
                    'new_version'     => $new_version,
                    'has_update'      => $has_update,
                    'is_active'       => $is_active,
                );
            }
        }

        // Process Themes
        $all_themes = wp_get_themes();
        $themes_out = array();
        $pending_themes_count = 0;

        if (!empty($all_themes)) {
            foreach ($all_themes as $slug => $theme) {
                $has_update  = isset($update_themes->response[$slug]);
                $new_version = $has_update ? $update_themes->response[$slug]['new_version'] : $theme->get('Version');
                if ($has_update) {
                    $pending_themes_count++;
                }
                $themes_out[] = array(
                    'slug'            => $slug,
                    'name'            => $theme->get('Name'),
                    'current_version' => $theme->get('Version'),
                    'new_version'     => $new_version,
                    'has_update'      => $has_update,
                );
            }
        }

        // Process Core
        global $wp_version;
        $core_new_version = $wp_version;
        $core_has_update  = false;

        if (!empty($update_core->updates) && is_array($update_core->updates)) {
            foreach ($update_core->updates as $offer) {
                if (isset($offer->response) && $offer->response === 'upgrade' && version_compare($offer->current, $wp_version, '>')) {
                    $core_new_version = $offer->current;
                    $core_has_update  = true;
                    break;
                }
            }
        }

        return array(
            'summary' => array(
                'total_pending'   => $pending_plugins_count + $pending_themes_count + ($core_has_update ? 1 : 0),
                'pending_plugins' => $pending_plugins_count,
                'pending_themes'  => $pending_themes_count,
                'pending_core'    => $core_has_update ? 1 : 0,
            ),
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

            $was_active         = is_plugin_active($item);
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
                'success' => true,
                'message' => 'Plugin ' . esc_html($item) . ' atualizado com sucesso (status de ativação mantido).',
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
                'success' => true,
                'message' => 'Tema ' . esc_html($item) . ' atualizado com sucesso.',
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
                'success' => true,
                'message' => 'WordPress Core atualizado com sucesso para a versão ' . esc_html($offer->current),
            );
        }

        return new WP_Error('vs_invalid_type', 'Tipo de atualização inválido.', array('status' => 400));
    }
}
