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
                'problem_description'   => 'Requisições para /?author=1 expõem o slug dos usuários ou retornam uma tela em branco HTTP 200 sem tratamento.',
                'solution_title'        => 'Bloqueio de Enumeração de Autores com Resposta HTTP 404 Nativa',
                'solution_instructions' => 'Instale o plugin de remediação para interceptar requisições de consulta de autor e emitir o template e status nativo HTTP 404 Not Found.',
                'fix_code_snippet'      => <<<'PHP'
// Bloquear Enumeração de Autores com HTTP 404 Nativo
add_action('template_redirect', function() {
    if (is_admin()) return;
    if (isset($_GET['author']) || is_author()) {
        global $wp_query;
        if (isset($wp_query)) {
            $wp_query->set_404();
        }
        status_header(404);
        nocache_headers();
        $template = get_query_template('404');
        if ($template) {
            include($template);
        } else {
            echo "<h1>404 Not Found</h1>";
        }
        exit;
    }
});
PHP,
                'ai_notes'              => 'Emite resposta 404 limpa, impedindo ataques de enumeração e evitando telas brancas.',
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
// Desativar XML-RPC
add_filter('xmlrpc_enabled', '__return_false');
add_filter('wp_headers', function($headers) {
    unset($headers['X-Pingback']);
    return $headers;
});
PHP,
                'ai_notes'              => 'Desativa XML-RPC prevenindo ataques de amplificação.',
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
