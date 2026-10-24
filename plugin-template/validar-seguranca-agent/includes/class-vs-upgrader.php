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
                $is_protected = (strpos($file, 'validar-seguranca') !== false || strpos($file, 'vexors') !== false);
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
                    'is_protected'    => $is_protected,
                );
            }
        }

        // Process Themes
        $all_themes = function_exists('wp_get_themes') ? wp_get_themes() : array();
        $themes_out = array();
        $pending_themes_count = 0;

        $current_theme = function_exists('wp_get_theme') ? wp_get_theme() : null;
        $active_stylesheet = $current_theme ? $current_theme->get_stylesheet() : (function_exists('get_stylesheet') ? get_stylesheet() : '');
        $active_template   = $current_theme ? $current_theme->get_template() : (function_exists('get_template') ? get_template() : '');

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

                $is_theme_active = ($slug === $active_stylesheet || $slug === $active_template);

                $themes_out[] = array(
                    'slug'            => $slug,
                    'name'            => $theme->get('Name'),
                    'current_version' => $theme->get('Version'),
                    'new_version'     => $new_version,
                    'requires_php'    => $requires_php,
                    'requires_wp'     => $requires_wp,
                    'has_update'      => $has_update,
                    'is_active'       => $is_theme_active,
                    'is_protected'    => $is_theme_active,
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

            // Obtém versão atual e cria snapshot local antes do upgrade
            $plugin_file_path = WP_PLUGIN_DIR . '/' . $item;
            $current_ver = '';
            if (file_exists($plugin_file_path) && function_exists('get_plugin_data')) {
                $pdata = get_plugin_data($plugin_file_path, false, false);
                $current_ver = !empty($pdata['Version']) ? $pdata['Version'] : '';
            }
            $backup_file = $this->create_local_snapshot('plugin', $item, $current_ver);

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
                'success'        => true,
                'message'        => 'Plugin ' . esc_html($item) . ' atualizado com sucesso (status de ativação mantido).',
                'backup_file'    => $backup_file,
                'backup_created' => !empty($backup_file),
                'from_version'   => $current_ver,
                'messages'       => !empty($skin->messages) ? $skin->messages : array(),
            );
        }

        if ($type === 'theme') {
            if (empty($item)) {
                return new WP_Error('vs_missing_item', 'Slug do tema não fornecido.', array('status' => 400));
            }

            require_once ABSPATH . 'wp-admin/includes/theme.php';
            require_once ABSPATH . 'wp-admin/includes/update.php';

            // Obtém versão atual e cria snapshot local antes do upgrade
            $theme = wp_get_theme($item);
            $current_ver = $theme->exists() ? $theme->get('Version') : '';
            $backup_file = $this->create_local_snapshot('theme', $item, $current_ver);

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
                'success'        => true,
                'message'        => 'Tema ' . esc_html($item) . ' atualizado com sucesso.',
                'backup_file'    => $backup_file,
                'backup_created' => !empty($backup_file),
                'from_version'   => $current_ver,
                'messages'       => !empty($skin->messages) ? $skin->messages : array(),
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

    /**
     * Cria snapshot ZIP local do item antes de sobrescrever os arquivos.
     */
    public function create_local_snapshot($type, $item, $version = '') {
        $this->cleanup_old_backups(7);

        $upload_dir = wp_upload_dir();
        $backup_base = trailingslashit($upload_dir['basedir']) . 'vexors-backups/';

        if (!file_exists($backup_base)) {
            wp_mkdir_p($backup_base);
        }
        if (!file_exists($backup_base . '.htaccess')) {
            @file_put_contents($backup_base . '.htaccess', "Deny from all\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n");
        }
        if (!file_exists($backup_base . 'index.php')) {
            @file_put_contents($backup_base . 'index.php', '<?php // Silence is golden');
        }

        $type_dir = $backup_base . ($type === 'theme' ? 'themes/' : 'plugins/');
        if (!file_exists($type_dir)) {
            wp_mkdir_p($type_dir);
        }

        $is_single_file = false;
        if ($type === 'plugin') {
            $slug = sanitize_file_name(dirname($item));
            if ($slug === '.' || empty($slug)) {
                $slug = sanitize_file_name(basename($item, '.php'));
                $source_path = WP_PLUGIN_DIR . '/' . $item;
                $is_single_file = true;
            } else {
                $source_path = WP_PLUGIN_DIR . '/' . dirname($item);
            }
        } else {
            $slug = sanitize_file_name($item);
            $source_path = get_theme_root() . '/' . $item;
        }

        if (!file_exists($source_path)) {
            return null;
        }

        $salt_hash = substr(md5(wp_salt() . $slug . $version), 0, 8);
        $clean_ver = preg_replace('/[^a-zA-Z0-9._-]/', '', $version) ?: 'unknown';
        $zip_name = "{$slug}-v{$clean_ver}-{$salt_hash}.zip";
        $zip_path = $type_dir . $zip_name;

        if (class_exists('ZipArchive')) {
            $zip = new ZipArchive();
            if ($zip->open($zip_path, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
                if ($is_single_file) {
                    $zip->addFile($source_path, basename($source_path));
                } else {
                    $files = new RecursiveIteratorIterator(
                        new RecursiveDirectoryIterator($source_path, RecursiveDirectoryIterator::SKIP_DOTS),
                        RecursiveIteratorIterator::LEAVES_ONLY
                    );
                    foreach ($files as $name => $file) {
                        if (!$file->isDir()) {
                            $filePath = $file->getRealPath();
                            $relativeInside = substr($filePath, strlen($source_path) + 1);
                            $zip->addFile($filePath, $slug . '/' . $relativeInside);
                        }
                    }
                }
                $zip->close();
                return $zip_name;
            }
        }

        return null;
    }

    /**
     * Remove backups com mais de X dias para proteger o espaço em disco.
     */
    public function cleanup_old_backups($days = 7) {
        $upload_dir = wp_upload_dir();
        $backup_base = trailingslashit($upload_dir['basedir']) . 'vexors-backups/';
        $cutoff = time() - ($days * 86400);

        foreach (array('plugins', 'themes') as $sub) {
            $dir = $backup_base . $sub . '/';
            if (is_dir($dir)) {
                $files = glob($dir . '*.zip');
                if (!empty($files) && is_array($files)) {
                    foreach ($files as $file) {
                        if (file_exists($file) && filemtime($file) < $cutoff) {
                            @unlink($file);
                        }
                    }
                }
            }
        }
    }

    /**
     * Restaura uma versão anterior de plugin ou tema via snapshot local ou repositório oficial WP.org.
     */
    public function rollback($type, $item, $target_version = '', $backup_file = null) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/misc.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        require_once ABSPATH . 'wp-admin/includes/admin.php';

        if (!function_exists('WP_Filesystem')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        WP_Filesystem();

        $upload_dir  = wp_upload_dir();
        $backup_base = trailingslashit($upload_dir['basedir']) . 'vexors-backups/';
        $sub_dir     = ($type === 'theme') ? 'themes/' : 'plugins/';
        $restored_from = null;

        // 1. Tenta restaurar a partir do Snapshot local salvo previamente
        if (!empty($backup_file)) {
            $clean_file = basename($backup_file);
            $local_zip = $backup_base . $sub_dir . $clean_file;

            if (file_exists($local_zip)) {
                $dest_dir = ($type === 'theme') ? get_theme_root() : WP_PLUGIN_DIR;
                $unzip_result = unzip_file($local_zip, $dest_dir);

                if (is_wp_error($unzip_result)) {
                    return $unzip_result;
                }

                $restored_from = 'local_snapshot';
            }
        }

        // 2. Se não encontrou o snapshot local e temos target_version, tenta baixar da CDN oficial WordPress.org
        if (!$restored_from && !empty($target_version)) {
            $slug = ($type === 'plugin') ? dirname($item) : $item;
            if ($slug === '.' || empty($slug)) {
                $slug = basename($item, '.php');
            }

            $official_url = "https://downloads.wordpress.org/{$type}/{$slug}.{$target_version}.zip";
            $downloaded_zip = download_url($official_url);

            if (!is_wp_error($downloaded_zip)) {
                $dest_dir = ($type === 'theme') ? get_theme_root() : WP_PLUGIN_DIR;
                $unzip_result = unzip_file($downloaded_zip, $dest_dir);
                @unlink($downloaded_zip);

                if (!is_wp_error($unzip_result)) {
                    $restored_from = 'official_wporg';
                }
            }
        }

        if (!$restored_from) {
            return new WP_Error(
                'vs_rollback_not_found',
                'Não foi possível localizar o snapshot local nem o pacote oficial no repositório para a versão solicitada (' . esc_html($target_version) . ').',
                array('status' => 404)
            );
        }

        // Se for plugin, restaura estado de ativação
        if ($type === 'plugin') {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
            activate_plugin($item);
        }

        if (function_exists('opcache_reset')) {
            @opcache_reset();
        }

        $source_label = ($restored_from === 'local_snapshot')
            ? 'snapshot local de segurança'
            : 'repositório oficial WordPress.org';

        return array(
            'success'       => true,
            'message'       => 'Reversão concluída com sucesso! ' . esc_html($item) . ' foi restaurado para a versão anterior ' . ($target_version ? 'v' . esc_html($target_version) : '') . ' via ' . $source_label . '.',
            'restored_from' => $restored_from,
            'version'       => $target_version,
        );
    }

    /**
     * Ativa ou desativa um plugin no WordPress.
     */
    public function toggle_plugin_status($plugin_file, $action) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';

        if (!file_exists(WP_PLUGIN_DIR . '/' . $plugin_file)) {
            return new WP_Error('vs_plugin_not_found', 'Plugin não encontrado no servidor: ' . esc_html($plugin_file), array('status' => 404));
        }

        // Proteção: não permitir desativar o próprio agente Vexors
        $is_agent = (strpos($plugin_file, 'validar-seguranca') !== false || strpos($plugin_file, 'vexors') !== false);
        if ($is_agent && $action === 'deactivate') {
            return new WP_Error('vs_plugin_protected', 'O agente Vexors é essencial para a conexão com o painel e não pode ser desativado.', array('status' => 403));
        }

        if ($action === 'activate') {
            $result = activate_plugin($plugin_file);
            if (is_wp_error($result)) {
                return $result;
            }
            return array(
                'success' => true,
                'message' => 'Plugin ativado com sucesso!',
                'status'  => 'active',
                'plugin'  => $plugin_file,
            );
        } elseif ($action === 'deactivate') {
            deactivate_plugins(array($plugin_file));
            return array(
                'success' => true,
                'message' => 'Plugin desativado com sucesso.',
                'status'  => 'inactive',
                'plugin'  => $plugin_file,
            );
        }

        return new WP_Error('vs_invalid_action', 'Ação inválida. Use activate ou deactivate.', array('status' => 400));
    }

    /**
     * Remove um plugin inativo do servidor, gerando snapshot preventivo de segurança antes.
     */
    public function delete_plugin($plugin_file) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';

        if (!file_exists(WP_PLUGIN_DIR . '/' . $plugin_file)) {
            return new WP_Error('vs_plugin_not_found', 'Plugin não encontrado no servidor: ' . esc_html($plugin_file), array('status' => 404));
        }

        // Proteção: não permitir excluir o próprio agente Vexors
        $is_agent = (strpos($plugin_file, 'validar-seguranca') !== false || strpos($plugin_file, 'vexors') !== false);
        if ($is_agent) {
            return new WP_Error('vs_plugin_protected', 'O agente Vexors é protegido e não pode ser removido pelo painel.', array('status' => 403));
        }

        // Obter dados e versão do plugin
        $plugin_data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_file, false, false);
        $version = !empty($plugin_data['Version']) ? $plugin_data['Version'] : 'unknown';
        $name    = !empty($plugin_data['Name']) ? $plugin_data['Name'] : $plugin_file;

        // Se o plugin estiver ativo, desativa antes de deletar
        if (is_plugin_active($plugin_file)) {
            deactivate_plugins(array($plugin_file));
        }

        // 1. Snapshot Preventivo Local
        $backup_file = $this->create_local_snapshot('plugin', $plugin_file, $version);

        // 2. Exclusão segura nativa do WordPress
        $del_result = delete_plugins(array($plugin_file));
        if (is_wp_error($del_result)) {
            return $del_result;
        }

        return array(
            'success'        => true,
            'message'        => 'Plugin ' . esc_html($name) . ' removido com sucesso.',
            'plugin'         => $plugin_file,
            'name'           => $name,
            'version'        => $version,
            'backup_file'    => $backup_file,
            'backup_created' => !empty($backup_file),
        );
    }

    /**
     * Remove um tema inativo do servidor, gerando snapshot preventivo de segurança antes.
     */
    public function delete_theme($theme_slug) {
        require_once ABSPATH . 'wp-admin/includes/theme.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';

        $theme = wp_get_theme($theme_slug);
        if (!$theme->exists()) {
            return new WP_Error('vs_theme_not_found', 'Tema não encontrado no servidor: ' . esc_html($theme_slug), array('status' => 404));
        }

        // Proteção: não permitir excluir o tema ativo ou tema pai
        $current_theme = wp_get_theme();
        if ($theme_slug === $current_theme->get_stylesheet() || $theme_slug === $current_theme->get_template()) {
            return new WP_Error('vs_theme_active', 'Não é possível remover o tema atualmente ativo no site.', array('status' => 403));
        }

        $version = $theme->get('Version') ?: 'unknown';
        $name    = $theme->get('Name') ?: $theme_slug;

        // 1. Snapshot Preventivo Local
        $backup_file = $this->create_local_snapshot('theme', $theme_slug, $version);

        // 2. Exclusão segura nativa do WordPress
        $del_result = delete_theme($theme_slug);
        if (is_wp_error($del_result)) {
            return $del_result;
        }

        return array(
            'success'        => true,
            'message'        => 'Tema ' . esc_html($name) . ' removido com sucesso.',
            'theme'          => $theme_slug,
            'name'           => $name,
            'version'        => $version,
            'backup_file'    => $backup_file,
            'backup_created' => !empty($backup_file),
        );
    }
}
