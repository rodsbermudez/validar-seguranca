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
            $severity     = $data['severity'] ?? self::inferSeverity($httpStatus, $curlError, $errorMessage);

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
                'status'             => 'unresolved',
                'admin_notes'        => null,
                'ip_address'         => $ipAddress,
                'user_agent'         => $userAgent,
                'created_at'         => date('Y-m-d H:i:s'),
                'updated_at'         => date('Y-m-d H:i:s'),
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
    protected static function inferSeverity(?int $status, ?string $curl, string $msg): string
    {
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
        $status = $ctx['http_status'] ?? 0;
        $curl   = strtolower($ctx['curl_error'] ?? '');
        $body   = is_string($ctx['response_body'] ?? '') ? $ctx['response_body'] : '';
        $msg    = strtolower($ctx['error_message'] ?? '');

        // 1. Timeout cURL 28
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
}
