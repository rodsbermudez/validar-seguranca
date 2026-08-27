<?php

namespace App\Services;

class WordPressScanner
{
    private string $baseUrl;
    private int $timeout = 5;

    public function __construct(string $url)
    {
        $this->baseUrl = rtrim($url, '/');
    }

    public function runFullScan(): array
    {
        $infraResults        = $this->checkInfrastructure();
        $fileExposureResults = $this->checkFileExposures();
        $enumerationResults  = $this->checkEnumerationAndInterfaces();
        $fingerprintResults  = $this->checkFingerprint();

        $allChecks = array_merge(
            $infraResults['checks'],
            $fileExposureResults['checks'],
            $enumerationResults['checks'],
            $fingerprintResults['checks']
        );

        $score = $this->calculateScore($allChecks);

        return [
            'target_url'   => $this->baseUrl,
            'scanned_at'   => date('Y-m-d H:i:s'),
            'score'        => $score['score'],
            'grade'        => $score['grade'],
            'summary'      => [
                'total_checks' => count($allChecks),
                'passed'       => count(array_filter($allChecks, fn($c) => $c['status'] === 'PASS')),
                'failed'       => count(array_filter($allChecks, fn($c) => $c['status'] === 'FAIL')),
                'warnings'     => count(array_filter($allChecks, fn($c) => $c['status'] === 'WARN')),
            ],
            'categories'   => [
                'infrastructure' => $infraResults,
                'file_exposure'  => $fileExposureResults,
                'enumeration'    => $enumerationResults,
                'fingerprint'    => $fingerprintResults,
            ],
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

        if ($resAuthor['http_code'] === 301 || $resAuthor['http_code'] === 302) {
            $location = $resAuthor['headers']['location'] ?? '';
            if (str_contains($location, '/author/')) {
                $authorRedirectExposed = true;
                preg_match('/\/author\/([^\/]+)/', $location, $m);
                $authorSlug = $m[1] ?? $location;
            }
        }

        $checks[] = [
            'id'          => 'enum_author_query',
            'name'        => 'Enumeração via Query Author (/?author=1)',
            'description' => 'Verifica se requisições para /?author=1 revelam nomes de usuários.',
            'status'      => $authorRedirectExposed ? 'FAIL' : 'PASS',
            'severity'    => 'MEDIUM',
            'details'     => $authorRedirectExposed 
                ? 'Nome de usuário exposto via redirecionamento: ' . $authorSlug 
                : 'Redirecionamento de autor não expõe dados.',
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
        foreach ($detectedPlugins as $pluginSlug) {
            $resPluginReadme = $this->request("/wp-content/plugins/{$pluginSlug}/readme.txt");
            $pluginVer = null;
            if ($resPluginReadme['http_code'] === 200) {
                if (preg_match('/Stable tag:\s*([0-9\.]+)/i', $resPluginReadme['body'], $vMatch)) {
                    $pluginVer = $vMatch[1];
                }
            }
            $pluginDetails[] = $pluginSlug . ($pluginVer ? " (v{$pluginVer})" : '');
        }

        $checks[] = [
            'id'          => 'fingerprint_plugins_detected',
            'name'        => 'Enumeração de Plugins Ativos',
            'description' => 'Identifica plugins instalados a partir das URLs de assets no HTML.',
            'status'      => !empty($detectedPlugins) ? 'WARN' : 'PASS',
            'severity'    => 'LOW',
            'details'     => !empty($detectedPlugins) 
                ? 'Plugins detectados: ' . implode(', ', $pluginDetails) 
                : 'Nenhum plugin identificado publicamente no código-fonte.',
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
        $maxPoints   = 100;
        $deductions  = 0;

        $weights = [
            'CRITICAL' => 25,
            'HIGH'     => 15,
            'MEDIUM'   => 8,
            'LOW'      => 3,
        ];

        foreach ($allChecks as $check) {
            if ($check['status'] === 'FAIL') {
                $sev = $check['severity'] ?? 'LOW';
                $deductions += $weights[$sev] ?? 5;
            } elseif ($check['status'] === 'WARN') {
                $sev = $check['severity'] ?? 'LOW';
                $deductions += ceil(($weights[$sev] ?? 5) / 2);
            }
        }

        $finalScore = max(0, $maxPoints - $deductions);

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
