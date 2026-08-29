<?php

namespace App\Services;

class AIService
{
    protected string $apiKey;
    protected string $apiUrl;
    protected string $model;

    public function __construct(?string $overrideApiKey = null)
    {
        $this->apiKey = $overrideApiKey ?: (env('OPENCODE_API_KEY') ?: '');
        $url = env('OPENCODE_API_URL');
        if (empty($url) || str_contains($url, 'api.opencode.ai')) {
            $url = 'https://opencode.ai/zen/go/v1/chat/completions';
        }
        $this->apiUrl = $url;
        $this->model  = env('OPENCODE_MODEL') ?: 'kimi-k2.7-code';
    }

    /**
     * Set/override API Key at runtime
     */
    public function setApiKey(string $apiKey): self
    {
        $this->apiKey = trim($apiKey);
        return $this;
    }

    /**
     * Generate solution data for a single security check using OpenCode AI.
     */
    public function generateSolutionForCheck(array $checkDetails): array
    {
        $checkId   = $checkDetails['check_id'] ?? 'unknown_check';
        $checkName = $checkDetails['check_name'] ?? 'Checagem de Segurança';
        $details   = $checkDetails['details'] ?? '';
        $severity  = $checkDetails['severity'] ?? 'medium';

        $systemPrompt = "Você é um Especialista Sênior em Segurança da Informação e Segurança WordPress.\n" .
            "Sua tarefa é analisar uma falha específica de auditoria de segurança em um site WordPress e gerar uma solução altamente precisa e estruturada.\n\n" .
            "REGRAS DE TRIAGEM RIGOROSAS PARA 'action_type':\n" .
            "1. 'PLUGIN_AUTO_FIX': Escolha ESTE tipo SOMENTE se a falha puder ser corrigida com total segurança através de código PHP executado em um plugin WordPress (ex: desativar edição de arquivos via DISALLOW_FILE_EDIT, desativar XML-RPC via filtros, forçar moderação de comentários, ocultar versão do WP, proibir enumeração de usuários na REST API, aplicar cabeçalhos de segurança HTTP via PHP).\n" .
            "2. 'SERVER_CONFIG': Escolha ESTE tipo se a solução requerer alteração direta no servidor de hospedagem, no arquivo .htaccess do Apache, Nginx (nginx.conf), permissões de arquivo do Linux ou certificado SSL (ex: HSTS, X-Frame-Options no servidor, permissões 0644 no wp-config.php). NESSES CASOS, 'fix_code_snippet' DEVE SER OBLIGATORIAMENTE null!\n" .
            "3. 'MANUAL_ACTION': Escolha ESTE tipo se requerer ação do administrador humano (ex: alterar a senha fraca do usuário 'admin', atualizar plugins/temas pelo painel, remover plugins inativos). NESSES CASOS, 'fix_code_snippet' DEVE SER null!\n\n" .
            "FORMATO DE RESPOSTA OBRIGATÓRIO (JSON Puro sem Markdown):\n" .
            "{\n" .
            "  \"action_type\": \"PLUGIN_AUTO_FIX\" | \"SERVER_CONFIG\" | \"MANUAL_ACTION\",\n" .
            "  \"solution_title\": \"Título curto e direto em Português\",\n" .
            "  \"problem_analysis\": \"Explicação clara em Português sobre o risco da falha\",\n" .
            "  \"solution_instructions\": \"Passo a passo explicativo em Português para o cliente sanar o problema\",\n" .
            "  \"fix_code_snippet\": \"Código PHP limpo e funcional (SEM <?php no início) para ser embutido no plugin de remediação. DEVE SER null se for SERVER_CONFIG ou MANUAL_ACTION\",\n" .
            "  \"ai_notes\": \"Notas de segurança e prevenção de conflitos com outros plugins\"\n" .
            "}";

        $userPrompt = "Analise a seguinte falha de auditoria e forneça a solução no formato JSON exigido:\n\n" .
            "ID do Teste: {$checkId}\n" .
            "Nome do Teste: {$checkName}\n" .
            "Gravidade: {$severity}\n" .
            "Detalhes da Falha Encontrada no Site Alvo: {$details}";

        $response = $this->callOpenCodeApi($systemPrompt, $userPrompt, true, 90);
        return $this->parseJsonResponse($response, $checkId, $checkName);
    }

    /**
     * Generate the complete PHP code for the custom remediation plugin.
     */
    public function generateRemediationPlugin(array $pluginFixes, string $websiteUrl, string $customPrompt = ''): string
    {
        $siteHost = parse_url($websiteUrl, PHP_URL_HOST) ?: 'wordpress-site';
        $siteHostClean = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $siteHost);

        $fixesSummary = "";
        foreach ($pluginFixes as $index => $fix) {
            $num = $index + 1;
            $title = $fix['solution_title'] ?? ($fix['check_name'] ?? $fix['check_id']);
            $problem = $fix['problem_description'] ?? '';
            $instructions = $fix['solution_instructions'] ?? '';
            $snippet = $fix['fix_code_snippet'] ?? '';
            $notes = $fix['ai_notes'] ?? '';

            $fixesSummary .= "--- Correção #{$num}: {$title} (Check ID: {$fix['check_id']}) ---\n";
            if (!empty($problem)) {
                $fixesSummary .= "Descrição do Problema: {$problem}\n";
            }
            if (!empty($instructions)) {
                $fixesSummary .= "Instruções/Orientações: {$instructions}\n";
            }
            if (!empty($notes)) {
                $fixesSummary .= "Observações da IA: {$notes}\n";
            }
            $fixesSummary .= "Snippet de Código Base:\n{$snippet}\n\n";
        }

        $faviconDataUri = BrandingService::getFaviconDataUri();
        $logoDataUri    = BrandingService::getLogoDataUri();
        $authorName     = BrandingService::AUTHOR_NAME;
        $authorUri      = BrandingService::AUTHOR_URI;

        $systemPrompt = "Você é um Desenvolvedor WordPress Sênior e Especialista em Segurança.\n" .
            "Sua tarefa é compor um Plugin WordPress completo, robusto, limpo e profissional chamado 'WP Patropi - Fixes - {$siteHost}'.\n\n" .
            "REQUISITOS OBRIGATÓRIOS DO PLUGIN:\n" .
            "1. Comece OBRIGATORIAMENTE com o cabeçalho padrão de Plugin do WordPress:\n" .
            "   /*\n" .
            "    * Plugin Name: WP Patropi - Fixes - {$siteHost}\n" .
            "    * Plugin URI: {$authorUri}\n" .
            "    * Description: Plugin customizado de remediação de segurança gerado pela plataforma Validar Segurança.\n" .
            "    * Version: 1.0.0\n" .
            "    * Author: {$authorName}\n" .
            "    * Author URI: {$authorUri}\n" .
            "    * Text Domain: wp-patropi-fixes\n" .
            "    */\n" .
            "2. Verifique 'if (!defined(\"ABSPATH\")) exit;' no topo por segurança.\n" .
            "3. REGRA CRÍTICA PARA LINK DE CONFIGURAÇÕES NA LISTA DE PLUGINS (plugins.php):\n" .
            "   - Adicione o filtro 'plugin_action_links_' . plugin_basename(__FILE__) adicionando o link 'Configurações' direcionando para 'admin.php?page=wp-patropi-fixes'.\n" .
            "4. REGRA CRÍTICA PARA ESTRUTURA DE MENU NO WP ADMIN:\n" .
            "   - O menu principal deve se chamar 'WP Patropi' (slug: 'wp-patropi') com a posição 80 e ícone carregado de 'plugins_url(\"assets/favicon.png\", __FILE__)'.\n" .
            "   - Adicione via 'admin_head' o CSS para limitar a imagem do ícone do menu a 20x20px:\n" .
            "     add_action('admin_head', function() {\n" .
            "         echo '<style>#adminmenu .toplevel_page_wp-patropi .wp-menu-image img, #adminmenu #toplevel_page_wp-patropi .wp-menu-image img { max-width: 20px !important; max-height: 20px !important; width: 20px !important; height: 20px !important; padding: 3px 0 0 0 !important; object-fit: contain !important; }</style>';\n" .
            "     });\n" .
            "   - Adicione a tela do plugin como subitem do menu 'WP Patropi' chamado 'WP Patropi - Fixes' (slug: 'wp-patropi-fixes').\n" .
            "   - Exemplo de código do menu:\n" .
            "     add_action('admin_menu', function() {\n" .
            "         \$parent_slug = 'wp-patropi';\n" .
            "         \$icon_url    = plugins_url('assets/favicon.png', __FILE__);\n" .
            "         if (empty(\$GLOBALS['admin_page_hooks'][\$parent_slug])) {\n" .
            "             add_menu_page('WP Patropi', 'WP Patropi', 'manage_options', \$parent_slug, 'vs_render_remediation_admin_page', \$icon_url, 80);\n" .
            "         }\n" .
            "         add_submenu_page(\$parent_slug, 'WP Patropi - Fixes', 'WP Patropi - Fixes', 'manage_options', 'wp-patropi-fixes', 'vs_render_remediation_admin_page');\n" .
            "     });\n" .
            "5. NO TOPO DA PÁGINA ADMIN DO PLUGIN:\n" .
            "   - Inclua no início de <div class=\"wrap\"> as tags '<h1 class=\"wp-heading-inline\" style=\"display:none;\">WP Patropi - Fixes</h1><hr class=\"wp-header-end\" style=\"display:none;\" />' para que avisos do WordPress fiquem acima do card.\n" .
            "   - Exiba um cabeçalho estilizado contendo a logo em '<img src=\"' . esc_url(plugins_url('assets/logo-Patropi.png', __FILE__)) . '\" style=\"max-height:42px;height:42px;width:auto;object-fit:contain;\" />' e o título <h2>WP Patropi - Fixes</h2> com o crédito 'Desenvolvido por {$authorName} ({$authorUri})'.\n" .
            "   - Exiba a tabela formatada com a lista das correções ativas.\n" .
            "6. REGRAS PARA EVITAR TELA EM BRANCO E ERROS FATAL PHP:\n" .
            "   - NÃO chame funções do WordPress como home_url() ou wp_redirect() no topo puro do arquivo PHP, pois elas ainda não foram carregadas pelo WordPress e causarão Fatal Error.\n" .
            "   - Insira OBRIGATORIAMENTE todas as funções de bloqueio/redirecionamento dentro do hook 'plugins_loaded' com prioridade 1 (add_action('plugins_loaded', function() { ... }, 1)):\n" .
            "     a) Para enumeração de autor (/?author=N):\n" .
            "        add_action('plugins_loaded', function() {\n" .
            "            if (function_exists('is_admin') && is_admin()) return;\n" .
            "            if (isset(\$_GET['author']) || (isset(\$_SERVER['REQUEST_URI']) && preg_match('/[\\?&]author=\\d+/i', \$_SERVER['REQUEST_URI']))) {\n" .
            "                \$target = function_exists('home_url') ? home_url('/') : '/';\n" .
            "                if (function_exists('wp_redirect')) { wp_redirect(\$target, 301); } else { header('Location: ' . \$target, true, 301); }\n" .
            "                exit;\n" .
            "            }\n" .
            "        }, 1);\n" .
            "        // ATENÇÃO: Para enumeração de usuários, adicione também:\n" .
            "        add_filter('wp_sitemaps_add_provider', function(\$provider, \$name) { return \$name === 'users' ? false : \$provider; }, 10, 2);\n" .
            "        add_filter('rest_authentication_errors', function(\$result) { if(!is_user_logged_in() && str_contains(\$_SERVER['REQUEST_URI'] ?? '', '/wp/v2/users')) return new WP_Error('rest_forbidden', 'Auth', ['status'=>401]); return \$result; });\n" .
            "     b) Para XML-RPC (xmlrpc.php):\n" .
            "        add_filter('xmlrpc_enabled', '__return_false');\n" .
            "        add_action('plugins_loaded', function() {\n" .
            "            if (isset(\$_SERVER['SCRIPT_NAME']) && str_contains(\$_SERVER['SCRIPT_NAME'], 'xmlrpc.php')) {\n" .
            "                if (function_exists('status_header')) { status_header(403); } else { header('HTTP/1.1 403 Forbidden'); }\n" .
            "                header('Content-Type: text/plain; charset=utf-8'); echo 'XML-RPC disabled'; exit;\n" .
            "            }\n" .
            "        }, 1);\n" .
            "7. Aplique as demais correções fornecidas de forma limpa e segura.\n" .
            "8. GARANTA que o código seja 100% livre de erros de sintaxe PHP. NÃO utilize tags de abertura <?php adicionais dentro de funções ou trechos mal formatados.\n" .
            "9. Responda APENAS com o código PHP completo do plugin (começando com '<?php'). NÃO adicione textos de introdução ou cercas markdown de blocos de código.";

        $userPrompt = "Gere o código do plugin 'Validar Segurança Fix' para o site {$websiteUrl} contendo as seguintes correções de segurança:\n\n" .
            $fixesSummary;

        if (!empty(trim($customPrompt))) {
            $userPrompt .= "\nINSTRUÇÕES ADICIONAIS DO USUÁRIO / ADMIN (CONSIDERAR COM PRIORIDADE):\n" . trim($customPrompt) . "\n";
        }

        $rawPhp = $this->callOpenCodeApi($systemPrompt, $userPrompt, false, 120);
        
        // Clean markdown backticks if AI returns ```php ... ```
        $cleanPhp = preg_replace('/^```php\s*/i', '', trim($rawPhp));
        $cleanPhp = preg_replace('/^```\s*/i', '', $cleanPhp);
        $cleanPhp = preg_replace('/```$/', '', $cleanPhp);
        $cleanPhp = trim($cleanPhp);

        if (!str_starts_with($cleanPhp, '<?php')) {
            $cleanPhp = "<?php\n\n" . $cleanPhp;
        }

        return $cleanPhp;
    }

    /**
     * Send cURL request to OpenCode / OpenAI Compatible API with automatic fallback retry
     */
    protected function callOpenCodeApi(string $systemPrompt, string $userPrompt, bool $expectJson = false, int $timeout = 120): string
    {
        @set_time_limit($timeout + 30);

        if (empty($this->apiKey)) {
            throw new \RuntimeException("Chave da API OpenCode não configurada. Por favor, forneça uma API Key válida no arquivo .env ou nas configurações do sistema.");
        }

        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->apiKey,
        ];

        // Primary payload: omit 'temperature' to let provider use its required default (e.g. 1 for kimi-k2.7-code)
        $payload = [
            'model' => $this->model,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt],
            ],
        ];

        if ($expectJson) {
            $payload['response_format'] = ['type' => 'json_object'];
        }

        $response = $this->executeCurlCall($this->apiUrl, $headers, $payload, $timeout);

        // Fallback retry: If HTTP 400 occurs due to response_format or temperature parameters, retry with minimal payload
        if ($response['code'] === 400 && $expectJson) {
            unset($payload['response_format']);
            $response = $this->executeCurlCall($this->apiUrl, $headers, $payload, $timeout);
        }

        if ($response['error']) {
            throw new \RuntimeException("Erro cURL ao conectar à API OpenCode: " . $response['error']);
        }

        if ($response['code'] >= 400) {
            throw new \RuntimeException("API OpenCode respondeu com erro (HTTP {$response['code']}): " . $response['body']);
        }

        $json = json_decode($response['body'], true);
        if (isset($json['choices'][0]['message']['content'])) {
            return trim($json['choices'][0]['message']['content']);
        }

        if (trim($response['body']) === 'Not Found') {
            throw new \RuntimeException("URL da API OpenCode inválida (retornou Not Found). Verifique se a variável OPENCODE_API_URL no .env está configurada como 'https://opencode.ai/zen/go/v1/chat/completions'.");
        }

        throw new \RuntimeException("Resposta inesperada da API OpenCode: " . $response['body']);
    }

    /**
     * Helper to execute cURL HTTP request
     */
    protected function executeCurlCall(string $url, array $headers, array $payload, int $timeout): array
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);

        $body      = curl_exec($ch);
        $code      = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        return [
            'body'  => $body ?: '',
            'code'  => $code,
            'error' => $curlError,
        ];
    }

    /**
     * Parse and sanitize JSON response for single check solution
     */
    protected function parseJsonResponse(string $rawContent, string $checkId, string $checkName): array
    {
        // Strip out markdown code fences if present
        $cleanJson = preg_replace('/^```json\s*/i', '', trim($rawContent));
        $cleanJson = preg_replace('/^```\s*/i', '', $cleanJson);
        $cleanJson = preg_replace('/```$/', '', $cleanJson);
        $cleanJson = trim($cleanJson);

        $decoded = json_decode($cleanJson, true);

        // Robust fallback: if direct decode fails, attempt regex JSON extraction
        if (!is_array($decoded)) {
            if (preg_match('/\{[\s\S]*\}/', $cleanJson, $matches)) {
                $decoded = json_decode($matches[0], true);
            }
        }

        if (!is_array($decoded)) {
            // Fallback default structure if json parsing fails
            return [
                'check_id'              => $checkId,
                'check_name'            => $checkName,
                'action_type'           => 'PLUGIN_AUTO_FIX',
                'solution_title'        => "Solução para " . $checkName,
                'problem_description'   => $rawContent,
                'solution_instructions' => "Verifique as orientações de segurança para " . $checkName,
                'fix_code_snippet'      => null,
                'ai_notes'              => "Resposta da IA não pôde ser convertida diretamente em JSON.",
            ];
        }

        $actionType = strtoupper($decoded['action_type'] ?? 'PLUGIN_AUTO_FIX');
        if (!in_array($actionType, ['PLUGIN_AUTO_FIX', 'SERVER_CONFIG', 'MANUAL_ACTION'])) {
            $actionType = 'PLUGIN_AUTO_FIX';
        }

        $codeSnippet = $decoded['fix_code_snippet'] ?? null;
        if ($actionType !== 'PLUGIN_AUTO_FIX') {
            $codeSnippet = null;
        }

        return [
            'check_id'              => $checkId,
            'check_name'            => $checkName,
            'action_type'           => $actionType,
            'solution_title'        => $decoded['solution_title'] ?? ("Solução para " . $checkName),
            'problem_description'   => $decoded['problem_analysis'] ?? ($decoded['problem_description'] ?? ''),
            'solution_instructions' => $decoded['solution_instructions'] ?? '',
            'fix_code_snippet'      => $codeSnippet,
            'ai_notes'              => $decoded['ai_notes'] ?? '',
        ];
    }

    /**
     * Generate step-by-step resolution guide for SERVER_CONFIG & MANUAL_ACTION issues.
     */
    public function generateServerGuide(array $serverFixes, string $siteUrl): string
    {
        $issuesSummary = "";
        foreach ($serverFixes as $idx => $fix) {
            $num = $idx + 1;
            $title        = $fix['solution_title'] ?? $fix['check_name'] ?? $fix['check_id'];
            $problem      = $fix['problem_description'] ?? $fix['details'] ?? '';
            $instructions = $fix['solution_instructions'] ?? '';
            $actionType   = $fix['action_type'] ?? 'SERVER_CONFIG';

            $issuesSummary .= "### Item #{$num}: {$title} [Tipo: {$actionType} | Check ID: {$fix['check_id']}]\n";
            if (!empty($problem)) {
                $issuesSummary .= "- **Problema Identificado**: {$problem}\n";
            }
            if (!empty($instructions)) {
                $issuesSummary .= "- **Orientação Inicial**: {$instructions}\n";
            }
            $issuesSummary .= "\n";
        }

        $systemPrompt = "Você é um Engenheiro de Infraestrutura e Especialista em Segurança de Servidores Web (Apache, Nginx, LiteSpeed, PHP, Linux, WordPress).\n" .
            "Sua missão é criar um GUIA COMPLETO, DIDÁTICO E PASSO A PASSO para sanar as seguintes falhas que NÃO PODEM ser corrigidas por plugin, pois exigem configurações no servidor de hospedagem ou ações manuais do administrador.\n\n" .
            "REQUISITOS DO GUIA:\n" .
            "1. Organize o guia por categorias claras (ex: Configurações do Apache / .htaccess, Configurações do Nginx, Diretivas do php.ini / wp-config.php, Gestão de Permissões e Usuários Linux/WP).\n" .
            "2. Para cada problema listado, inclua:\n" .
            "   - **Explicação do Risco**: Por que essa falha é perigosa.\n" .
            "   - **Passo a Passo de Correção**: Comandos exatos de terminal, blocos de código prontos para copiar e colar para .htaccess / Nginx / wp-config.php / php.ini.\n" .
            "   - **Como Testar**: Como o administrador pode verificar se a correção funcionou.\n" .
            "3. FORMATAÇÃO E DESIGN (DARK THEME):\n" .
            "   - Formate a resposta em HTML limpo e elegante (usando <h3>, <h4>, <p>, <ul>, <li>, <pre><code>, <div> com a classe 'alert' para avisos).\n" .
            "   - NUNCA use contêineres de fundo branco ou claro (background: #fff ou #ffffff). O painel usa TEMA ESCURO.\n" .
            "   - Para destaques de alerta, use a estrutura: <div class='alert'><strong>Atenção:</strong> ...</div>\n" .
            "4. Responda APENAS com o conteúdo HTML bem formatado (sem wrappers ```html no início/fim) pronto para ser exibido diretamente em uma tela web de relatório.";

        $userPrompt = "Gerar Guia de Remediação do Servidor para o website: {$siteUrl}\n\n" .
            "LISTA DE PROBLEMAS DO SERVIDOR / AÇÕES MANUAIS PARA RESOLVER:\n" .
            $issuesSummary;

        return $this->callOpenCodeApi($systemPrompt, $userPrompt, false, 120);
    }
}
