<?php

if (!defined('ABSPATH')) {
    exit;
}

class VS_Agent_Integrity {

    /**
     * Cache transient key prefix
     */
    const CHECKSUM_TRANSIENT_PREFIX = 'vs_core_checksums_';

    /**
     * Option name for ignored / resolved issues
     */
    const OPTION_IGNORED_FILES = 'vs_integrity_ignored_files';

    /**
     * Run full core integrity verification
     */
    public function verify_core_integrity() {
        global $wp_version;

        @set_time_limit(120);

        $checksums = $this->get_core_checksums($wp_version);
        if (is_wp_error($checksums)) {
            return array(
                'status'  => 500,
                'success' => false,
                'message' => 'Falha ao obter checksums oficiais da API do WordPress.org: ' . $checksums->get_error_message(),
            );
        }

        if (empty($checksums) || !is_array($checksums)) {
            return array(
                'status'  => 500,
                'success' => false,
                'message' => 'Nenhum checksum oficial encontrado para o WordPress versão ' . $wp_version . '.',
            );
        }

        $modified   = array();
        $missing    = array();
        $suspicious = array();
        $passed     = 0;

        $abs_path = wp_normalize_path(ABSPATH);

        // 1. Verify official core files
        foreach ($checksums as $file => $expected_hash) {
            // Ignore files in wp-content as they are user customizable / translated
            if (strpos($file, 'wp-content/') === 0) {
                continue;
            }

            $full_path = wp_normalize_path($abs_path . $file);

            // Check for sample files or sensitive install leftovers that should not be in production
            if ($file === 'wp-config-sample.php') {
                if (file_exists($full_path)) {
                    $size  = @filesize($full_path);
                    $mtime = @filemtime($full_path);
                    $suspicious[] = array(
                        'file'           => $file,
                        'type'           => 'suspicious',
                        'severity'       => 'LOW',
                        'expected_hash'  => null,
                        'actual_hash'    => @md5_file($full_path),
                        'size'           => $size ? (int)$size : 0,
                        'modified_at'    => $mtime ? date('Y-m-d H:i:s', $mtime) : null,
                        'description'    => 'Arquivo de exemplo (wp-config-sample.php) presente na raiz. Em servidores de produção, é uma boa prática de segurança excluí-lo.',
                        'recommendation' => 'Exclua este arquivo diretamente pelo painel para reduzir informações expostas.',
                    );
                }
                continue;
            }

            if ($file === 'readme.html') {
                if (file_exists($full_path)) {
                    $size  = @filesize($full_path);
                    $mtime = @filemtime($full_path);
                    $suspicious[] = array(
                        'file'           => $file,
                        'type'           => 'suspicious',
                        'severity'       => 'LOW',
                        'expected_hash'  => null,
                        'actual_hash'    => @md5_file($full_path),
                        'size'           => $size ? (int)$size : 0,
                        'modified_at'    => $mtime ? date('Y-m-d H:i:s', $mtime) : null,
                        'description'    => 'Arquivo de documentação (readme.html) exposto na raiz. Pode revelar a versão exata do WordPress para visitantes públicos e robôs de varredura.',
                        'recommendation' => 'Exclua este arquivo pelo painel para ocultar a versão do WordPress de escaneamentos externos.',
                    );
                }
                continue;
            }

            if (!file_exists($full_path)) {
                $missing[] = array(
                    'file'           => $file,
                    'type'           => 'missing',
                    'severity'       => 'HIGH',
                    'expected_hash'  => $expected_hash,
                    'actual_hash'    => null,
                    'size'           => 0,
                    'modified_at'    => null,
                    'description'    => 'Arquivo oficial do core do WordPress não encontrado no servidor.',
                    'recommendation' => 'Reinstale o arquivo oficial da versão ' . $wp_version . ' do WordPress.',
                );
                continue;
            }

            $local_hash = @md5_file($full_path);

            if ($local_hash !== $expected_hash) {
                $size = @filesize($full_path);
                $mtime = @filemtime($full_path);

                $modified[] = array(
                    'file'           => $file,
                    'type'           => 'modified',
                    'severity'       => 'CRITICAL',
                    'expected_hash'  => $expected_hash,
                    'actual_hash'    => $local_hash,
                    'size'           => $size ? (int)$size : 0,
                    'modified_at'    => $mtime ? date('Y-m-d H:i:s', $mtime) : null,
                    'description'    => 'Conteúdo modificado em relação ao oficial do WordPress.org. Forte indício de alteração manual ou injeção de código malicioso.',
                    'recommendation' => 'Substitua imediatamente pelo arquivo autêntico original do WordPress.',
                );
            } else {
                $passed++;
            }
        }

        // 2. Scan for suspicious / unknown PHP files in core directories (wp-admin, wp-includes, root)
        $suspicious = $this->find_suspicious_files($abs_path, $checksums);

        $total_checked = count($checksums);
        $all_issues    = array_merge($modified, $suspicious, $missing);

        // 3. Process Ignored / Resolved Files & Auto-Cleanup
        $saved_ignored = get_option(self::OPTION_IGNORED_FILES, array());
        if (!is_array($saved_ignored)) {
            $saved_ignored = array();
        }

        // Build list of current issues keys
        $current_issue_files = array();
        foreach ($all_issues as $iss) {
            $current_issue_files[$iss['file']] = true;
        }

        // Rule: If an ignored file ceases to exist among current detected issues (e.g. deleted or restored),
        // completely purge it from the saved ignored records so that if it ever returns, it flags as un-resolved!
        $ignored_changed = false;
        foreach ($saved_ignored as $ign_file => $ign_data) {
            if (!isset($current_issue_files[$ign_file])) {
                unset($saved_ignored[$ign_file]);
                $ignored_changed = true;
            }
        }
        if ($ignored_changed) {
            update_option(self::OPTION_IGNORED_FILES, $saved_ignored);
        }

        // Apply ignored state to issues
        $active_issues  = 0;
        $ignored_issues = 0;
        foreach ($all_issues as &$issue) {
            $file_key = $issue['file'];
            if (isset($saved_ignored[$file_key])) {
                $issue['is_ignored']  = true;
                $issue['ignored_at']  = isset($saved_ignored[$file_key]['ignored_at']) ? $saved_ignored[$file_key]['ignored_at'] : null;
                $issue['ignore_note'] = isset($saved_ignored[$file_key]['note']) ? $saved_ignored[$file_key]['note'] : '';
                $ignored_issues++;
            } else {
                $issue['is_ignored']  = false;
                $issue['ignored_at']  = null;
                $issue['ignore_note'] = '';
                $active_issues++;
            }
        }
        unset($issue);

        // Site is considered secure if there are no ACTIVE (unignored) issues
        $is_secure = ($active_issues === 0);

        $result = array(
            'scanned_at'    => date('Y-m-d H:i:s'),
            'wp_version'    => $wp_version,
            'locale'        => get_locale(),
            'is_secure'     => $is_secure,
            'summary'       => array(
                'total_checked'  => $total_checked,
                'passed'         => $passed,
                'modified'       => count($modified),
                'suspicious'     => count($suspicious),
                'missing'        => count($missing),
                'issues_count'   => count($all_issues),
                'active_issues'  => $active_issues,
                'ignored_issues' => $ignored_issues,
            ),
            'issues'        => $all_issues,
        );

        // Save last scan result
        update_option('vs_last_integrity_scan', $result);

        return array(
            'status'  => 200,
            'success' => true,
            'data'    => $result,
        );
    }

    /**
     * Retrieve official checksums from WordPress.org API
     */
    private function get_core_checksums($wp_version) {
        $transient_key = self::CHECKSUM_TRANSIENT_PREFIX . sanitize_key($wp_version);
        $cached = get_transient($transient_key);

        if ($cached && is_array($cached)) {
            return $cached;
        }

        $locale = get_locale();
        $urls = array(
            'https://api.wordpress.org/core/checksums/1.0/?version=' . urlencode($wp_version) . '&locale=' . urlencode($locale),
            'https://api.wordpress.org/core/checksums/1.0/?version=' . urlencode($wp_version) . '&locale=en_US',
            'https://api.wordpress.org/core/checksums/1.0/?version=' . urlencode($wp_version),
        );

        $checksums = null;
        $last_error = null;

        foreach ($urls as $url) {
            $response = wp_remote_get($url, array(
                'timeout'     => 20,
                'sslverify'   => false,
                'user-agent'  => 'WordPress/' . $wp_version . '; ' . home_url('/'),
            ));

            if (is_wp_error($response)) {
                $last_error = $response;
                continue;
            }

            $code = wp_remote_retrieve_response_code($response);
            $body = wp_remote_retrieve_body($response);

            if ($code === 200 && !empty($body)) {
                $data = json_decode($body, true);
                if (!empty($data['checksums']) && is_array($data['checksums'])) {
                    $checksums = $data['checksums'];
                    break;
                }
            }
        }

        if (empty($checksums)) {
            return $last_error ?: new WP_Error('no_checksums', 'API do WordPress.org não retornou dados de integridade para a versão ' . $wp_version);
        }

        // Cache for 24 hours
        set_transient($transient_key, $checksums, DAY_IN_SECONDS);

        return $checksums;
    }

    /**
     * Scan system directories for unknown PHP files
     */
    private function find_suspicious_files($abs_path, $checksums) {
        $suspicious = array();

        $scan_dirs = array(
            'wp-admin'    => $abs_path . 'wp-admin',
            'wp-includes' => $abs_path . 'wp-includes',
        );

        $allowed_exts = array('php', 'phtml', 'php5', 'suspected', 'ico');

        foreach ($scan_dirs as $prefix => $dir) {
            if (!is_dir($dir)) {
                continue;
            }

            try {
                $iterator = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
                    RecursiveIteratorIterator::LEAVES_ONLY
                );

                foreach ($iterator as $file) {
                    if (!$file->isFile()) {
                        continue;
                    }

                    $ext = strtolower(pathinfo($file->getFilename(), PATHINFO_EXTENSION));
                    if (!in_array($ext, $allowed_exts, true)) {
                        continue;
                    }

                    $relative_path = wp_normalize_path(substr($file->getPathname(), strlen($abs_path)));

                    // If not in official checksums, it's an unrecognized file in core dir
                    if (!isset($checksums[$relative_path])) {
                        $size = $file->getSize();
                        $mtime = $file->getMTime();

                        $suspicious[] = array(
                            'file'           => $relative_path,
                            'type'           => 'suspicious',
                            'severity'       => 'CRITICAL',
                            'expected_hash'  => null,
                            'actual_hash'    => @md5_file($file->getPathname()),
                            'size'           => $size ? (int)$size : 0,
                            'modified_at'    => $mtime ? date('Y-m-d H:i:s', $mtime) : null,
                            'description'    => 'Arquivo não reconhecido dentro do diretório protegido do sistema (' . $prefix . '/). Não pertence à instalação padrão do WordPress.',
                            'recommendation' => 'Inspecione e remova o arquivo. É um local clássico de instalação de webshells e backdoors.',
                        );
                    }
                }
            } catch (Exception $e) {
                // Skip if directory not readable
            }
        }

        // Also check root directory for suspicious unexpected PHP files
        $root_ignore = array(
            'index.php',
            'wp-activate.php',
            'wp-blog-header.php',
            'wp-comments-post.php',
            'wp-config.php',
            'wp-config-sample.php',
            'wp-cron.php',
            'wp-links-opml.php',
            'wp-load.php',
            'wp-login.php',
            'wp-mail.php',
            'wp-settings.php',
            'wp-signup.php',
            'wp-trackback.php',
            'xmlrpc.php',
        );

        $root_files = @scandir($abs_path);
        if (is_array($root_files)) {
            foreach ($root_files as $rf) {
                if ($rf === '.' || $rf === '..' || is_dir($abs_path . $rf)) {
                    continue;
                }
                $ext = strtolower(pathinfo($rf, PATHINFO_EXTENSION));
                if ($ext === 'php' && !in_array($rf, $root_ignore, true) && !isset($checksums[$rf])) {
                    // Check if it's a known wp-config variant
                    if (strpos($rf, 'wp-config') === 0) {
                        continue;
                    }
                    $full_rf = $abs_path . $rf;
                    $size = @filesize($full_rf);
                    $mtime = @filemtime($full_rf);

                    $suspicious[] = array(
                        'file'           => $rf,
                        'type'           => 'suspicious',
                        'severity'       => 'HIGH',
                        'expected_hash'  => null,
                        'actual_hash'    => @md5_file($full_rf),
                        'size'           => $size ? (int)$size : 0,
                        'modified_at'    => $mtime ? date('Y-m-d H:i:s', $mtime) : null,
                        'description'    => 'Arquivo PHP desconhecido na raiz da instalação que não pertence ao WordPress oficial.',
                        'recommendation' => 'Verifique a origem deste arquivo. Se não foi criado intencionalmente, delete-o.',
                    );
                }
            }
        }

        return $suspicious;
    }

    /**
     * Get last stored integrity scan result
     */
    public function get_last_result() {
        $last = get_option('vs_last_integrity_scan', null);
        if (!$last) {
            return $this->verify_core_integrity();
        }

        $saved_ignored = get_option(self::OPTION_IGNORED_FILES, array());
        if (is_array($saved_ignored) && isset($last['issues']) && is_array($last['issues'])) {
            $active    = 0;
            $ign_count = 0;
            foreach ($last['issues'] as &$iss) {
                $f = $iss['file'];
                if (isset($saved_ignored[$f])) {
                    $iss['is_ignored']  = true;
                    $iss['ignored_at']  = isset($saved_ignored[$f]['ignored_at']) ? $saved_ignored[$f]['ignored_at'] : null;
                    $iss['ignore_note'] = isset($saved_ignored[$f]['note']) ? $saved_ignored[$f]['note'] : '';
                    $ign_count++;
                } else {
                    $iss['is_ignored']  = false;
                    $iss['ignored_at']  = null;
                    $iss['ignore_note'] = '';
                    $active++;
                }
            }
            unset($iss);

            $last['is_secure'] = ($active === 0);
            $last['summary']['active_issues']  = $active;
            $last['summary']['ignored_issues'] = $ign_count;
        }

        return array(
            'status'  => 200,
            'success' => true,
            'data'    => $last,
        );
    }

    /**
     * Toggle ignored/resolved status for an issue file
     */
    public function toggle_ignore_issue($file, $ignore = true, $note = '') {
        $file = sanitize_text_field(trim($file));
        if (empty($file)) {
            return array(
                'status'  => 400,
                'success' => false,
                'message' => 'Caminho do arquivo não informado.',
            );
        }

        $saved_ignored = get_option(self::OPTION_IGNORED_FILES, array());
        if (!is_array($saved_ignored)) {
            $saved_ignored = array();
        }

        if ($ignore) {
            $saved_ignored[$file] = array(
                'ignored_at' => date('Y-m-d H:i:s'),
                'note'       => sanitize_text_field($note),
            );
        } else {
            unset($saved_ignored[$file]);
        }

        update_option(self::OPTION_IGNORED_FILES, $saved_ignored);

        // Update cached scan result if present
        $cached = get_option('vs_last_integrity_scan', null);
        if ($cached && is_array($cached) && isset($cached['issues']) && is_array($cached['issues'])) {
            $active    = 0;
            $ign_count = 0;
            foreach ($cached['issues'] as &$iss) {
                $f = $iss['file'];
                if (isset($saved_ignored[$f])) {
                    $iss['is_ignored']  = true;
                    $iss['ignored_at']  = isset($saved_ignored[$f]['ignored_at']) ? $saved_ignored[$f]['ignored_at'] : null;
                    $iss['ignore_note'] = isset($saved_ignored[$f]['note']) ? $saved_ignored[$f]['note'] : '';
                    $ign_count++;
                } else {
                    $iss['is_ignored']  = false;
                    $iss['ignored_at']  = null;
                    $iss['ignore_note'] = '';
                    $active++;
                }
            }
            unset($iss);

            $cached['is_secure'] = ($active === 0);
            $cached['summary']['active_issues']  = $active;
            $cached['summary']['ignored_issues'] = $ign_count;
            update_option('vs_last_integrity_scan', $cached);
            $result_data = $cached;
        } else {
            $run = $this->verify_core_integrity();
            $result_data = isset($run['data']) ? $run['data'] : null;
        }

        return array(
            'status'  => 200,
            'success' => true,
            'message' => $ignore ? 'Arquivo ignorado e marcado como resolvido.' : 'Arquivo reativado para monitoramento.',
            'data'    => $result_data,
        );
    }

    /**
     * Safely delete an unneeded or malicious file from the WordPress installation
     */
    public function delete_file($file) {
        $file = sanitize_text_field(trim($file));
        if (empty($file)) {
            return array(
                'status'  => 400,
                'success' => false,
                'message' => 'Caminho do arquivo não informado.',
            );
        }

        // Prevent directory traversal or stream wrappers
        if (strpos($file, '..') !== false || strpos($file, '\\') !== false || strpos($file, '://') !== false) {
            return array(
                'status'  => 403,
                'success' => false,
                'message' => 'Caminho de arquivo inválido ou inseguro (tentativa de travessia bloqueada).',
            );
        }

        $abs_path  = wp_normalize_path(ABSPATH);
        $clean_rel = ltrim(wp_normalize_path($file), '/');
        $full_path = wp_normalize_path($abs_path . $clean_rel);

        // Ensure target is strictly inside ABSPATH
        if (strpos($full_path, $abs_path) !== 0) {
            return array(
                'status'  => 403,
                'success' => false,
                'message' => 'Operação proibida fora da raiz da instalação do WordPress.',
            );
        }

        // Protected files that must NEVER be deleted via API
        $protected_files = array(
            'wp-config.php',
            '.htaccess',
            'web.config',
            'index.php',
            'wp-load.php',
            'wp-settings.php',
            'wp-blog-header.php',
            'wp-login.php',
            'wp-cron.php',
            'wp-activate.php',
            'wp-mail.php',
            'wp-links-opml.php',
            'wp-trackback.php',
            'wp-includes/version.php',
        );

        if (in_array($clean_rel, $protected_files, true)) {
            return array(
                'status'  => 403,
                'success' => false,
                'message' => 'O arquivo "' . $clean_rel . '" é essencial para o funcionamento do WordPress e não pode ser excluído.',
            );
        }

        if (!file_exists($full_path)) {
            return array(
                'status'  => 404,
                'success' => false,
                'message' => 'Arquivo "' . $clean_rel . '" não foi encontrado no servidor.',
            );
        }

        if (is_dir($full_path)) {
            return array(
                'status'  => 400,
                'success' => false,
                'message' => 'O caminho especificado é um diretório. Exclusão de pastas inteiras não é permitida.',
            );
        }

        // Attempt deletion
        $deleted = @unlink($full_path);
        if (!$deleted) {
            return array(
                'status'  => 500,
                'success' => false,
                'message' => 'Não foi possível excluir o arquivo "' . $clean_rel . '". Verifique as permissões de escrita de arquivos do servidor (chmod/chown).',
            );
        }

        // Clean up from ignored files list if it was present
        $saved_ignored = get_option(self::OPTION_IGNORED_FILES, array());
        if (is_array($saved_ignored) && isset($saved_ignored[$clean_rel])) {
            unset($saved_ignored[$clean_rel]);
            update_option(self::OPTION_IGNORED_FILES, $saved_ignored);
        }

        // Update cached scan result if present
        $cached = get_option('vs_last_integrity_scan', null);
        if ($cached && is_array($cached) && isset($cached['issues']) && is_array($cached['issues'])) {
            $new_issues = array();
            $active     = 0;
            $ign_count  = 0;
            $mod_count  = 0;
            $susp_count = 0;
            $miss_count = 0;

            foreach ($cached['issues'] as $iss) {
                if ($iss['file'] === $clean_rel) {
                    continue; // Remove the deleted file from issues
                }
                if (!empty($iss['is_ignored'])) {
                    $ign_count++;
                } else {
                    $active++;
                }
                if ($iss['type'] === 'modified') {
                    $mod_count++;
                } elseif ($iss['type'] === 'suspicious') {
                    $susp_count++;
                } elseif ($iss['type'] === 'missing') {
                    $miss_count++;
                }
                $new_issues[] = $iss;
            }

            $cached['issues']                   = $new_issues;
            $cached['is_secure']                = ($active === 0);
            $cached['summary']['issues_count']   = count($new_issues);
            $cached['summary']['active_issues']  = $active;
            $cached['summary']['ignored_issues'] = $ign_count;
            $cached['summary']['modified']       = $mod_count;
            $cached['summary']['suspicious']     = $susp_count;
            $cached['summary']['missing']        = $miss_count;

            update_option('vs_last_integrity_scan', $cached);
            $result_data = $cached;
        } else {
            $run = $this->verify_core_integrity();
            $result_data = isset($run['data']) ? $run['data'] : null;
        }

        return array(
            'status'  => 200,
            'success' => true,
            'message' => 'Arquivo "' . $clean_rel . '" excluído com sucesso do servidor.',
            'data'    => $result_data,
        );
    }
}
