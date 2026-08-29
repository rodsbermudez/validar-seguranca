<?php

if (!defined('ABSPATH')) {
    exit;
}

class VS_Agent_Admin {

    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'handle_connect_action'));
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
    }

    public function handle_connect_action() {
        if (isset($_POST['vs_action']) && $_POST['vs_action'] === 'connect_saas') {
            check_admin_referer('vs_connect_nonce');

            $site_id     = get_option('vs_site_id');
            $agent_token = get_option('vs_agent_token');
            $saas_url    = get_option('vs_saas_url', 'http://localhost/validar-seguranca');
            $site_url    = get_site_url();

            if (empty($site_id) || empty($agent_token)) {
                add_settings_error('vs_messages', 'vs_err', 'Chave ou ID do site não encontrados no arquivo de configuração do plugin.', 'error');
                return;
            }

            // Call SaaS Handshake Endpoint
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
}
