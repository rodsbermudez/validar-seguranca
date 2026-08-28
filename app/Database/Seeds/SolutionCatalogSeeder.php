<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class SolutionCatalogSeeder extends Seeder
{
    public function run()
    {
        $solutions = [
            [
                'check_id'              => 'enum_author_query',
                'check_name'            => 'Enumeração via Query Author (/?author=1)',
                'action_type'           => 'PLUGIN_AUTO_FIX',
                'problem_description'   => 'Requisições para /?author=1 permanecem acessíveis no navegador (podendo vazar o slug de usuário ou exibir uma tela em branco HTTP 200).',
                'solution_title'        => 'Redirecionamento Automático de Consultas de Autor para a Página Inicial (/)',
                'solution_instructions' => 'Instale o plugin de remediação para redirecionar automaticamente qualquer tentativa de acesso por ?author=N para a página inicial (/) com status HTTP 301 permanente.',
                'fix_code_snippet'      => <<<'PHP'
// Bloquear enumeração de autores via /?author=N com redirecionamento 301 imediato para a Home
add_action('init', function() {
    if (is_admin()) return;
    if (isset($_GET['author']) || (isset($_SERVER['REQUEST_URI']) && preg_match('/[\?&]author=\d+/i', $_SERVER['REQUEST_URI']))) {
        wp_redirect(home_url('/'), 301);
        exit;
    }
}, 1);
add_action('template_redirect', function() {
    if (is_admin()) return;
    if (is_author()) {
        wp_redirect(home_url('/'), 301);
        exit;
    }
}, 1);
PHP,
                'ai_notes'              => 'Redireciona com HTTP 301 qualquer requisição /?author=N para a home no hook init antecedendo qualquer redirecionamento de autor do WordPress.',
                'created_at'            => date('Y-m-d H:i:s'),
                'updated_at'            => date('Y-m-d H:i:s'),
            ],
            [
                'check_id'              => 'enum_users_rest',
                'check_name'            => 'Enumeração de Usuários via REST API',
                'action_type'           => 'PLUGIN_AUTO_FIX',
                'problem_description'   => 'A rota /wp-json/wp/v2/users expõe nomes de usuários cadastrados para visitantes não autenticados.',
                'solution_title'        => 'Bloqueio de Enumeração de Usuários na REST API',
                'solution_instructions' => 'Exige autenticação para acessar os endpoints de usuários na REST API do WordPress.',
                'fix_code_snippet'      => <<<'PHP'
// Restringir Endpoint REST API /wp-json/wp/v2/users
add_filter('rest_authentication_errors', function($result) {
    if (!empty($result)) {
        return $result;
    }
    if (!is_user_logged_in() && str_contains($_SERVER['REQUEST_URI'] ?? '', '/wp/v2/users')) {
        return new WP_Error('rest_forbidden', __('Acesso restrito a usuários autenticados.', 'validar-seguranca'), array('status' => 401));
    }
    return $result;
});
PHP,
                'ai_notes'              => 'Retorna erro 401 para requisições não autenticadas no endpoint /users da REST API.',
                'created_at'            => date('Y-m-d H:i:s'),
                'updated_at'            => date('Y-m-d H:i:s'),
            ],
            [
                'check_id'              => 'xmlrpc_enabled',
                'check_name'            => 'Interface XML-RPC Ativa',
                'action_type'           => 'PLUGIN_AUTO_FIX',
                'problem_description'   => 'O arquivo xmlrpc.php está ativo e exposto, podendo ser utilizado em ataques de amplificação Brute Force e Pingback DDoS.',
                'solution_title'        => 'Desativação Completa da Interface XML-RPC',
                'solution_instructions' => 'Desativa os métodos XML-RPC e bloqueia requisições direcionadas ao arquivo xmlrpc.php.',
                'fix_code_snippet'      => <<<'PHP'
// Desativar XML-RPC completamente
add_filter('xmlrpc_enabled', '__return_false');
add_filter('wp_headers', function($headers) {
    unset($headers['X-Pingback']);
    return $headers;
});
if (isset($_SERVER['SCRIPT_NAME']) && str_contains($_SERVER['SCRIPT_NAME'], 'xmlrpc.php')) {
    status_header(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'XML-RPC services are disabled on this site.';
    exit;
}
PHP,
                'ai_notes'              => 'Bloqueia o arquivo xmlrpc.php com HTTP 403 e desativa o filtro xmlrpc_enabled.',
                'created_at'            => date('Y-m-d H:i:s'),
                'updated_at'            => date('Y-m-d H:i:s'),
            ],
            [
                'check_id'              => 'fingerprint_plugins_detected',
                'check_name'            => 'Enumeração de Plugins Ativos',
                'action_type'           => 'PLUGIN_AUTO_FIX',
                'problem_description'   => 'Identifica plugins instalados a partir das URLs de assets no HTML.',
                'solution_title'        => 'Ocultar versões e metadados de plugins para dificultar enumeração',
                'solution_instructions' => 'Remove os parâmetros de versão (?ver=x.y.z) de arquivos CSS e JS e limpa tags geradoras.',
                'fix_code_snippet'      => <<<'PHP'
// Ocultar versões e metadados em assets
remove_action('wp_head', 'wp_generator');
add_filter('the_generator', '__return_empty_string');
add_filter('style_loader_src', function($src) {
    return $src ? remove_query_arg('ver', $src) : $src;
}, 9999);
add_filter('script_loader_src', function($src) {
    return $src ? remove_query_arg('ver', $src) : $src;
}, 9999);
PHP,
                'ai_notes'              => 'Remove a tag wp_generator e parâmetros de versão ver= de scripts e folhas de estilo.',
                'created_at'            => date('Y-m-d H:i:s'),
                'updated_at'            => date('Y-m-d H:i:s'),
            ],
            [
                'check_id'              => 'header_strict_transport_security',
                'check_name'            => 'Strict-Transport-Security (HSTS)',
                'action_type'           => 'PLUGIN_AUTO_FIX',
                'problem_description'   => 'Envia o cabeçalho HSTS quando o site é acessado via HTTPS, instruindo navegadores a sempre usar conexões seguras.',
                'solution_title'        => 'Ativação do Cabeçalho Strict-Transport-Security (HSTS)',
                'solution_instructions' => 'Envia o cabeçalho HSTS via WordPress para todas as requisições HTTPS.',
                'fix_code_snippet'      => <<<'PHP'
// Enviar cabeçalho Strict-Transport-Security (HSTS)
add_action('send_headers', function() {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
}, 1);
PHP,
                'ai_notes'              => 'Adiciona o cabeçalho HSTS com max-age=31536000.',
                'created_at'            => date('Y-m-d H:i:s'),
                'updated_at'            => date('Y-m-d H:i:s'),
            ]
        ];

        $db = \Config\Database::connect();
        $builder = $db->table('solution_catalog');

        foreach ($solutions as $sol) {
            $existing = $builder->where('check_id', $sol['check_id'])->get()->getRow();
            if (!$existing) {
                $builder->insert($sol);
            } else {
                $builder->where('check_id', $sol['check_id'])->update($sol);
            }
        }
    }
}
