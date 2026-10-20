<?php

namespace App\Services;

use App\Models\PlatformErrorLogModel;
use App\Models\WebsiteModel;
use App\Models\UserModel;

class PlatformErrorLogger
{
    /**
     * Log a platform error or connection failure.
     */
    public static function log(array $data): ?int
    {
        try {
            $logModel = new PlatformErrorLogModel();

            $websiteId = !empty($data['website_id']) ? (int) $data['website_id'] : null;
            $userId    = !empty($data['user_id']) ? (int) $data['user_id'] : null;

            $websiteName = $data['website_name'] ?? null;
            $websiteUrl  = $data['website_url'] ?? null;
            $userEmail   = $data['user_email'] ?? null;

            // Enrich website information if missing
            if ($websiteId && (empty($websiteName) || empty($websiteUrl) || empty($userId))) {
                try {
                    $websiteModel = new WebsiteModel();
                    $site = $websiteModel->find($websiteId);
                    if ($site) {
                        $websiteName = $websiteName ?: ($site['name'] ?? null);
                        $websiteUrl  = $websiteUrl ?: ($site['url'] ?? null);
                        if (empty($userId) && !empty($site['user_id'])) {
                            $userId = (int) $site['user_id'];
                        }
                    }
                } catch (\Throwable $e) {
                    // Ignore DB enrich errors
                }
            }

            // Enrich user email if missing
            if ($userId && empty($userEmail)) {
                try {
                    $userModel = new UserModel();
                    $u = $userModel->find($userId);
                    if ($u) {
                        $userEmail = $u['email'] ?? null;
                    }
                } catch (\Throwable $e) {
                    // Ignore DB enrich errors
                }
            }

            $endpoint     = $data['endpoint'] ?? null;
            $httpMethod   = strtoupper($data['http_method'] ?? 'GET');
            $httpStatus   = isset($data['http_status']) ? (int) $data['http_status'] : null;
            $errorMessage = $data['error_message'] ?? 'Falha de comunicação não especificada.';
            $curlError    = $data['curl_error'] ?? null;
            $category     = $data['category'] ?? 'agent_connection';
            $severity     = $data['severity'] ?? self::inferSeverity($httpStatus, $curlError, $errorMessage, $category);

            // Throttle / Deduplication: Prevent flood of identical errors within 60 seconds
            if ($websiteId && $endpoint) {
                $oneMinuteAgo = date('Y-m-d H:i:s', strtotime('-60 seconds'));
                $existing = $logModel->where('website_id', $websiteId)
                    ->where('endpoint', $endpoint)
                    ->where('status', 'unresolved')
                    ->where('created_at >=', $oneMinuteAgo)
                    ->first();

                if ($existing) {
                    // Touch updated_at and avoid duplicate insert
                    $logModel->update($existing['id'], ['updated_at' => date('Y-m-d H:i:s')]);
                    return (int) $existing['id'];
                }
            }

            // Sanitize payloads
            $requestPayload = self::sanitizePayload($data['request_payload'] ?? null);
            $responseBody   = self::truncateResponse($data['response_body'] ?? null);

            // Generate smart diagnosis suggestion if not provided
            $suggestedSolution = $data['suggested_solution'] ?? self::generateSuggestion([
                'category'      => $category,
                'endpoint'      => $endpoint,
                'http_status'   => $httpStatus,
                'curl_error'    => $curlError,
                'error_message' => $errorMessage,
                'response_body' => $responseBody,
                'website_url'   => $websiteUrl,
            ]);

            // Client IP and user agent
            $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
            $userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 250) : null;

            $insertData = [
                'severity'           => $severity,
                'category'           => $category,
                'website_id'         => $websiteId,
                'website_name'       => $websiteName,
                'website_url'        => $websiteUrl,
                'user_id'            => $userId,
                'user_email'         => $userEmail,
                'endpoint'           => $endpoint,
                'http_method'        => $httpMethod,
                'http_status'        => $httpStatus,
                'error_message'      => $errorMessage,
                'curl_error'         => $curlError,
                'request_payload'    => $requestPayload,
                'response_body'      => $responseBody,
                'suggested_solution' => $suggestedSolution,
                'status'             => $data['status'] ?? 'unresolved',
                'admin_notes'        => $data['admin_notes'] ?? null,
                'ip_address'         => $ipAddress,
                'user_agent'         => $userAgent,
                'created_at'         => $data['created_at'] ?? date('Y-m-d H:i:s'),
                'updated_at'         => $data['updated_at'] ?? date('Y-m-d H:i:s'),
            ];

            return (int) $logModel->insert($insertData, true);
        } catch (\Throwable $e) {
            // Never break the calling application due to a logging failure
            if (function_exists('log_message')) {
                \log_message('error', 'PlatformErrorLogger failure: ' . $e->getMessage());
            } else {
                error_log('PlatformErrorLogger failure: ' . $e->getMessage());
            }
            return null;
        }
    }

    /**
     * Infer severity from status code or cURL message.
     */
    protected static function inferSeverity(?int $status, ?string $curl, string $msg, string $category = 'agent_connection'): string
    {
        if ($category === 'ai_service') {
            if ($status === 401 || $status === 403 || $status === 429) {
                return 'critical';
            }
            if ($status >= 500 || (!empty($curl) && stripos($curl, 'timed out') !== false)) {
                return 'error';
            }
            if ($status === 200 || str_contains(strtolower($msg), 'json')) {
                return 'warning';
            }
            return 'error';
        }

        if ($status >= 500) {
            return 'critical';
        }
        if ($status === 401 || $status === 403 || $status === 406) {
            return 'error';
        }
        if ($status === 404) {
            return 'warning';
        }
        if (!empty($curl) && (stripos($curl, 'timed out') !== false || stripos($curl, 'resolve host') !== false)) {
            return 'error';
        }
        return 'error';
    }

    /**
     * Generate smart diagnostic suggestion based on the failure fingerprint.
     */
    public static function generateSuggestion(array $ctx): string
    {
        $category = $ctx['category'] ?? '';
        $endpoint = $ctx['endpoint'] ?? '';
        $status   = $ctx['http_status'] ?? 0;
        $curl     = strtolower($ctx['curl_error'] ?? '');
        $body     = is_string($ctx['response_body'] ?? '') ? $ctx['response_body'] : '';
        $msg      = strtolower($ctx['error_message'] ?? '');

        $isAi = ($category === 'ai_service')
            || str_contains($endpoint, 'opencode')
            || str_contains($endpoint, 'chat/completions')
            || str_contains($endpoint, 'openai')
            || str_contains($msg, 'opencode')
            || str_contains($msg, 'api de ia');

        if ($isAi) {
            // 1. Timeout na API de IA (cURL 28 / timeout)
            if (strpos($curl, 'timed out') !== false || strpos($curl, 'operation timeout') !== false || strpos($msg, 'timed out') !== false) {
                return "⏳ **Tempo Limite Excedido na API de IA (Timeout cURL 28)**:\n"
                    . "A requisição para o provedor de Inteligência Artificial (OpenCode/OpenAI) ultrapassou o tempo limite configurado na plataforma.\n\n"
                    . "**Possíveis Causas**:\n"
                    . "1. Alta sobrecarga ou fila de inferência nos clusters do provedor de IA no momento da solicitação.\n"
                    . "2. Prompt extenso ou complexo (ex: geração completa de plugin de segurança ou análise de múltiplos itens) que exigiu tempo de resposta superior a 90/120 segundos.\n"
                    . "3. Instabilidade temporária de rede ou lentidão entre a VPS e o endpoint da API.\n\n"
                    . "**Soluções Recomendadas**:\n"
                    . "• Tente executar a solicitação novamente após alguns instantes no painel.\n"
                    . "• Em ações com múltiplos itens, prefira gerar correções por lotes menores ou individualmente.\n"
                    . "• Se o erro for frequente, selecione um modelo de menor latência nas configurações do sistema ou aumente o timeout.";
            }

            // 2. Chave de API de IA Inválida / Rejeitada (HTTP 401 ou 403)
            if ($status === 401 || $status === 403 || strpos($msg, 'unauthorized') !== false || strpos($body, 'invalid_api_key') !== false || strpos($msg, 'chave da api') !== false) {
                return "🔑 **Autenticação Rejeitada pelo Provedor de IA (HTTP {$status})**:\n"
                    . "A API Key configurada para o serviço de inteligência artificial foi recusada pelo provedor.\n\n"
                    . "**Possíveis Causas**:\n"
                    . "1. A variável `OPENCODE_API_KEY` no arquivo `.env` está vazia, inválida ou foi revogada no console do provedor.\n"
                    . "2. A conta na OpenCode / OpenAI foi desativada ou teve suas permissões de token alteradas.\n\n"
                    . "**Soluções Recomendadas**:\n"
                    . "• Verifique e renove a chave `OPENCODE_API_KEY` no arquivo `.env` da plataforma.\n"
                    . "• Acesse o painel da OpenCode/provedor para certificar-se de que a API Key continua ativa e possui saldo disponível.";
            }

            // 3. Rate Limit ou Créditos Esgotados (HTTP 429)
            if ($status === 429 || strpos($msg, 'too many requests') !== false || strpos($body, 'insufficient_quota') !== false || strpos($body, 'rate_limit') !== false) {
                return "💳 **Limite de Requisições ou Créditos de IA Esgotados (HTTP 429 Too Many Requests)**:\n"
                    . "O provedor de IA bloqueou a requisição por excesso de requisições por minuto ou falta de saldo na conta.\n\n"
                    . "**Possíveis Causas**:\n"
                    . "1. O saldo de créditos da conta na OpenCode / OpenAI esgotou.\n"
                    . "2. O teto de requisições por minuto (RPM) ou tokens por minuto (TPM) da conta foi ultrapassado devido a múltiplas ações simultâneas.\n\n"
                    . "**Soluções Recomendadas**:\n"
                    . "• Acesse o portal do provedor de IA e recarregue créditos ou aumente o limite da conta.\n"
                    . "• Aguarde cerca de 60 segundos antes de reenviar novas solicitações de IA.";
            }

            // 4. Instabilidade ou Falha no Provedor de IA (HTTP 500+)
            if ($status >= 500) {
                return "💥 **Instabilidade no Servidor do Provedor de IA (HTTP {$status})**:\n"
                    . "Os servidores da API OpenCode / OpenAI responderam com erro interno de infraestrutura.\n\n"
                    . "**Possíveis Causas**:\n"
                    . "1. Manutenção programada ou degradação temporária no cluster de inferência do provedor.\n"
                    . "2. O modelo solicitado está temporariamente indisponível ou em manutenção.\n\n"
                    . "**Soluções Recomendadas**:\n"
                    . "• Consulte a página de status do provedor para verificar incidentes em andamento.\n"
                    . "• Tente novamente após alguns minutos ou alterne para outro modelo configurado no sistema.";
            }

            // 5. URL da API Incorreta / 404
            if ($status === 404 || strpos($msg, 'not found') !== false || strpos($body, 'not found') !== false) {
                return "🔍 **Endpoint da API de IA Não Encontrado (HTTP 404 Not Found)**:\n"
                    . "A URL configurada para a API de Inteligência Artificial está incorreta.\n\n"
                    . "**Possíveis Causas**:\n"
                    . "1. A variável `OPENCODE_API_URL` no `.env` foi digitada incorretamente.\n\n"
                    . "**Soluções Recomendadas**:\n"
                    . "• Certifique-se de que a variável `OPENCODE_API_URL` no `.env` esteja configurada exatamente como:\n"
                    . "  `https://opencode.ai/zen/go/v1/chat/completions` (ou o endpoint padrão do seu provedor OpenAI-compatível).";
            }

            // 6. Resposta Malformada / JSON Inválido
            if (strpos($msg, 'resposta inesperada') !== false || strpos($msg, 'json') !== false) {
                return "⚠️ **Resposta Fora do Padrão Retornada pela IA**:\n"
                    . "O modelo de IA respondeu à requisição, porém o conteúdo retornado não pôde ser interpretado pelo parser do sistema.\n\n"
                    . "**Ação Recomendada**:\n"
                    . "• Inspecione o campo 'Resposta Bruta do Servidor' neste modal para conferir o texto exato gerado.\n"
                    . "• Execute novamente a operação para que o modelo processe uma nova semente de geração.";
            }

            // Fallback genérico para IA
            return "🤖 **Incidente na Execução de Inteligência Artificial (Código: " . ($status ?: 'cURL/Rede') . ")**:\n"
                . "Houve uma falha durante o processamento da chamada à API de IA.\n\n"
                . "**Mensagem**: " . ($ctx['error_message'] ?? 'Erro não especificado') . "\n\n"
                . "**Ação Recomendada**:\n"
                . "• Inspecione a aba 'Parâmetros da Requisição' e 'Resposta Bruta do Servidor' para mais detalhes.";
        }

        // 1. Timeout cURL 28 (Agente WordPress)
        if (strpos($curl, 'timed out') !== false || strpos($curl, 'operation timeout') !== false || strpos($msg, 'timed out') !== false) {
            return "⏳ **Tempo Limite Excedido (Timeout cURL 28)**:\n"
                . "O servidor do cliente não respondeu dentro do limite de 60 segundos configurado no SaaS.\n\n"
                . "**Possíveis Causas**:\n"
                . "1. O servidor do WordPress está com alto consumo de recursos (CPU / Memória) ou gargalo de banco de dados.\n"
                . "2. A rotina solicitada (varredura profunda, integridade de milhares de arquivos) excedeu o limite do PHP.\n"
                . "3. Firewall do servidor está deliberadamente atrasando a conexão (tarpitting).\n\n"
                . "**Soluções Recomendadas**:\n"
                . "• Oriente o cliente a aumentar os valores de `max_execution_time` (mínimo 120s) e `memory_limit` (mínimo 256MB) no `php.ini`.\n"
                . "• Se o cliente usa Nginx ou LiteSpeed como proxy reverso, conferir os tempos limites de proxy (`fastcgi_read_timeout` ou `proxy_read_timeout`).";
        }

        // 2. DNS resolution failure (cURL 6)
        if (strpos($curl, 'resolve host') !== false || strpos($curl, 'could not resolve') !== false) {
            return "🌐 **Falha na Resolução de DNS (cURL 6)**:\n"
                . "O servidor do SaaS não conseguiu resolver o endereço IP do domínio do site.\n\n"
                . "**Possíveis Causas**:\n"
                . "1. Domínio expirado, suspenso na registradora ou DNS ainda em propagação.\n"
                . "2. Erro de digitação na URL informada ao cadastrar o website na plataforma.\n\n"
                . "**Soluções Recomendadas**:\n"
                . "• Verifique se a URL cadastrada está sem erros de digitação (ex: protocolo `https://` correto).\n"
                . "• Teste se o domínio responde normalmente no navegador ou via comando `dig` / `nslookup`.";
        }

        // 3. SSL / TLS Certificate issues (cURL 35/60)
        if (strpos($curl, 'ssl') !== false || strpos($curl, 'certificate') !== false || strpos($curl, 'handshake') !== false) {
            return "🔒 **Erro de Certificado SSL / Handshake TLS (cURL 35/60)**:\n"
                . "Não foi possível estabelecer um canal seguro com o servidor do cliente.\n\n"
                . "**Possíveis Causas**:\n"
                . "1. Certificado SSL do site está expirado, auto-assinado ou revogado.\n"
                . "2. Cadeia de certificados intermediária incompleta (faltando o bundle CA no servidor web do cliente).\n"
                . "3. Versão legada do TLS incompatível com os padrões de segurança do SaaS.\n\n"
                . "**Soluções Recomendadas**:\n"
                . "• Peça ao cliente para verificar a validade do certificado SSL via ferramentas como SSL Labs (Qualys).\n"
                . "• Reemitir o certificado SSL na hospedagem (Let's Encrypt / cPanel AutoSSL).";
        }

        // 4. HTTP 401 Unauthorized
        if ($status === 401 || strpos($msg, 'unauthorized') !== false || strpos($msg, 'token inválido') !== false) {
            return "🔑 **Autenticação Rejeitada (HTTP 401 Unauthorized)**:\n"
                . "O agente WordPress rejeitou a chave de segurança informada pelo SaaS.\n\n"
                . "**Possíveis Causas**:\n"
                . "1. O token do agente foi alterado no WordPress e não foi sincronizado com a plataforma.\n"
                . "2. O banco de dados do WordPress foi restaurado com um backup antigo, sobrescrevendo a chave do agente.\n"
                . "3. O cabeçalho `Authorization: Bearer` está sendo removido pelo servidor web do cliente (comum em Apache com PHP em modo FastCGI).\n\n"
                . "**Soluções Recomendadas**:\n"
                . "• Acesse o painel do WordPress em **vexors.app - Diagnóstico** e clique no botão de **Reconectar / Re-sincronizar**.\n"
                . "• Se o Apache estiver removendo o cabeçalho, adicione ao `.htaccess`: `SetEnvIf Authorization \"(.*)\" HTTP_AUTHORIZATION=$1`.";
        }

        // 5. HTTP 403 Forbidden / WAF Cloudflare
        if ($status === 403 || strpos($body, 'cloudflare') !== false || strpos($body, 'wordfence') !== false || strpos($body, 'forbidden') !== false) {
            return "🛡️ **Acesso Proibido / Bloqueio por WAF (HTTP 403 Forbidden)**:\n"
                . "A requisição da plataforma foi interceptada e barrada por um firewall de segurança no site do cliente.\n\n"
                . "**Possíveis Causas**:\n"
                . "1. Cloudflare ativo no domínio com modo 'Bot Fight Mode' ou regras personalizadas bloqueando requisições REST externas.\n"
                . "2. Plugins de segurança no WordPress (Wordfence, iThemes Security, Sucuri, NinjaFirewall) bloqueando chamadas da API REST.\n"
                . "3. Bloqueio por IP ou User-Agent no servidor web (`.htaccess` ou regras do Nginx).\n\n"
                . "**Soluções Recomendadas**:\n"
                . "• Instrua o cliente a colocar o IP da plataforma Vexors na **Lista de Permissões (Allowlist)** do Cloudflare e dos plugins de segurança do WordPress.\n"
                . "• Garantir que requisições para a rota `/wp-json/vexors/` não sejam bloqueadas.";
        }

        // 6. HTTP 404 Not Found (Permalinks / Plugin Inativo)
        if ($status === 404 || strpos($msg, 'não encontrado') !== false || strpos($body, 'objeto não encontrado') !== false) {
            return "🔍 **Endpoint Não Encontrado (HTTP 404 Not Found)**:\n"
                . "A URL da API REST do agente não respondeu no WordPress.\n\n"
                . "**Possíveis Causas**:\n"
                . "1. A estrutura de **Links Permanentes (Permalinks)** do WordPress não foi gerada ou o arquivo `.htaccess` está corrompido.\n"
                . "2. O plugin **vexors.app - Diagnóstico** não está ativado ou foi removido do WordPress.\n"
                . "3. Conflito com plugin de cache ou de reescrita de URL que removeu as rotas da REST API do WordPress.\n\n"
                . "**Soluções Recomendadas**:\n"
                . "• Instrua o cliente a acessar no painel do WordPress: **Configurações > Links Permanentes** e clicar diretamente em **\"Salvar Alterações\"** (isso recria o `.htaccess` e registra as rotas da REST API).\n"
                . "• Confirme se o plugin vexors.app está ativado em **Plugins > Plugins Instalados**.";
        }

        // 7. HTTP 406 Not Acceptable (ModSecurity)
        if ($status === 406 || strpos($body, 'mod_security') !== false || strpos($body, 'modsecurity') !== false) {
            return "🚫 **Bloqueio por Firewall do Servidor (HTTP 406 Not Acceptable / ModSecurity)**:\n"
                . "O firewall a nível de servidor Apache/LiteSpeed (ModSecurity) barrou a comunicação.\n\n"
                . "**Possíveis Causas**:\n"
                . "1. Regras estritas do ModSecurity (OWASP Core Rule Set) interpretaram os cabeçalhos ou parâmetros como suspeitos.\n"
                . "2. Cabeçalho de autorização ou User-Agent padrão bloqueado por assinatura de bot genérica.\n\n"
                . "**Soluções Recomendadas**:\n"
                . "• O cliente deve solicitar ao suporte da hospedagem para liberar a regra do ModSecurity que gerou o bloqueio (ID do Rule no error log do Apache).\n"
                . "• Alternativamente, adicionar o IP do SaaS Vexors na whitelist do ModSecurity na hospedagem.";
        }

        // 8. HTTP 500 Internal Server Error (PHP Fatal Crash)
        if ($status === 500) {
            return "💥 **Erro Crítico no Servidor do Cliente (HTTP 500 Internal Server Error)**:\n"
                . "O WordPress do cliente disparou um erro fatal do PHP durante o processamento da requisição.\n\n"
                . "**Possíveis Causas**:\n"
                . "1. Conflito entre plugins ou dependência faltante no WordPress (ex: função cURL desativada, extensão ZipArchive ausente).\n"
                . "2. Limite de memória do PHP estourado (`Fatal error: Allowed memory size of ... bytes exhausted`).\n"
                . "3. Erro de sintaxe ou incompatibilidade com a versão do PHP do servidor.\n\n"
                . "**Soluções Recomendadas**:\n"
                . "• Solicite ao cliente para verificar o log de erros do PHP no WordPress (`wp-content/debug.log`) para ver o traceback exato.\n"
                . "• Verifique se o PHP do cliente atende aos requisitos mínimos do WordPress (PHP 7.4 ou superior, recomendado PHP 8.1+).";
        }

        // 9. HTTP 502 / 503 / 504 Bad Gateway / Gateway Timeout
        if ($status === 502 || $status === 503 || $status === 504) {
            return "⚠️ **Servidor Indisponível ou Gateway Timeout (HTTP {$status})**:\n"
                . "O servidor proxy (Nginx, Cloudflare, LiteSpeed) não conseguiu falar com o processo de PHP do cliente.\n\n"
                . "**Possíveis Causas**:\n"
                . "1. O processo PHP-FPM caiu ou atingiu o limite máximo de conexões simultâneas (`max_children`).\n"
                . "2. Servidor temporariamente em manutenção ou sobrecarregado.\n\n"
                . "**Soluções Recomendadas**:\n"
                . "• Aguardar alguns instantes e tentar novamente.\n"
                . "• Se o erro persistir, o cliente deve reiniciar o serviço PHP-FPM ou contatar a hospedagem.";
        }

        // Generic fallback
        return "ℹ️ **Falha de Comunicação Genérica (Código: " . ($status ?: 'cURL/Rede') . ")**:\n"
            . "A plataforma não obteve uma resposta bem-sucedida do agente WordPress.\n\n"
            . "**Ação Recomendada**:\n"
            . "• Inspecione a aba 'Resposta Bruta do Servidor' e os 'Parâmetros da Requisição' neste modal para conferir o retorno do servidor do cliente.\n"
            . "• Teste a conectividade manual do site do cliente e verifique se o plugin vexors.app está atualizado.";
    }

    /**
     * Sanitize sensitive keys from request payloads before storing.
     */
    protected static function sanitizePayload($payload): ?string
    {
        if (empty($payload)) {
            return null;
        }

        if (is_string($payload)) {
            $decoded = json_decode($payload, true);
            if (is_array($decoded)) {
                $payload = $decoded;
            } else {
                // Mask possible token strings in raw text
                $masked = preg_replace('/(token|password|secret|key)=([^&]+)/i', '$1=***MASKED***', $payload);
                return substr($masked, 0, 10000);
            }
        }

        if (is_array($payload)) {
            array_walk_recursive($payload, function (&$value, $key) {
                if (is_string($key) && preg_match('/(token|password|secret|auth|credit_card|cvv)/i', $key)) {
                    $value = '***MASKED***';
                }
            });
            return json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }

        return substr((string) $payload, 0, 10000);
    }

    /**
     * Truncate large server responses to reasonable limits for database storage (max 50KB).
     */
    protected static function truncateResponse($response): ?string
    {
        if (empty($response)) {
            return null;
        }

        if (is_array($response)) {
            return json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }

        $str = (string) $response;
        if (strlen($str) > 50000) {
            return substr($str, 0, 50000) . "\n\n... [Resposta truncada em 50KB pela plataforma]";
        }

        return $str;
    }

    /**
     * Sincroniza erros históricos de execução de IA da tabela ai_usage_logs para a central platform_error_logs.
     */
    public static function syncHistoricalAiErrors(): int
    {
        try {
            $db = \Config\Database::connect();
            if (!$db->tableExists('ai_usage_logs') || !$db->tableExists('platform_error_logs')) {
                return 0;
            }

            $aiLogs = $db->table('ai_usage_logs')
                ->where('status', 'error')
                ->get()
                ->getResultArray();

            if (empty($aiLogs)) {
                return 0;
            }

            $logModel = new PlatformErrorLogModel();
            $syncedCount = 0;

            foreach ($aiLogs as $log) {
                $createdAt = $log['created_at'];
                $errMsg    = $log['error_message'] ?: 'Falha na execução da IA';

                // Verificar se já existe no platform_error_logs
                $exists = $logModel->where('category', 'ai_service')
                    ->where('created_at', $createdAt)
                    ->first();

                if ($exists) {
                    continue;
                }

                $httpStatus = null;
                $curlError  = null;

                if (preg_match('/HTTP\s+(\d+)/i', $errMsg, $matches)) {
                    $httpStatus = (int) $matches[1];
                } elseif (stripos($errMsg, 'curl') !== false || (int) $log['duration_ms'] >= 60000) {
                    $curlError = $errMsg;
                }

                $severity = ($httpStatus === 401 || $httpStatus === 403 || $httpStatus === 429) ? 'critical' : 'error';

                self::log([
                    'severity'        => $severity,
                    'category'        => 'ai_service',
                    'website_id'      => !empty($log['website_id']) ? (int) $log['website_id'] : null,
                    'user_id'         => !empty($log['user_id']) ? (int) $log['user_id'] : null,
                    'endpoint'        => env('OPENCODE_API_URL') ?: 'https://opencode.ai/zen/go/v1/chat/completions',
                    'http_method'     => 'POST',
                    'http_status'     => $httpStatus,
                    'error_message'   => $errMsg,
                    'curl_error'      => $curlError,
                    'request_payload' => [
                        'action_type' => $log['action_type'],
                        'model'       => $log['model'],
                        'duration_ms' => (int) $log['duration_ms'],
                        'sync_source' => 'ai_usage_logs_backfill',
                    ],
                    'created_at'      => $createdAt,
                    'updated_at'      => $createdAt,
                ]);

                $syncedCount++;
            }

            return $syncedCount;
        } catch (\Throwable $e) {
            if (function_exists('log_message')) {
                \log_message('error', 'Falha ao sincronizar erros históricos de IA: ' . $e->getMessage());
            }
            return 0;
        }
    }
}
