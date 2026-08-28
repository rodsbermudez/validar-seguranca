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
        $this->apiUrl = env('OPENCODE_API_URL') ?: 'https://api.opencode.ai/v1/chat/completions';
        $this->model  = env('OPENCODE_MODEL') ?: 'Kimi K2.7 Code';
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

        $response = $this->callOpenCodeApi($systemPrompt, $userPrompt, true, 35);
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

        $systemPrompt = "Você é um Desenvolvedor WordPress Sênior e Especialista em Segurança.\n" .
            "Sua tarefa é compor um Plugin WordPress completo, robusto, limpo e profissional chamado 'Validar Segurança - Correções de Segurança'.\n\n" .
            "REQUISITOS DO PLUGIN:\n" .
            "1. Comece OBRIGATORIAMENTE com o cabeçalho padrão de Plugin do WordPress (Plugin Name: Validar Segurança Fix - {$siteHost}, Description, Version: 1.0.0, Author: Validar Segurança).\n" .
            "2. Verifique 'if (!defined(\"ABSPATH\")) exit;' no topo por segurança.\n" .
            "3. Crie uma classe PHP bem estruturada (ex: 'VS_Remediation_Fix_{$siteHostClean}') para agrupar todas as correções de forma limpa.\n" .
            "4. ESTRUTURA DE MENU NO WP ADMIN: Crie a tela do plugin como um SUBMENU sob o menu pai 'WP Patropi' (slug pai: 'wp-patropi'). O submenu deve se chamar 'Segurança' (slug: 'wp-patropi-seguranca'). No hook 'admin_menu', verifique se o menu pai 'wp-patropi' existe ou adicione-o via add_menu_page('WP Patropi', 'WP Patropi', 'manage_options', 'wp-patropi', array(\$this, 'render_admin_page'), 'dashicons-shield', 80) e em seguida adicione o submenu via add_submenu_page('wp-patropi', 'Segurança', 'Segurança', 'manage_options', 'wp-patropi-seguranca', array(\$this, 'render_admin_page')). A página exibirá visualmente a lista de todas as correções de segurança ativas no site.\n" .
            "5. Aplique cada uma das correções fornecidas utilizando hooks apropriados (add_action, add_filter, checagens de constante como 'if (!defined(...)) define(...)', etc.).\n" .
            "6. GARANTA que o código seja 100% livre de erros de sintaxe PHP. NÃO utilize tags de abertura <?php adicionais dentro de funções ou trechos mal formatados.\n" .
            "7. Responda APENAS com o código PHP completo do plugin (começando com '<?php'). NÃO adicione textos de introdução ou cercas markdown de blocos de código.";

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
     * Send cURL request to OpenCode / OpenAI Compatible API
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

        $payload = [
            'model' => $this->model,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt],
            ],
            'temperature' => 1.0,
        ];

        if ($expectJson) {
            $payload['response_format'] = ['type' => 'json_object'];
        }

        $ch = curl_init($this->apiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            throw new \RuntimeException("Erro cURL ao conectar à API OpenCode: " . $curlError);
        }

        if ($httpCode >= 400) {
            throw new \RuntimeException("API OpenCode respondeu com erro (HTTP {$httpCode}): " . $response);
        }

        $json = json_decode($response, true);
        if (isset($json['choices'][0]['message']['content'])) {
            return trim($json['choices'][0]['message']['content']);
        }

        throw new \RuntimeException("Resposta inesperada da API OpenCode: " . $response);
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

        $decoded = json_decode($cleanJson, true);
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
                'ai_notes'              => "Resposta bruta da IA não pode ser processada como JSON válido.",
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

        return $this->callOpenCodeApi($systemPrompt, $userPrompt, false);
    }
}
