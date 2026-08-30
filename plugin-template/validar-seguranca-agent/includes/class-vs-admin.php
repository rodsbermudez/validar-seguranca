<?php

if (!defined('ABSPATH')) {
    exit;
}

class VS_Agent_Admin {

    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'handle_admin_actions'));
        add_action('admin_head', array($this, 'admin_head_styles'));
    }

    public function admin_head_styles() {
        echo '<style>
            #adminmenu .toplevel_page_wp-patropi .wp-menu-image img,
            #adminmenu #toplevel_page_wp-patropi .wp-menu-image img {
                max-width: 20px !important;
                max-height: 20px !important;
                width: 20px !important;
                height: 20px !important;
                padding: 3px 0 0 0 !important;
                object-fit: contain !important;
                box-sizing: border-box !important;
            }
            .vs-toggle-switch {
                position: relative;
                display: inline-block;
                width: 50px;
                height: 26px;
            }
            .vs-toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .vs-slider {
                position: absolute;
                cursor: pointer;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: #cbd5e1;
                transition: .3s;
                border-radius: 26px;
            }
            .vs-slider:before {
                position: absolute;
                content: "";
                height: 20px; width: 20px;
                left: 3px; bottom: 3px;
                background-color: white;
                transition: .3s;
                border-radius: 50%;
            }
            input:checked + .vs-slider {
                background-color: #10b981;
            }
            input:checked + .vs-slider:before {
                transform: translateX(24px);
            }
        </style>';
    }

    public function add_admin_menu() {
        $parent_slug = 'wp-patropi';
        $icon = VS_AGENT_URL . 'assets/favicon.png';

        if (empty($GLOBALS['admin_page_hooks'][$parent_slug])) {
            add_menu_page(
                'WP Patropi',
                'WP Patropi',
                'manage_options',
                $parent_slug,
                array($this, 'render_admin_page'),
                $icon,
                80
            );
        }

        add_submenu_page(
            $parent_slug,
            'WP Patropi - Diagnóstico',
            'WP Patropi - Diagnóstico',
            'manage_options',
            $parent_slug,
            array($this, 'render_admin_page')
        );

        add_submenu_page(
            $parent_slug,
            'Logs',
            'Logs',
            'manage_options',
            'wp-patropi-logs',
            array($this, 'render_logs_page')
        );
    }

    public function handle_admin_actions() {
        if (isset($_POST['vs_action'])) {
            if ($_POST['vs_action'] === 'connect_saas') {
                check_admin_referer('vs_connect_nonce');

                $site_id     = get_option('vs_site_id');
                $agent_token = get_option('vs_agent_token');
                $saas_url    = get_option('vs_saas_url', 'http://localhost/validar-seguranca');
                $site_url    = get_site_url();

                if (empty($site_id) || empty($agent_token)) {
                    add_settings_error('vs_messages', 'vs_err', 'Chave ou ID do site não encontrados no arquivo de configuração do plugin.', 'error');
                    return;
                }

                $target_endpoint = rtrim($saas_url, '/') . '/api/websites/connect';
                $response = wp_remote_post($target_endpoint, array(
                    'headers' => array('Content-Type' => 'application/json'),
                    'body'    => json_encode(array(
                        'site_id'     => $site_id,
                        'agent_token' => $agent_token,
                        'site_url'    => $site_url,
                    )),
                    'timeout' => 15,
                ));

                if (is_wp_error($response)) {
                    add_settings_error('vs_messages', 'vs_err', 'Erro de conexão com o painel SaaS: ' . $response->get_error_message(), 'error');
                    return;
                }

                $body = wp_remote_retrieve_body($response);
                $data = json_decode($body, true);

                if (isset($data['status']) && ($data['status'] == 200 || $data['status'] == 201)) {
                    update_option('vs_is_connected', 1);
                    add_settings_error('vs_messages', 'vs_msg', 'Site e ponte reconectados com sucesso ao painel Validar Segurança!', 'updated');
                } else {
                    $err_msg = isset($data['messages']['error']) ? $data['messages']['error'] : (isset($data['error']) ? $data['error'] : 'Falha no pareamento com o SaaS.');
                    add_settings_error('vs_messages', 'vs_err', 'Erro na conexão: ' . $err_msg, 'error');
                }
            } elseif ($_POST['vs_action'] === 'toggle_logging') {
                check_admin_referer('vs_logs_nonce');
                $current = (int) get_option('vs_logging_enabled', 0);
                $new_state = $current ? 0 : 1;
                update_option('vs_logging_enabled', $new_state);

                if ($new_state) {
                    VS_Agent_Logger::enable_error_logging();
                    add_settings_error('vs_messages', 'vs_msg', 'Log de erros do WordPress ativado com sucesso! Erros serão salvos em arquivo e ocultados da tela.', 'updated');
                } else {
                    add_settings_error('vs_messages', 'vs_msg', 'Log de erros do WordPress desativado.', 'updated');
                }
            } elseif ($_POST['vs_action'] === 'clear_logs') {
                check_admin_referer('vs_logs_nonce');
                VS_Agent_Logger::clear_logs();
                add_settings_error('vs_messages', 'vs_msg', 'Arquivo de registro de logs limpo com sucesso.', 'updated');
            }
        }
    }

    public function render_admin_page() {
        $site_id      = get_option('vs_site_id');
        $agent_token  = get_option('vs_agent_token');
        $saas_url     = get_option('vs_saas_url', 'http://localhost/validar-seguranca');
        $is_connected = get_option('vs_is_connected', 0);
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline" style="display:none;">WP Patropi - Diagnóstico</h1>
            <hr class="wp-header-end" style="display:none;" />

            <?php settings_errors('vs_messages'); ?>

            <div style="display: flex; align-items: center; justify-content: space-between; margin: 15px 0; background: #fff; padding: 15px 20px; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <img src="<?php echo esc_url(VS_AGENT_URL . 'assets/logo-Patropi.png'); ?>" alt="Patropi Comunica" style="max-height: 42px; height: 42px; width: auto; object-fit: contain;" onerror="this.style.display='none';" />
                    <div>
                        <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #1e293b;">WP Patropi - Diagnóstico</h2>
                        <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Desenvolvido por <strong>Rodrigo Bermudez - Patropi Comunica</strong> (<a href="https://patropicomunica.com.br" target="_blank" style="color: #2563eb; text-decoration: none;">patropicomunica.com.br</a>)</p>
                    </div>
                </div>
            </div>

            <div style="background: #fff; border: 1px solid #ccd0d4; padding: 20px; border-radius: 6px; max-width: 650px; margin-top: 20px;">
                <h2>Status da Conexão</h2>
                
                <?php if ($is_connected) : ?>
                    <div style="display: flex; align-items: center; gap: 10px; color: #2e7d32; font-weight: bold; font-size: 16px; margin-bottom: 15px;">
                        <span class="dashicons dashicons-yes-alt" style="font-size: 24px; width: 24px; height: 24px;"></span>
                        Site Conectado ao Painel Validar Segurança!
                    </div>
                    <p>O seu site está pareado e pronto para responder às auditorias automáticas solicitadas via painel SaaS.</p>
                    
                    <form method="post" action="" style="margin-top: 15px;">
                        <?php wp_nonce_field('vs_connect_nonce'); ?>
                        <input type="hidden" name="vs_action" value="connect_saas" />
                        <button type="submit" class="button button-secondary" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; height: auto; font-weight: 500;">
                            <span class="dashicons dashicons-update" style="font-size: 18px; width: 18px; height: 18px; margin-top: 1px;"></span>
                            Reconectar / Refazer Ponte com a Plataforma
                        </button>
                    </form>
                <?php else : ?>
                    <div style="display: flex; align-items: center; gap: 10px; color: #d32f2f; font-weight: bold; font-size: 16px; margin-bottom: 15px;">
                        <span class="dashicons dashicons-warning" style="font-size: 24px; width: 24px; height: 24px;"></span>
                        Site Não Conectado
                    </div>
                    <p>Clique no botão abaixo para autorizar o pareamento automático deste site com a sua conta no Validar Segurança.</p>
                    
                    <form method="post" action="">
                        <?php wp_nonce_field('vs_connect_nonce'); ?>
                        <input type="hidden" name="vs_action" value="connect_saas" />
                        <button type="submit" class="button button-primary button-large" style="background: #3f51b5; border-color: #3f51b5; display: inline-flex; align-items: center; gap: 6px;">
                            <span class="dashicons dashicons-admin-links" style="font-size: 18px; width: 18px; height: 18px; margin-top: 1px;"></span>
                            Conectar Agora com Validar Segurança
                        </button>
                    </form>
                <?php endif; ?>

                <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />

                <table class="widefat striped" style="border: 0;">
                    <tbody>
                        <tr>
                            <td><strong>ID do Site no SaaS:</strong></td>
                            <td><code><?php echo esc_html($site_id ? $site_id : 'Não definido'); ?></code></td>
                        </tr>
                        <tr>
                            <td><strong>Token do Agente:</strong></td>
                            <td><code><?php echo esc_html($agent_token ? substr($agent_token, 0, 10) . '...' : 'Não definido'); ?></code></td>
                        </tr>
                        <tr>
                            <td><strong>URL do Painel SaaS:</strong></td>
                            <td><code><?php echo esc_html($saas_url); ?></code></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <?php
    }

    public function render_logs_page() {
        $logging_enabled = (int) get_option('vs_logging_enabled', 0);
        $current_filter  = isset($_GET['filter_level']) ? sanitize_text_field($_GET['filter_level']) : 'all';
        $logs            = VS_Agent_Logger::get_logs(100, $current_filter);
        $total_logs      = count($logs);
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline" style="display:none;">WP Patropi - Logs</h1>
            <hr class="wp-header-end" style="display:none;" />

            <?php settings_errors('vs_messages'); ?>

            <div style="display: flex; align-items: center; justify-content: space-between; margin: 15px 0; background: #fff; padding: 15px 20px; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <img src="<?php echo esc_url(VS_AGENT_URL . 'assets/logo-Patropi.png'); ?>" alt="Patropi Comunica" style="max-height: 42px; height: 42px; width: auto; object-fit: contain;" onerror="this.style.display='none';" />
                    <div>
                        <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #1e293b;">WP Patropi - Logs do WordPress</h2>
                        <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Gerenciador e Visualizador de Erros em Arquivo</p>
                    </div>
                </div>
            </div>

            <!-- Card de Controle do Log -->
            <div style="background: #fff; border: 1px solid #ccd0d4; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h3 style="margin: 0 0 5px 0; font-size: 16px; color: #1e293b;">Ativar Log do WordPress em Arquivo</h3>
                        <p style="margin: 0; font-size: 13px; color: #64748b;">
                            Quando ativado, armazena avisos e erros em <code>wp-content/uploads/wp-patropi-logs/debug.log</code> e esconde erros de exibição na tela.
                        </p>
                    </div>
                    <form method="post" action="" style="margin: 0;">
                        <?php wp_nonce_field('vs_logs_nonce'); ?>
                        <input type="hidden" name="vs_action" value="toggle_logging" />
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <label class="vs-toggle-switch">
                                <input type="checkbox" onchange="this.form.submit()" <?php checked($logging_enabled, 1); ?> />
                                <span class="vs-slider"></span>
                            </label>
                            <span style="font-weight: 600; font-size: 14px; color: <?php echo $logging_enabled ? '#10b981' : '#64748b'; ?>;">
                                <?php echo $logging_enabled ? 'LIGADO' : 'DESLIGADO'; ?>
                            </span>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Filtros e Ações -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 600; font-size: 13px; color: #475569;">Filtrar por Gravidade:</span>
                    <?php
                    $filters = array(
                        'all'        => 'Todos',
                        'fatal'      => 'Fatal Error',
                        'warning'    => 'Warning',
                        'notice'     => 'Notice',
                        'deprecated' => 'Deprecated',
                    );
                    foreach ($filters as $key => $label) :
                        $active = ($current_filter === $key);
                        $url    = add_query_arg(array('page' => 'wp-patropi-logs', 'filter_level' => $key), admin_url('admin.php'));
                        ?>
                        <a href="<?php echo esc_url($url); ?>" class="button <?php echo $active ? 'button-primary' : 'button-secondary'; ?>" style="font-size: 12px; height: 28px; line-height: 26px; padding: 0 10px;">
                            <?php echo esc_html($label); ?>
                        </a>
                    <?php endforeach; ?>
                </div>

                <?php if (!empty($logs)) : ?>
                    <form method="post" action="" style="margin: 0;" onsubmit="return confirm('Deseja realmente limpar o histórico de logs?');">
                        <?php wp_nonce_field('vs_logs_nonce'); ?>
                        <input type="hidden" name="vs_action" value="clear_logs" />
                        <button type="submit" class="button button-secondary style-danger" style="color: #ef4444; border-color: #fca5a5;">
                            <span class="dashicons dashicons-trash" style="font-size: 16px; width: 16px; height: 16px; margin-top: 3px;"></span>
                            Limpar Logs
                        </button>
                    </form>
                <?php endif; ?>
            </div>

            <!-- Tabela de Logs (Últimos 100 Registros) -->
            <div style="background: #fff; border: 1px solid #ccd0d4; border-radius: 6px; overflow: hidden;">
                <table class="widefat striped" style="border: 0; margin: 0;">
                    <thead>
                        <tr>
                            <th style="width: 170px;">Data / Hora</th>
                            <th style="width: 110px;">Nível</th>
                            <th>Registro de Log</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($logs)) : ?>
                            <tr>
                                <td colspan="3" style="text-align: center; padding: 30px; color: #64748b;">
                                    <?php if (!$logging_enabled) : ?>
                                        <em>O log está desativado no momento. Use a chave acima para ligá-lo.</em>
                                    <?php else : ?>
                                        <em>Nenhum registro de log encontrado para o filtro selecionado.</em>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php else : ?>
                            <?php foreach ($logs as $log) : 
                                $badge_bg    = '#6b7280';
                                $badge_color = '#ffffff';

                                switch (strtolower($log['level'])) {
                                    case 'fatal':
                                        $badge_bg = '#ef4444';
                                        break;
                                    case 'warning':
                                        $badge_bg = '#f59e0b';
                                        break;
                                    case 'notice':
                                        $badge_bg = '#3b82f6';
                                        break;
                                    case 'deprecated':
                                        $badge_bg = '#9ca3af';
                                        break;
                                }
                                ?>
                                <tr>
                                    <td style="font-size: 12px; color: #64748b; font-family: monospace;">
                                        <?php echo esc_html($log['timestamp']); ?>
                                    </td>
                                    <td>
                                        <span style="background: <?php echo $badge_bg; ?>; color: <?php echo $badge_color; ?>; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; display: inline-block;">
                                            <?php echo esc_html($log['level']); ?>
                                        </span>
                                    </td>
                                    <td style="font-family: monospace; font-size: 12px; color: #1e293b; word-break: break-word;">
                                        <?php echo esc_html($log['message']); ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
            <p style="font-size: 12px; color: #64748b; margin-top: 8px; text-align: right;">
                Exibindo no máximo os 100 registros mais recentes.
            </p>
        </div>
        <?php
    }
}
