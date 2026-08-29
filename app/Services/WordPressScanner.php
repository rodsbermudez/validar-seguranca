<?php

namespace App\Services;

class WordPressScanner
{
    private string $baseUrl;
    private int $timeout = 7;

    public function __construct(string $url)
    {
        $this->baseUrl = rtrim($url, '/');
    }

    public function runFullScan(?array $websiteData = null): array
    {
        $infraResults        = $this->checkInfrastructure();
        $fileExposureResults = $this->checkFileExposures();
        $enumerationResults  = $this->checkEnumerationAndInterfaces();
        $fingerprintResults  = $this->checkFingerprint();

        $internalAuditResults = null;
        if (!empty($websiteData['is_connected']) && !empty($websiteData['agent_token'])) {
            $internalAuditResults = $this->runInternalAgentScan($websiteData['agent_token']);
        }

        $allChecks = array_merge(
            $infraResults['checks'],
            $fileExposureResults['checks'],
            $enumerationResults['checks'],
            $fingerprintResults['checks']
        );

        if ($internalAuditResults !== null && isset($internalAuditResults['checks'])) {
            $allChecks = array_merge($allChecks, $internalAuditResults['checks']);
        }

        $score = $this->calculateScore($allChecks);

        $categories = [
            'infrastructure' => $infraResults,
            'file_exposure'  => $fileExposureResults,
            'enumeration'    => $enumerationResults,
            'fingerprint'    => $fingerprintResults,
        ];

        if ($internalAuditResults !== null) {
            $categories['internal_agent'] = $internalAuditResults;
        }

        return [
            'target_url'   => $this->baseUrl,
            'scanned_at'   => date('Y-m-d H:i:s'),
            'is_hybrid'    => $internalAuditResults !== null,
            'score'        => $score['score'],
            'grade'        => $score['grade'],
            'summary'      => [
                'total_checks' => count($allChecks),
                'passed'       => count(array_filter($allChecks, fn($c) => $c['status'] === 'PASS')),
                'failed'       => count(array_filter($allChecks, fn($c) => $c['status'] === 'FAIL')),
                'warnings'     => count(array_filter($allChecks, fn($c) => $c['status'] === 'WARN')),
            ],
            'categories'   => $categories,
        ];
    }

    /**
     * Call WordPress Agent Plugin Internal REST API
     */
    private function runInternalAgentScan(string $agentToken): ?array
    {
        $res = $this->request(
            '/wp-json/validar-seguranca/v1/internal-audit',
            'POST',
            [
                'Content-Type: application/json',
                'X-Validar-Seguranca-Token: ' . $agentToken,
            ]
        );

        if ($res['http_code'] !== 200 || empty($res['body'])) {
            return [
                'category_name' => 'Auditoria Interna do Agente WordPress',
                'status_error'  => 'Não foi possível se comunicar com a REST API do plugin agente (HTTP ' . $res['http_code'] . ').',
                'checks'        => [],
            ];
        }

        $json = json_decode($res['body'], true);
        if (empty($json['success']) || empty($json['data'])) {
            return [
                'category_name' => 'Auditoria Interna do Agente WordPress',
                'status_error'  => 'Resposta inválida recebida do agente WordPress.',
                'checks'        => [],
            ];
        }

        $data = $json['data'];
        $checks = [];

        // 1. Updates Check
        $updates = $data['updates_and_plugins'] ?? [];
        $pendingCore = $updates['pending_core_updates'] ?? 0;
        $pendingPlugins = $updates['pending_plugin_updates'] ?? 0;
        $pendingThemes = $updates['pending_theme_updates'] ?? 0;
        $inactivePlugins = $updates['inactive_plugins'] ?? 0;

        $hasPending = ($pendingCore + $pendingPlugins + $pendingThemes) > 0;
        $checks[] = [
            'id'          => 'agent_pending_updates',
            'name'        => 'Atualizações do WordPress e Plugins (Interno)',
            'description' => 'Verifica se há atualizações pendentes do Core, Plugins ou Temas.',
            'status'      => $hasPending ? 'FAIL' : 'PASS',
            'severity'    => 'HIGH',
            'details'     => $hasPending 
                ? "Pendências encontradas: {$pendingCore} Core, {$pendingPlugins} Plugins, {$pendingThemes} Temas." 
                : "Sistema totalmente atualizado!",
        ];

        $checks[] = [
            'id'          => 'agent_inactive_plugins',
            'name'        => 'Plugins Inativos Abandonados',
            'description' => 'Plugins inativos continuam no servidor e podem ter vulnerabilidades exploráveis.',
            'status'      => $inactivePlugins > 0 ? 'WARN' : 'PASS',
            'severity'    => 'LOW',
            'details'     => $inactivePlugins > 0 
                ? "Existem {$inactivePlugins} plugin(s) inativo(s) instalados. Recomenda-se remover." 
                : "Nenhum plugin inativo instalado.",
        ];

        // 2. Users Check
        $users = $data['users_security'] ?? [];
        $hasDefaultAdmin = $users['has_default_admin'] ?? false;
        $totalAdmins = $users['total_admins'] ?? 1;

        $checks[] = [
            'id'          => 'agent_default_admin',
            'name'        => 'Usuário Admin Padrão ("admin")',
            'description' => 'Verifica se existe uma conta ativa com nome de usuário "admin".',
            'status'      => $hasDefaultAdmin ? 'FAIL' : 'PASS',
            'severity'    => 'CRITICAL',
            'details'     => $hasDefaultAdmin 
                ? "ALERTA CRÍTICO: Usuário 'admin' existe! Alvo primário para ataques de força bruta." 
                : "Nenhum usuário 'admin' padrão encontrado.",
        ];

        $checks[] = [
            'id'          => 'agent_total_admins',
            'name'        => 'Quantidade de Administradores',
            'description' => 'Analisa o número de contas com privilégio de Administrador.',
            'status'      => $totalAdmins > 3 ? 'WARN' : 'PASS',
            'severity'    => 'LOW',
            'details'     => "Encontrados {$totalAdmins} usuário(s) com função Administrador (" . implode(', ', $users['admin_usernames'] ?? []) . ").",
        ];

        // 3. Hardening Check
        $hardening = $data['hardening'] ?? [];
        $wpDebug = $hardening['wp_debug'] ?? false;
        $wpDebugDisplay = $hardening['wp_debug_display'] ?? false;
        $disallowFileEdit = $hardening['disallow_file_edit'] ?? false;
        $isDefaultPrefix = $hardening['is_default_db_prefix'] ?? false;

        $checks[] = [
            'id'          => 'agent_wp_debug',
            'name'        => 'Modo de Depuração (WP_DEBUG)',
            'description' => 'Verifica se o modo de debug do WordPress está ativo em produção.',
            'status'      => ($wpDebug && $wpDebugDisplay) ? 'FAIL' : ($wpDebug ? 'WARN' : 'PASS'),
            'severity'    => ($wpDebug && $wpDebugDisplay) ? 'HIGH' : 'LOW',
            'details'     => ($wpDebug && $wpDebugDisplay) 
                ? "WP_DEBUG e WP_DEBUG_DISPLAY estão ATIVOS! Erros de código vazam para os visitantes." 
                : ($wpDebug ? "WP_DEBUG ativo (exibição de erros ocultada)." : "WP_DEBUG desativado."),
        ];

        $checks[] = [
            'id'          => 'agent_disallow_file_edit',
            'name'        => 'Edição de Arquivos no WP Admin (DISALLOW_FILE_EDIT)',
            'description' => 'Verifica se o editor de código embutido do painel está desativado.',
            'status'      => $disallowFileEdit ? 'PASS' : 'WARN',
            'severity'    => 'MEDIUM',
            'details'     => $disallowFileEdit 
                ? "Editor de arquivos desativado com segurança no wp-config.php." 
                : "Editor de arquivos ATIVO no painel. Se um admin for invadido, scripts PHP podem ser injetados.",
        ];

        $checks[] = [
            'id'          => 'agent_db_prefix',
            'name'        => 'Prefixo das Tabelas do Banco de Dados',
            'description' => 'Verifica se o prefixo padrão "wp_" está sendo utilizado.',
            'status'      => $isDefaultPrefix ? 'WARN' : 'PASS',
            'severity'    => 'LOW',
            'details'     => $isDefaultPrefix 
                ? "Tabelas utilizam o prefixo padrão 'wp_'. Recomendado alterar para dificultar SQL Injection." 
                : "Prefixo das tabelas é personalizado ('{$hardening['db_prefix']}').",
        ];

        // 4. Moderation & Registration Check
        $mod = $data['moderation_settings'] ?? [];
        $canRegister = $mod['users_can_register'] ?? false;
        $commentsOpen = $mod['comments_open'] ?? true;
        $commentMod = $mod['comment_moderation'] ?? false;

        $checks[] = [
            'id'          => 'agent_user_registration',
            'name'        => 'Cadastro de Usuários Aberto',
            'description' => 'Verifica se o registro de novos membros está aberto ao público.',
            'status'      => $canRegister ? 'WARN' : 'PASS',
            'severity'    => 'MEDIUM',
            'details'     => $canRegister 
                ? "Registro de usuários ABERTO! Função padrão atribuída: '{$mod['default_role']}'." 
                : "Registro de usuários fechado.",
        ];

        $checks[] = [
            'id'          => 'agent_comments_moderation',
            'name'        => 'Moderação de Comentários',
            'description' => 'Verifica se os comentários precisam de aprovação antes de serem publicados.',
            'status'      => ($commentsOpen && !$commentMod) ? 'FAIL' : 'PASS',
            'severity'    => 'HIGH',
            'details'     => ($commentsOpen && !$commentMod) 
                ? "Comentários abertos SEM moderação! Vulnerável a Spam automatizado e links maliciosos." 
                : "Comentários sob moderação ou fechados.",
        ];

        return [
            'category_name' => 'Auditoria Interna do Agente WordPress',
            'raw_data'      => $data,
            'checks'        => $checks,
        ];
    }

    /**
     * Helper to make cURL HTTP requests
     */
    private function request(string $path = '', string $method = 'GET', array $headers = [], ?string $body = null): array
    {
        $url = $this->baseUrl . $path;
        $ch  = curl_init();

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_USERAGENT, 'WP-Security-Scanner/1.0');

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($body !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            }
        }

        if (!empty($headers)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }

        $response   = curl_exec($ch);
        $httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $effUrl     = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
        $error      = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            return [
                'http_code' => 0,
                'headers'   => [],
                'body'      => '',
                'effective_url' => $effUrl,
                'error'     => $error,
            ];
        }

        $rawHeaders = substr($response, 0, $headerSize);
        $bodyContent = substr($response, $headerSize);

        $parsedHeaders = [];
        foreach (explode("\r\n", $rawHeaders) as $line) {
            if (strpos($line, ':') !== false) {
                list($key, $val) = explode(':', $line, 2);
                $parsedHeaders[strtolower(trim($key))] = trim($val);
            }
        }

        return [
            'http_code'     => $httpCode,
            'headers'       => $parsedHeaders,
            'body'          => $bodyContent,
            'effective_url' => $effUrl,
            'error'         => null,
        ];
    }

    /**
     * 2.1. Infraestrutura & Security Headers
     */
    private function checkInfrastructure(): array
    {
        $checks = [];

        // Check HTTPS
        $isHttps = str_starts_with(strtolower($this->baseUrl), 'https://');
        $checks[] = [
            'id'          => 'https_enforced',
            'name'        => 'Uso de HTTPS / SSL',
            'description' => 'Verifica se o site utiliza protocolo seguro HTTPS.',
            'status'      => $isHttps ? 'PASS' : 'WARN',
            'severity'    => 'MEDIUM',
            'details'     => $isHttps ? 'O site utiliza HTTPS.' : 'O site não está utilizando HTTPS.',
        ];

        // Fetch home page for headers
        $res = $this->request('/');
        $headers = $res['headers'];

        // Security Headers Check
        $securityHeaders = [
            'strict-transport-security' => ['name' => 'Strict-Transport-Security (HSTS)', 'severity' => 'MEDIUM'],
            'x-frame-options'           => ['name' => 'X-Frame-Options (Anti-Clickjacking)', 'severity' => 'MEDIUM'],
            'x-content-type-options'    => ['name' => 'X-Content-Type-Options (MIME Sniffing)', 'severity' => 'LOW'],
            'content-security-policy'   => ['name' => 'Content-Security-Policy (CSP)', 'severity' => 'HIGH'],
        ];

        foreach ($securityHeaders as $headerKey => $meta) {
            $present = isset($headers[$headerKey]);
            $checks[] = [
                'id'          => 'header_' . str_replace('-', '_', $headerKey),
                'name'        => 'Cabeçalho: ' . $meta['name'],
                'description' => 'Verifica a presença do cabeçalho de segurança HTTP.',
                'status'      => $present ? 'PASS' : 'FAIL',
                'severity'    => $meta['severity'],
                'details'     => $present ? 'Presente com valor: ' . $headers[$headerKey] : 'Cabeçalho de segurança não configurado no servidor.',
            ];
        }

        return [
            'category_name' => 'Infraestrutura & Cabeçalhos HTTP',
            'checks'        => $checks,
        ];
    }

    /**
     * 2.2. Exposição de Arquivos e Diretórios
     */
    private function checkFileExposures(): array
    {
        $checks = [];

        // Directory listing test on wp-content/uploads/
        $resUploads = $this->request('/wp-content/uploads/');
        $directoryListing = ($resUploads['http_code'] === 200 && (
            str_contains(strtolower($resUploads['body']), 'index of') ||
            str_contains(strtolower($resUploads['body']), 'parent directory')
        ));
        $checks[] = [
            'id'          => 'dir_listing_uploads',
            'name'        => 'Listagem de Diretórios (/wp-content/uploads/)',
            'description' => 'Verifica se a navegação direta de arquivos está aberta.',
            'status'      => $directoryListing ? 'FAIL' : 'PASS',
            'severity'    => 'HIGH',
            'details'     => $directoryListing ? 'A listagem de diretório está ATIVA no servidor!' : 'Listagem de diretório bloqueada (HTTP ' . $resUploads['http_code'] . ').',
        ];

        // Directory listing test on wp-includes/
        $resIncludes = $this->request('/wp-includes/');
        $directoryListingInc = ($resIncludes['http_code'] === 200 && (
            str_contains(strtolower($resIncludes['body']), 'index of') ||
            str_contains(strtolower($resIncludes['body']), 'parent directory')
        ));
        $checks[] = [
            'id'          => 'dir_listing_includes',
            'name'        => 'Listagem de Diretórios (/wp-includes/)',
            'description' => 'Verifica se a estrutura do core está exposta para navegação.',
            'status'      => $directoryListingInc ? 'FAIL' : 'PASS',
            'severity'    => 'HIGH',
            'details'     => $directoryListingInc ? 'A listagem de diretório está ATIVA no /wp-includes/!' : 'Listagem de diretório bloqueada (HTTP ' . $resIncludes['http_code'] . ').',
        ];

        // Sensitive config & log files
        $sensitiveFiles = [
            '/wp-config.php.bak' => ['name' => 'Backup wp-config.php.bak', 'severity' => 'CRITICAL'],
            '/wp-config.txt'     => ['name' => 'Backup wp-config.txt', 'severity' => 'CRITICAL'],
            '/.env'              => ['name' => 'Arquivo de Ambiente .env', 'severity' => 'CRITICAL'],
            '/wp-content/debug.log' => ['name' => 'Log de Depuração debug.log', 'severity' => 'HIGH'],
            '/wp-content/error_log' => ['name' => 'Log de Erros error_log', 'severity' => 'HIGH'],
        ];

        foreach ($sensitiveFiles as $path => $meta) {
            $res = $this->request($path);
            $exposed = ($res['http_code'] === 200 && strlen(trim($res['body'])) > 0);
            $checks[] = [
                'id'          => 'file_' . preg_replace('/[^a-zA-Z0-9]/', '_', ltrim($path, '/')),
                'name'        => 'Arquivo Sensível: ' . $meta['name'],
                'description' => "Verifica se o caminho {$path} está acessível via HTTP.",
                'status'      => $exposed ? 'FAIL' : 'PASS',
                'severity'    => $meta['severity'],
                'details'     => $exposed ? "ATENÇÃO CRÍTICA: Arquivo exposto publicamente (HTTP 200)!" : "Protegido/Inexistente (HTTP " . $res['http_code'] . ").",
            ];
        }

        // Informational files
        $infoFiles = [
            '/readme.html' => 'Arquivo readme.html (Vazamento de versão)',
            '/license.txt' => 'Arquivo license.txt',
        ];

        foreach ($infoFiles as $path => $name) {
            $res = $this->request($path);
            $exposed = ($res['http_code'] === 200);
            $checks[] = [
                'id'          => 'info_' . preg_replace('/[^a-zA-Z0-9]/', '_', ltrim($path, '/')),
                'name'        => $name,
                'description' => "Verifica se o arquivo de informação {$path} foi removido.",
                'status'      => $exposed ? 'WARN' : 'PASS',
                'severity'    => 'LOW',
                'details'     => $exposed ? "Arquivo padrão encontrado (HTTP 200). É recomendado remover." : "Arquivo inacessível/removido (HTTP " . $res['http_code'] . ").",
            ];
        }

        return [
            'category_name' => 'Exposição de Arquivos & Diretórios',
            'checks'        => $checks,
        ];
    }

    /**
     * 2.3. Enumeração & Força Bruta
     */
    private function checkEnumerationAndInterfaces(): array
    {
        $checks = [];

        // 1. REST API User Enumeration
        $resWpJson = $this->request('/wp-json/wp/v2/users');
        $usersExposed = false;
        $usersList = [];

        if ($resWpJson['http_code'] === 200) {
            $jsonUsers = json_decode($resWpJson['body'], true);
            if (is_array($jsonUsers) && !empty($jsonUsers)) {
                $usersExposed = true;
                foreach ($jsonUsers as $u) {
                    if (isset($u['slug'])) {
                        $usersList[] = $u['slug'];
                    }
                }
            }
        }

        $checks[] = [
            'id'          => 'enum_wp_json_users',
            'name'        => 'Enumeração de Usuários (WP REST API)',
            'description' => 'Verifica se a rota /wp-json/wp/v2/users expõe logins de autores.',
            'status'      => $usersExposed ? 'FAIL' : 'PASS',
            'severity'    => 'HIGH',
            'details'     => $usersExposed 
                ? 'Usuários vazados via REST API: ' . implode(', ', $usersList) 
                : 'Interface REST API de usuários protegida ou desativada.',
        ];

        // 2. Author Archive Redirection
        $resAuthor = $this->request('/?author=1');
        $authorRedirectExposed = false;
        $authorSlug = '';

        $httpCode = $resAuthor['http_code'];
        $location = $resAuthor['headers']['location'] ?? '';

        if ($httpCode === 301 || $httpCode === 302) {
            if (str_contains($location, '/author/')) {
                $authorRedirectExposed = true;
                preg_match('/\/author\/([^\/]+)/', $location, $m);
                $authorSlug = $m[1] ?? $location;
            }
        }

        // Check if HTTP response is a clean 301/302 redirect to Home (/)
        $redirectedToHome = false;
        if (($httpCode === 301 || $httpCode === 302) && !empty($location)) {
            $targetPath = parse_url($location, PHP_URL_PATH) ?? '/';
            $basePath = parse_url($this->baseUrl, PHP_URL_PATH) ?? '/';
            if ($targetPath === '/' || $targetPath === '' || $targetPath === $basePath || $location === $this->baseUrl) {
                $redirectedToHome = true;
            }
        }

        if ($authorRedirectExposed) {
            $authorStatus  = 'FAIL';
            $authorDetails = 'Nome de usuário exposto via redirecionamento: ' . $authorSlug;
        } elseif ($redirectedToHome) {
            $authorStatus  = 'PASS';
            $authorDetails = 'Requisição de autor redirecionada com sucesso para a Página Inicial (/).';
        } else {
            // Does not redirect to Home (returns 404, 403, 200 blank, etc. staying on /?author=1)
            $authorStatus  = 'WARN';
            $authorDetails = 'A requisição para /?author=1 não é redirecionada para a Página Inicial (retorna HTTP ' . $httpCode . ' na própria URL). Recomendado aplicar o redirecionamento 301 automático para a Home (/).';
        }

        $checks[] = [
            'id'          => 'enum_author_query',
            'name'        => 'Enumeração via Query Author (/?author=1)',
            'description' => 'Verifica se requisições para /?author=1 revelam nomes de usuários ou se aplicam o redirecionamento automático para a Home / erro 404.',
            'status'      => $authorStatus,
            'severity'    => 'MEDIUM',
            'details'     => $authorDetails,
        ];

        // 2b. User Enumeration via XML Sitemap (/wp-sitemap-users-1.xml)
        $resSitemap = $this->request('/wp-sitemap-users-1.xml');
        $sitemapExposed = false;
        $sitemapUsers = [];

        if ($resSitemap['http_code'] === 200) {
            $body = $resSitemap['body'];
            if (str_contains($body, '<loc>') || str_contains($body, 'urlset')) {
                // Extract author usernames from <loc>https://.../author/username/</loc>
                if (preg_match_all('/\/author\/([^\/<\?&]+)/i', $body, $sMatches)) {
                    $sitemapUsers = array_unique($sMatches[1]);
                    $sitemapExposed = !empty($sitemapUsers);
                } elseif (str_contains($body, 'users') || str_contains($body, 'author')) {
                    $sitemapExposed = true;
                }
            }
        }

        $checks[] = [
            'id'          => 'enum_sitemap_users',
            'name'        => 'Enumeração via Sitemap XML (/wp-sitemap-users-1.xml)',
            'description' => 'Verifica se o sitemap nativo do WordPress expõe a listagem de autores e usernames.',
            'status'      => $sitemapExposed ? 'FAIL' : 'PASS',
            'severity'    => 'HIGH',
            'details'     => $sitemapExposed 
                ? 'Nomes de usuário expostos no Sitemap XML: ' . (!empty($sitemapUsers) ? implode(', ', $sitemapUsers) : 'Lista de usuários acessível')
                : 'Sitemap de usuários desativado ou protegido (HTTP ' . $resSitemap['http_code'] . ').',
        ];

        // 3. XML-RPC interface
        $xmlBody = '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName><params></params></methodCall>';
        $resXmlRpc = $this->request('/xmlrpc.php', 'POST', ['Content-Type: text/xml'], $xmlBody);
        $xmlrpcActive = ($resXmlRpc['http_code'] === 200 && str_contains(strtolower($resXmlRpc['body']), 'methodresponse'));

        $checks[] = [
            'id'          => 'xmlrpc_enabled',
            'name'        => 'Interface XML-RPC (xmlrpc.php)',
            'description' => 'Verifica se a API XML-RPC está ativa (alvo comum de força bruta e amplification DDoS).',
            'status'      => $xmlrpcActive ? 'FAIL' : 'PASS',
            'severity'    => 'HIGH',
            'details'     => $xmlrpcActive 
                ? 'XML-RPC está ATIVO e aceitando métodos remotamente!' 
                : 'XML-RPC está desativado ou bloqueado (HTTP ' . $resXmlRpc['http_code'] . ').',
        ];

        // 4. wp-login.php Protection
        $resLogin = $this->request('/wp-login.php');
        $loginStandardExposed = ($resLogin['http_code'] === 200 && str_contains(strtolower($resLogin['body']), 'loginform'));

        $checks[] = [
            'id'          => 'wp_login_exposed',
            'name'        => 'Página de Login Padrão (/wp-login.php)',
            'description' => 'Verifica se a página /wp-login.php está exposta sem proteção por IP ou alteração de slug.',
            'status'      => $loginStandardExposed ? 'WARN' : 'PASS',
            'severity'    => 'LOW',
            'details'     => $loginStandardExposed 
                ? 'Formulário de login padrão visível publicamente.' 
                : 'Página de login alterada ou protegida (HTTP ' . $resLogin['http_code'] . ').',
        ];

        return [
            'category_name' => 'Enumeração de Usuários & Interfaces',
            'checks'        => $checks,
        ];
    }

    /**
     * 2.4. Identificação de Versões (Fingerprinting)
     */
    private function checkFingerprint(): array
    {
        $checks = [];

        // Check HTML Meta Generator tag
        $resHome = $this->request('/');
        $html = $resHome['body'];

        $wpVersion = null;
        if (preg_match('/<meta\s+name=["\']generator["\']\s+content=["\']WordPress\s+([\d\.]+)["\']/i', $html, $matches)) {
            $wpVersion = $matches[1];
        }

        $checks[] = [
            'id'          => 'fingerprint_wp_version_meta',
            'name'        => 'Versão do WordPress em Meta Tag',
            'description' => 'Verifica se a versão exata do WordPress está exposta na tag <meta name="generator">.',
            'status'      => $wpVersion ? 'FAIL' : 'PASS',
            'severity'    => 'MEDIUM',
            'details'     => $wpVersion 
                ? "Versão exata vazada no HTML: WordPress {$wpVersion}" 
                : "Tag generator de versão oculta ou removida.",
        ];

        // Detect Plugins via HTML source code links/scripts
        $detectedPlugins = [];
        if (preg_match_all('/\/wp-content\/plugins\/([a-zA-Z0-9\-_]+)\//i', $html, $matches)) {
            $detectedPlugins = array_unique($matches[1]);
        }

        $pluginDetails = [];
        $versionsExposed = false;

        // Check if any asset URL contains version query parameters for plugins
        if (preg_match('/\/wp-content\/plugins\/[^\'\"]+[\?&]ver=/i', $html)) {
            $versionsExposed = true;
        }

        foreach ($detectedPlugins as $pluginSlug) {
            $resPluginReadme = $this->request("/wp-content/plugins/{$pluginSlug}/readme.txt");
            $pluginVer = null;
            if ($resPluginReadme['http_code'] === 200) {
                if (preg_match('/Stable tag:\s*([0-9\.]+)/i', $resPluginReadme['body'], $vMatch)) {
                    $pluginVer = $vMatch[1];
                    $versionsExposed = true;
                }
            }
            $pluginDetails[] = $pluginSlug . ($pluginVer ? " (v{$pluginVer})" : '');
        }

        $checks[] = [
            'id'          => 'fingerprint_plugins_detected',
            'name'        => 'Enumeração de Plugins Ativos',
            'description' => 'Identifica se os plugins instalados expõem suas versões publicamente via URLs de assets ou arquivos readme.txt.',
            'status'      => $versionsExposed ? 'WARN' : 'PASS',
            'severity'    => 'LOW',
            'details'     => $versionsExposed 
                ? 'Plugins com versões expostas (via readme.txt ou parâmetro ?ver=): ' . implode(', ', $pluginDetails) 
                : (!empty($detectedPlugins) 
                    ? 'Plugins presentes no HTML, mas suas versões exatas e arquivos readme.txt estão ocultos/protegidos.' 
                    : 'Nenhum plugin identificado publicamente no código-fonte.'),
        ];

        return [
            'category_name' => 'Fingerprinting & Detecção de Componentes',
            'checks'        => $checks,
        ];
    }

    /**
     * Calculate Security Score (0 to 100) and Letter Grade (A-F)
     */
    private function calculateScore(array $allChecks): array
    {
        if (empty($allChecks)) {
            return ['score' => 0, 'grade' => 'F'];
        }

        $weights = [
            'CRITICAL' => 10,
            'HIGH'     => 7,
            'MEDIUM'   => 4,
            'LOW'      => 2,
        ];

        $totalPossiblePoints = 0;
        $earnedPoints        = 0;

        foreach ($allChecks as $check) {
            $sev    = strtoupper($check['severity'] ?? 'LOW');
            $weight = $weights[$sev] ?? 2;

            $totalPossiblePoints += $weight;

            if (($check['status'] ?? '') === 'PASS') {
                $earnedPoints += $weight;
            } elseif (($check['status'] ?? '') === 'WARN') {
                $earnedPoints += ($weight / 2);
            }
        }

        $finalScore = $totalPossiblePoints > 0 
            ? round(($earnedPoints / $totalPossiblePoints) * 100) 
            : 0;

        if ($finalScore >= 90) {
            $grade = 'A';
        } elseif ($finalScore >= 75) {
            $grade = 'B';
        } elseif ($finalScore >= 60) {
            $grade = 'C';
        } elseif ($finalScore >= 40) {
            $grade = 'D';
        } else {
            $grade = 'F';
        }

        return [
            'score' => (int) $finalScore,
            'grade' => $grade,
        ];
    }
}
