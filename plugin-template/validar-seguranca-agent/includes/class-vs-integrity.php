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
        $is_secure     = (empty($modified) && empty($suspicious) && empty($missing));

        $all_issues = array_merge($modified, $suspicious, $missing);

        $result = array(
            'scanned_at'    => date('Y-m-d H:i:s'),
            'wp_version'    => $wp_version,
            'locale'        => get_locale(),
            'is_secure'     => $is_secure,
            'summary'       => array(
                'total_checked' => $total_checked,
                'passed'        => $passed,
                'modified'      => count($modified),
                'suspicious'    => count($suspicious),
                'missing'       => count($missing),
                'issues_count'  => count($all_issues),
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

        return array(
            'status'  => 200,
            'success' => true,
            'data'    => $last,
        );
    }
}
