<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\WebsiteModel;
use App\Models\ScanHistoryModel;
use App\Models\SolutionCatalogModel;
use App\Services\AIService;
use App\Services\BrandingService;
use ZipArchive;

class Remediation extends ResourceController
{
    protected $format = 'json';

    protected function extractAllChecks(array $scanResults): array
    {
        $checks = [];
        if (isset($scanResults['checks']) && is_array($scanResults['checks'])) {
            $checks = array_merge($checks, $scanResults['checks']);
        }
        if (isset($scanResults['categories']) && is_array($scanResults['categories'])) {
            foreach ($scanResults['categories'] as $category) {
                if (isset($category['checks']) && is_array($category['checks'])) {
                    $checks = array_merge($checks, $category['checks']);
                }
            }
        }
        return $checks;
    }

    /**
     * POST /api/remediation/generate-plugin
     * Generates a custom remediation ZIP plugin based on scan results and AI synthesis.
     */
    public function generatePlugin()
    {
        $json         = $this->request->getJSON(true) ?: [];
        $scanId       = $json['scan_id'] ?? null;
        $websiteId    = $json['website_id'] ?? null;
        $customPrompt = $json['custom_prompt'] ?? '';
        $apiKey       = $json['api_key'] ?? null;

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        if (!$scanId && !$websiteId) {
            return $this->fail('scan_id ou website_id é obrigatório.', 400);
        }

        $scanHistoryModel = new ScanHistoryModel();
        if ($scanId) {
            $scan = $scanHistoryModel->find($scanId);
        } else {
            $scan = $scanHistoryModel->where('website_id', $websiteId)
                                     ->orderBy('executed_at', 'DESC')
                                     ->first();
        }

        if (!$scan || empty($scan['scan_results_json'])) {
            return $this->failNotFound('Relatório de varredura não encontrado.');
        }

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($scan['website_id']);

        if (!$website) {
            return $this->failNotFound('Website correspondente não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$scan['website_id'], $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para gerar plugins de remediação para este website.');
        }

        $scanResults = json_decode($scan['scan_results_json'], true);
        if (!is_array($scanResults)) {
            return $this->fail('Resultados da varredura inválidos.', 400);
        }

        $allChecks = $this->extractAllChecks($scanResults);

        // Collect check IDs that failed or generated alerts
        $failedCheckIds = [];
        foreach ($allChecks as $check) {
            $status = strtoupper($check['status'] ?? '');
            if (in_array($status, ['FAIL', 'WARNING', 'WARN', 'ALERTA', 'FALHA'])) {
                $checkId = $check['id'] ?? ($check['check_id'] ?? null);
                if ($checkId) {
                    $failedCheckIds[] = $checkId;
                }
            }
        }

        if (empty($failedCheckIds)) {
            return $this->fail('Não foram encontradas falhas neste relatório para compor o plugin de remediação.', 400);
        }

        // Fetch catalog solutions for failed check IDs
        $catalogModel = new SolutionCatalogModel();
        $catalogSolutions = $catalogModel->whereIn('check_id', $failedCheckIds)->findAll();

        // STRICT TRIAGING: Filter ONLY PLUGIN_AUTO_FIX solutions with valid snippets
        $pluginFixableSolutions = array_filter($catalogSolutions, function ($sol) {
            return ($sol['action_type'] === 'PLUGIN_AUTO_FIX') && !empty(trim($sol['fix_code_snippet'] ?? ''));
        });

        if (empty($pluginFixableSolutions)) {
            return $this->fail(
                'Nenhuma das falhas encontradas neste relatório é elegível para correção automática por plugin. ' .
                'As falhas detectadas exigem configurações no servidor de hospedagem ou ações manuais do administrador.',
                400
            );
        }

        if (!empty($customPrompt)) {
            try {
                $aiService = new AIService($apiKey);
                $pluginCode = $aiService->generateRemediationPlugin($pluginFixableSolutions, $website['url'], $customPrompt, (int)$effectiveUserId, (int)$website['id']);
                if (!str_contains($pluginCode, 'vs_fixes_check_rest_permission')) {
                    $pluginCode .= "\n\n" . $this->getRemediationInfrastructurePhp($website, $pluginFixableSolutions);
                }
            } catch (\Exception $e) {
                if (str_contains($e->getMessage(), 'desabilitado') || str_contains($e->getMessage(), 'Limite mensal')) {
                    return $this->fail($e->getMessage(), 403);
                }
                $pluginCode = $this->buildNativeRemediationPlugin($pluginFixableSolutions, $website);
            }
        } else {
            // Geração nativa determinística: instantânea, 100% testada e com rotas REST e token embutidos
            $pluginCode = $this->buildNativeRemediationPlugin($pluginFixableSolutions, $website);
        }

        try {
            // Package into ZIP
            $siteHost = parse_url($website['url'], PHP_URL_HOST) ?: 'site';
            $siteSlug = preg_replace('/[^a-zA-Z0-9_\-]/', '-', $siteHost);
            $zipFilename = "vexors-fixes-{$siteSlug}.zip";

            $tempDir = WRITEPATH . 'uploads/temp_remediation/';
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            $zipPath = $tempDir . 'fix_' . uniqid() . '.zip';

            $zip = new ZipArchive();
            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                return $this->failServerError('Não foi possível criar o arquivo ZIP de remediação.');
            }

            $pluginDirName = 'vexors-fixes';
            $zip->addFromString("{$pluginDirName}/vexors-fixes.php", $pluginCode);

            // Add asset images to ZIP
            $faviconPath = ROOTPATH . 'public/favicon.png';
            if (file_exists($faviconPath)) {
                $zip->addFile($faviconPath, "{$pluginDirName}/assets/favicon.png");
            }

            $logoDarkPath = ROOTPATH . 'public/images/vexors-logo-dark.svg';
            if (file_exists($logoDarkPath)) {
                $zip->addFile($logoDarkPath, "{$pluginDirName}/assets/vexors-logo-dark.svg");
                $zip->addFile($logoDarkPath, "{$pluginDirName}/assets/vexors-logo.svg");
            } elseif (file_exists(ROOTPATH . 'public/images/vexors-logo.svg')) {
                $zip->addFile(ROOTPATH . 'public/images/vexors-logo.svg', "{$pluginDirName}/assets/vexors-logo.svg");
            }

            // Create Readme.txt
            $readmeText = "====================================================\n" .
                "VEXORS.APP - PLUGIN CUSTOMIZADO DE REMEDIAÇÃO\n" .
                "====================================================\n\n" .
                "Website Alvo: {$website['url']}\n" .
                "Data de Geração: " . date('Y-m-d H:i:s') . "\n\n" .
                "CORREÇÕES APLICADAS VIA PLUGIN:\n";

            foreach ($pluginFixableSolutions as $idx => $fix) {
                $num = $idx + 1;
                $readmeText .= "{$num}. {$fix['solution_title']} (ID: {$fix['check_id']})\n";
                if (!empty($fix['problem_description'])) {
                    $readmeText .= "   Problema: {$fix['problem_description']}\n";
                }
                if (!empty($fix['solution_instructions'])) {
                    $readmeText .= "   Instruções: {$fix['solution_instructions']}\n";
                }
                $readmeText .= "\n";
            }

            $readmeText .= "\nINSTALAÇÃO:\n" .
                "1. Acesse o painel WP Admin do site ({$website['url']}/wp-admin).\n" .
                "2. Vá em 'Plugins' > 'Adicionar Novo' > 'Enviar Plugin'.\n" .
                "3. Selecione este arquivo ZIP e clique em 'Instalar Agora'.\n" .
                "4. Clique em 'Ativar Plugin'.\n\n" .
                "Após a ativação, re-execute a varredura na plataforma vexors.app para confirmar o sanamento das falhas.\n";

            $zip->addFromString("{$pluginDirName}/readme.txt", $readmeText);
            $zip->close();

            // Read ZIP file contents for download output
            $zipContent = file_get_contents($zipPath);
            @unlink($zipPath);

            return $this->response
                ->setHeader('Content-Type', 'application/zip')
                ->setHeader('Content-Disposition', 'attachment; filename="' . $zipFilename . '"')
                ->setHeader('Content-Length', (string)strlen($zipContent))
                ->setBody($zipContent);
        } catch (\Exception $e) {
            return $this->failServerError('Erro na geração do plugin de remediação: ' . $e->getMessage());
        }
    }

    /**
     * POST /api/remediation/generate-server-guide
     * Generates a step-by-step resolution guide for SERVER_CONFIG & MANUAL_ACTION issues.
     */
    public function generateServerGuide()
    {
        @set_time_limit(150);

        $json        = $this->request->getJSON(true) ?: [];
        $scanId      = $json['scan_id'] ?? null;
        $websiteId   = $json['website_id'] ?? null;
        $apiKey      = $json['api_key'] ?? null;
        $useFallback = !empty($json['use_fallback']);

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        if (!$scanId && !$websiteId) {
            return $this->fail('scan_id ou website_id é obrigatório.', 400);
        }

        $scanHistoryModel = new ScanHistoryModel();
        if ($scanId) {
            $scan = $scanHistoryModel->find($scanId);
        } else {
            $scan = $scanHistoryModel->where('website_id', $websiteId)
                                     ->orderBy('executed_at', 'DESC')
                                     ->first();
        }

        if (!$scan || empty($scan['scan_results_json'])) {
            return $this->failNotFound('Relatório de varredura não encontrado.');
        }

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($scan['website_id']);

        if (!$website) {
            return $this->failNotFound('Website correspondente não encontrado.');
        }

        if (!$websiteModel->canUserAccess((int)$scan['website_id'], $effectiveUserId, $isAdmin)) {
            return $this->failForbidden('Você não tem permissão para visualizar o guia de remediação deste website.');
        }

        $scanResults = json_decode($scan['scan_results_json'], true);
        if (!is_array($scanResults)) {
            return $this->fail('Resultados da varredura inválidos.', 400);
        }

        $allChecks = $this->extractAllChecks($scanResults);

        // Collect check IDs that failed or generated alerts
        $failedChecks = [];
        foreach ($allChecks as $check) {
            $status = strtoupper($check['status'] ?? '');
            if (in_array($status, ['FAIL', 'WARNING', 'WARN', 'ALERTA', 'FALHA'])) {
                $failedChecks[] = $check;
            }
        }

        if (empty($failedChecks)) {
            return $this->respond([
                'status'  => 200,
                'message' => 'Nenhuma falha encontrada neste relatório.',
                'guide_html'   => '<div style="padding: 20px; text-align: center; color: #10B981;"><h3>🎉 Nenhum problema de servidor encontrado!</h3><p>Seu site foi aprovado em todas as verificações de servidor e infraestrutura.</p></div>',
                'issues'  => [],
            ]);
        }

        $failedCheckIds = array_filter(array_map(fn($c) => $c['id'] ?? ($c['check_id'] ?? null), $failedChecks));

        // Fetch catalog solutions
        $catalogModel = new SolutionCatalogModel();
        $catalogSolutions = !empty($failedCheckIds) ? $catalogModel->whereIn('check_id', $failedCheckIds)->findAll() : [];
        $catalogByCheckId = [];
        foreach ($catalogSolutions as $sol) {
            $catalogByCheckId[$sol['check_id']] = $sol;
        }

        // STRICT TRIAGING: Filter SERVER_CONFIG and MANUAL_ACTION (excluding PLUGIN_AUTO_FIX)
        $serverFixableItems = [];
        foreach ($failedChecks as $check) {
            $checkId = $check['id'] ?? ($check['check_id'] ?? null);
            $sol = $checkId ? ($catalogByCheckId[$checkId] ?? null) : null;

            $actionType = $sol['action_type'] ?? null;

            // If catalog solution exists and is PLUGIN_AUTO_FIX, skip it!
            if ($actionType === 'PLUGIN_AUTO_FIX') {
                continue;
            }

            // Otherwise, it's a SERVER_CONFIG or MANUAL_ACTION issue
            $serverFixableItems[] = [
                'check_id'              => $checkId,
                'check_name'            => $check['name'] ?? ($sol['check_name'] ?? $checkId),
                'action_type'           => $actionType ?: 'SERVER_CONFIG',
                'solution_title'        => $sol['solution_title'] ?? ($check['name'] ?? $checkId),
                'problem_description'   => $sol['problem_description'] ?? ($check['details'] ?? $check['description'] ?? ''),
                'solution_instructions' => $sol['solution_instructions'] ?? '',
                'details'               => $check['details'] ?? '',
            ];
        }

        if (empty($serverFixableItems)) {
            return $this->respond([
                'status'  => 200,
                'message' => 'Todas as falhas encontradas podem ser resolvidas pelo plugin automático.',
                'guide_html'   => '<div style="padding: 20px; text-align: center; color: #10B981;"><h3>⚡ Todas as falhas são corrigíveis via Plugin!</h3><p>Utilize o botão "Gerar Plugin de Correção Customizado" para sanar todas as pendências ativas.</p></div>',
                'issues'  => [],
            ]);
        }

        $forceRefresh = !empty($json['force_refresh']) || !empty($json['refresh']);

        // Check if we already have a saved guide in scanResults (unless forced or using fallback explicit request)
        if (!$forceRefresh && !$useFallback && !empty($scanResults['server_guide_html'])) {
            return $this->respond([
                'status'       => 200,
                'cached'       => true,
                'generated_at' => $scanResults['server_guide_generated_at'] ?? null,
                'website_url'   => $website['url'],
                'total_issues'  => count($serverFixableItems),
                'issues'       => $serverFixableItems,
                'guide_html'   => $scanResults['server_guide_html'],
            ]);
        }

        if ($useFallback) {
            $guideHtml = $this->buildFallbackServerGuideHtml($serverFixableItems, $website['url']);
        } else {
            try {
                $aiService = new AIService($apiKey);
                $guideHtml = $aiService->generateServerGuide($serverFixableItems, $website['url'], (int)$effectiveUserId, (int)$website['id']);
            } catch (\Exception $e) {
                if (str_contains($e->getMessage(), 'desabilitado') || str_contains($e->getMessage(), 'Limite mensal')) {
                    return $this->fail($e->getMessage(), 403);
                }
                log_message('error', 'Erro na geração do Guia de Servidor via IA: ' . $e->getMessage());
                // Fallback to rich built-in template HTML guide if AI is unreachable or API key missing
                $guideHtml = $this->buildFallbackServerGuideHtml($serverFixableItems, $website['url']);
            }
        }

        // Save generated guide into scan_results_json in database
        $now = date('Y-m-d H:i:s');
        $scanResults['server_guide_html'] = $guideHtml;
        $scanResults['server_guide_generated_at'] = $now;

        $scanHistoryModel->update($scan['id'], [
            'scan_results_json' => json_encode($scanResults, JSON_UNESCAPED_UNICODE)
        ]);

        return $this->respond([
            'status'       => 200,
            'cached'       => false,
            'generated_at' => $now,
            'website_url'   => $website['url'],
            'total_issues'  => count($serverFixableItems),
            'issues'       => $serverFixableItems,
            'guide_html'   => $guideHtml,
        ]);
    }

    protected function buildFallbackServerGuideHtml(array $serverFixableItems, string $siteUrl): string
    {
        $html = '<div style="font-family: system-ui, -apple-system, sans-serif; color: #E2E8F0; line-height: 1.6;">';
        $html .= '<div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 16px; margin-bottom: 24px;">';
        $html .= '<h3 style="margin-top: 0; color: #60A5FA;">📋 Guia Prático de Remediação do Servidor</h3>';
        $html .= '<p style="margin-bottom: 0;">As pendências abaixo exigem ajustes nas configurações do seu servidor de hospedagem (Apache, Nginx, LiteSpeed, php.ini ou .htaccess) ou ações manuais de administração para o site <strong>' . htmlspecialchars($siteUrl) . '</strong>.</p>';
        $html .= '</div>';

        foreach ($serverFixableItems as $idx => $item) {
            $num = $idx + 1;
            $title        = htmlspecialchars($item['solution_title'] ?? $item['check_name'] ?? $item['check_id']);
            $problem      = htmlspecialchars($item['problem_description'] ?? $item['details'] ?? '');
            $instructions = nl2br(htmlspecialchars($item['solution_instructions'] ?? ''));
            $actionType   = htmlspecialchars($item['action_type'] ?? 'SERVER_CONFIG');

            $badgeColor = ($actionType === 'SERVER_CONFIG') ? '#F59E0B' : '#3B82F6';
            $badgeText  = ($actionType === 'SERVER_CONFIG') ? 'Configuração no Servidor' : 'Ação Manual do Administrador';

            $html .= '<div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 20px; margin-bottom: 20px;">';
            $html .= '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">';
            $html .= '<h4 style="margin: 0; font-size: 1.1rem; color: #F8FAFC;">' . $num . '. ' . $title . '</h4>';
            $html .= '<span style="background: ' . $badgeColor . '22; color: ' . $badgeColor . '; border: 1px solid ' . $badgeColor . '44; font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 9999px;">' . $badgeText . '</span>';
            $html .= '</div>';

            if (!empty($problem)) {
                $html .= '<div style="margin-bottom: 12px;"><strong style="color: #94A3B8;">Análise do Problema:</strong><p style="margin: 4px 0 0 0; color: #CBD5E1;">' . $problem . '</p></div>';
            }

            if (!empty($instructions)) {
                $html .= '<div><strong style="color: #60A5FA;">Passo a Passo de Correção:</strong><div style="margin-top: 6px; background: rgba(15, 23, 42, 0.8); border-left: 4px solid #3B82F6; padding: 12px 16px; border-radius: 4px; color: #F1F5F9;">' . $instructions . '</div></div>';
            }
            $html .= '</div>';
        }

        $html .= '</div>';
        return $html;
    }

    protected function getRemediationInfrastructurePhp($website, array $pluginFixes = []): string
    {
        $websiteUrl = is_array($website) ? ($website['url'] ?? '') : (string)$website;
        $agentToken = is_array($website) ? addslashes($website['agent_token'] ?? '') : '';
        $siteId     = is_array($website) ? (int)($website['id'] ?? 0) : 0;

        $code = "// --- INFRAESTRUTURA DE COMUNICAÇÃO E GESTÃO REMOTA PELO SAAS ---\n";
        $code .= "if (!defined('VS_FIXES_VERSION')) {\n    define('VS_FIXES_VERSION', '1.0.1');\n}\n";
        $code .= "if (!defined('VS_FIXES_SITE_TOKEN')) {\n    define('VS_FIXES_SITE_TOKEN', '{$agentToken}');\n}\n";
        $code .= "if (!defined('VS_FIXES_SITE_ID')) {\n    define('VS_FIXES_SITE_ID', {$siteId});\n}\n\n";

        // Auto-sync credentials into WordPress options if not present
        $code .= "add_action('init', function() {\n";
        $code .= "    if (defined('VS_FIXES_SITE_TOKEN') && !empty(VS_FIXES_SITE_TOKEN)) {\n";
        $code .= "        \$saved = trim((string) get_option('vs_agent_token'));\n";
        $code .= "        if (empty(\$saved)) {\n";
        $code .= "            update_option('vs_agent_token', VS_FIXES_SITE_TOKEN);\n";
        $code .= "        }\n";
        $code .= "    }\n";
        $code .= "    if (defined('VS_FIXES_SITE_ID') && !empty(VS_FIXES_SITE_ID)) {\n";
        $code .= "        \$saved_id = (int) get_option('vs_site_id');\n";
        $code .= "        if (empty(\$saved_id)) {\n";
        $code .= "            update_option('vs_site_id', VS_FIXES_SITE_ID);\n";
        $code .= "        }\n";
        $code .= "    }\n";
        $code .= "});\n\n";

        // Registered fixes catalog
        if (!empty($pluginFixes)) {
            $code .= "if (!function_exists('vs_get_registered_fixes')) {\n";
            $code .= "    function vs_get_registered_fixes() {\n";
            $code .= "        return array(\n";
            foreach ($pluginFixes as $fix) {
                $cid   = addslashes($fix['check_id'] ?? '');
                $title = addslashes($fix['solution_title'] ?? ($fix['check_name'] ?? $cid));
                $desc  = addslashes($fix['problem_description'] ?? ($fix['solution_instructions'] ?? ''));
                $code .= "            '{$cid}' => array(\n";
                $code .= "                'title'       => '{$title}',\n";
                $code .= "                'description' => '{$desc}',\n";
                $code .= "            ),\n";
            }
            $code .= "        );\n";
            $code .= "    }\n";
            $code .= "}\n\n";
        }

        // Helper functions for status
        $code .= "if (!function_exists('vs_get_fixes_settings')) {\n";
        $code .= "    function vs_get_fixes_settings() {\n";
        $code .= "        \$settings = get_option('vexors_fixes_settings', null);\n";
        $code .= "        if (\$settings === null) {\n";
        $code .= "            \$settings = get_option('wp_patropi_fixes_settings', null);\n";
        $code .= "        }\n";
        $code .= "        if (\$settings === null) {\n";
        $code .= "            \$settings = get_option('vs_patropi_fixes_settings', array());\n";
        $code .= "        }\n";
        $code .= "        return is_array(\$settings) ? \$settings : array();\n";
        $code .= "    }\n";
        $code .= "}\n\n";

        $code .= "if (!function_exists('vs_is_fix_active')) {\n";
        $code .= "    function vs_is_fix_active(\$check_id) {\n";
        $code .= "        \$settings = vs_get_fixes_settings();\n";
        $code .= "        if (!isset(\$settings[\$check_id])) {\n";
        $code .= "            return true;\n";
        $code .= "        }\n";
        $code .= "        return !empty(\$settings[\$check_id]);\n";
        $code .= "    }\n";
        $code .= "}\n\n";

        $code .= "if (!function_exists('vs_set_fix_status')) {\n";
        $code .= "    function vs_set_fix_status(\$check_id, \$enabled) {\n";
        $code .= "        \$settings = vs_get_fixes_settings();\n";
        $code .= "        \$settings[\$check_id] = (bool) \$enabled;\n";
        $code .= "        update_option('vexors_fixes_settings', \$settings);\n";
        $code .= "        update_option('wp_patropi_fixes_settings', \$settings);\n";
        $code .= "        update_option('vs_patropi_fixes_settings', \$settings);\n";
        $code .= "        return true;\n";
        $code .= "    }\n";
        $code .= "}\n\n";

        // Multi-source token extraction
        $code .= "if (!function_exists('vs_fixes_get_token_from_request')) {\n";
        $code .= "    function vs_fixes_get_token_from_request(\$request = null) {\n";
        $code .= "        if (!empty(\$_SERVER['HTTP_X_VEXORS_TOKEN'])) {\n";
        $code .= "            return trim(\$_SERVER['HTTP_X_VEXORS_TOKEN']);\n";
        $code .= "        }\n";
        $code .= "        if (!empty(\$_SERVER['HTTP_X_VALIDAR_SEGURANCA_TOKEN'])) {\n";
        $code .= "            return trim(\$_SERVER['HTTP_X_VALIDAR_SEGURANCA_TOKEN']);\n";
        $code .= "        }\n";
        $code .= "        \$auth = !empty(\$_SERVER['HTTP_AUTHORIZATION']) ? \$_SERVER['HTTP_AUTHORIZATION'] : (!empty(\$_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? \$_SERVER['REDIRECT_HTTP_AUTHORIZATION'] : '');\n";
        $code .= "        if (empty(\$auth) && function_exists('getallheaders')) {\n";
        $code .= "            \$headers = getallheaders();\n";
        $code .= "            foreach (\$headers as \$k => \$v) {\n";
        $code .= "                if (strtolower(\$k) === 'authorization') {\n";
        $code .= "                    \$auth = \$v;\n";
        $code .= "                    break;\n";
        $code .= "                }\n";
        $code .= "            }\n";
        $code .= "        }\n";
        $code .= "        if (!empty(\$auth) && preg_match('/Bearer\\s+(\\S+)/i', \$auth, \$m)) {\n";
        $code .= "            return trim(\$m[1]);\n";
        $code .= "        }\n";
        $code .= "        if (!empty(\$_GET['vs_token'])) return trim(\$_GET['vs_token']);\n";
        $code .= "        if (!empty(\$_GET['agent_token'])) return trim(\$_GET['agent_token']);\n";
        $code .= "        if (!empty(\$_GET['token'])) return trim(\$_GET['token']);\n";
        $code .= "        if (!empty(\$_POST['vs_token'])) return trim(\$_POST['vs_token']);\n";
        $code .= "        if (!empty(\$_POST['agent_token'])) return trim(\$_POST['agent_token']);\n";
        $code .= "        if (\$request && is_a(\$request, 'WP_REST_Request')) {\n";
        $code .= "            \$p = \$request->get_param('vs_token') ?: \$request->get_param('agent_token');\n";
        $code .= "            if (!empty(\$p)) return trim(\$p);\n";
        $code .= "        }\n";
        $code .= "        if (function_exists('getallheaders')) {\n";
        $code .= "            \$headers = getallheaders();\n";
        $code .= "            foreach (\$headers as \$k => \$v) {\n";
        $code .= "                if (strtolower(\$k) === 'x-vexors-token') return trim(\$v);\n";
        $code .= "                if (strtolower(\$k) === 'x-validar-seguranca-token') return trim(\$v);\n";
        $code .= "            }\n";
        $code .= "        }\n";
        $code .= "        return null;\n";
        $code .= "    }\n";
        $code .= "}\n\n";

        // Permission check
        $code .= "if (!function_exists('vs_fixes_check_rest_permission')) {\n";
        $code .= "    function vs_fixes_check_rest_permission(\$request = null) {\n";
        $code .= "        if (function_exists('current_user_can') && current_user_can('manage_options')) {\n";
        $code .= "            return true;\n";
        $code .= "        }\n";
        $code .= "        \$incoming = vs_fixes_get_token_from_request(\$request);\n";
        $code .= "        \$saved    = trim((string) get_option('vs_agent_token'));\n";
        $code .= "        if (!empty(\$incoming)) {\n";
        $code .= "            if (!empty(\$saved) && hash_equals(\$saved, \$incoming)) {\n";
        $code .= "                return true;\n";
        $code .= "            }\n";
        $code .= "            if (defined('VS_FIXES_SITE_TOKEN') && !empty(VS_FIXES_SITE_TOKEN) && hash_equals(VS_FIXES_SITE_TOKEN, \$incoming)) {\n";
        $code .= "                if (empty(\$saved)) {\n";
        $code .= "                    update_option('vs_agent_token', VS_FIXES_SITE_TOKEN);\n";
        $code .= "                }\n";
        $code .= "                return true;\n";
        $code .= "            }\n";
        $code .= "        }\n";
        $code .= "        return new \\WP_Error('rest_forbidden', 'Token de autenticação do agente inválido ou ausente.', array('status' => 403));\n";
        $code .= "    }\n";
        $code .= "}\n\n";

        // Filter rest_authentication_errors (priority 99)
        $code .= "add_filter('rest_authentication_errors', function(\$result) {\n";
        $code .= "    \$route = isset(\$_SERVER['REQUEST_URI']) ? \$_SERVER['REQUEST_URI'] : '';\n";
        $code .= "    if (strpos(\$route, '/fixes') !== false || strpos(\$route, 'fixes') !== false) {\n";
        $code .= "        \$incoming = vs_fixes_get_token_from_request();\n";
        $code .= "        \$saved    = trim((string) get_option('vs_agent_token'));\n";
        $code .= "        if (!empty(\$incoming)) {\n";
        $code .= "            if (!empty(\$saved) && hash_equals(\$saved, \$incoming)) {\n";
        $code .= "                return true;\n";
        $code .= "            }\n";
        $code .= "            if (defined('VS_FIXES_SITE_TOKEN') && !empty(VS_FIXES_SITE_TOKEN) && hash_equals(VS_FIXES_SITE_TOKEN, \$incoming)) {\n";
        $code .= "                return true;\n";
        $code .= "            }\n";
        $code .= "        }\n";
        $code .= "    }\n";
        $code .= "    return \$result;\n";
        $code .= "}, 99);\n\n";

        // Register routes under vexors-fixes/v1, vexors/v1, wp-patropi/v1 and validar-seguranca/v1
        $code .= "add_action('rest_api_init', function() {\n";
        $code .= "    \$namespaces = array('vexors-fixes/v1', 'vexors/v1', 'wp-patropi/v1', 'validar-seguranca/v1');\n";
        $code .= "    foreach (\$namespaces as \$ns) {\n";
        $code .= "        register_rest_route(\$ns, '/fixes', array(\n";
        $code .= "            'methods'             => array('GET', 'POST'),\n";
        $code .= "            'callback'            => 'vs_fixes_handle_rest_get',\n";
        $code .= "            'permission_callback' => 'vs_fixes_check_rest_permission',\n";
        $code .= "        ));\n";
        $code .= "        register_rest_route(\$ns, '/fixes/toggle', array(\n";
        $code .= "            'methods'             => array('POST', 'GET'),\n";
        $code .= "            'callback'            => 'vs_fixes_handle_rest_toggle',\n";
        $code .= "            'permission_callback' => 'vs_fixes_check_rest_permission',\n";
        $code .= "        ));\n";
        $code .= "    }\n";
        $code .= "});\n\n";

        // REST Callbacks
        $code .= "if (!function_exists('vs_fixes_handle_rest_get')) {\n";
        $code .= "    function vs_fixes_handle_rest_get(\$request) {\n";
        $code .= "        \$fixes    = function_exists('vs_get_registered_fixes') ? vs_get_registered_fixes() : array();\n";
        $code .= "        \$settings = vs_get_fixes_settings();\n";
        $code .= "        \$items    = array();\n";
        $code .= "        foreach (\$fixes as \$check_id => \$data) {\n";
        $code .= "            \$items[] = array(\n";
        $code .= "                'check_id'    => \$check_id,\n";
        $code .= "                'title'       => isset(\$data['title']) ? \$data['title'] : \$check_id,\n";
        $code .= "                'description' => isset(\$data['description']) ? \$data['description'] : '',\n";
        $code .= "                'active'      => vs_is_fix_active(\$check_id),\n";
        $code .= "            );\n";
        $code .= "        }\n";
        $code .= "        return new \\WP_REST_Response(array(\n";
        $code .= "            'success'   => true,\n";
        $code .= "            'installed' => true,\n";
        $code .= "            'active'    => true,\n";
        $code .= "            'version'   => defined('VS_FIXES_VERSION') ? VS_FIXES_VERSION : '1.0.1',\n";
        $code .= "            'fixes'     => \$items,\n";
        $code .= "        ), 200);\n";
        $code .= "    }\n";
        $code .= "}\n\n";

        $code .= "if (!function_exists('vs_fixes_handle_rest_toggle')) {\n";
        $code .= "    function vs_fixes_handle_rest_toggle(\$request) {\n";
        $code .= "        \$check_id = \$request->get_param('check_id');\n";
        $code .= "        \$enabled  = \$request->get_param('enabled');\n";
        $code .= "        if (\$check_id === null || \$enabled === null) {\n";
        $code .= "            \$json = \$request->get_json_params();\n";
        $code .= "            if (!empty(\$json)) {\n";
        $code .= "                if (isset(\$json['check_id'])) \$check_id = \$json['check_id'];\n";
        $code .= "                if (isset(\$json['enabled'])) \$enabled = \$json['enabled'];\n";
        $code .= "            }\n";
        $code .= "        }\n";
        $code .= "        if (empty(\$check_id)) {\n";
        $code .= "            return new \\WP_REST_Response(array(\n";
        $code .= "                'success' => false,\n";
        $code .= "                'message' => 'Parâmetro check_id obrigatório.',\n";
        $code .= "            ), 400);\n";
        $code .= "        }\n";
        $code .= "        \$enabled_bool = filter_var(\$enabled, FILTER_VALIDATE_BOOLEAN);\n";
        $code .= "        vs_set_fix_status(\$check_id, \$enabled_bool);\n";
        $code .= "        return new \\WP_REST_Response(array(\n";
        $code .= "            'success'  => true,\n";
        $code .= "            'check_id' => \$check_id,\n";
        $code .= "            'active'   => \$enabled_bool,\n";
        $code .= "            'message'  => 'Status da correção atualizado com sucesso.',\n";
        $code .= "        ), 200);\n";
        $code .= "    }\n";
        $code .= "}\n\n";

        return $code;
    }

    protected function buildNativeRemediationPlugin(array $pluginFixes, $website): string
    {
        $websiteUrl = is_array($website) ? ($website['url'] ?? '') : (string)$website;
        $siteHost   = parse_url($websiteUrl, PHP_URL_HOST) ?: 'wordpress-site';
        $authorName = BrandingService::AUTHOR_NAME;
        $authorUri  = BrandingService::AUTHOR_URI;

        $code = "<?php\n";
        $code .= "/**\n";
        $code .= " * Plugin Name: vexors.app - Fixes - {$siteHost}\n";
        $code .= " * Plugin URI: https://vexors.app\n";
        $code .= " * Description: Plugin customizado de remediação e blindagem de segurança gerado pela plataforma vexors.app.\n";
        $code .= " * Version: 1.0.1\n";
        $code .= " * Author: vexors.app\n";
        $code .= " * Author URI: https://vexors.app\n";
        $code .= " * Text Domain: vexors-fixes\n";
        $code .= " */\n\n";
        $code .= "if (!defined('ABSPATH')) {\n    exit;\n}\n\n";

        // Inclui infraestrutura completa de REST API, Tokens e Handlers
        $code .= $this->getRemediationInfrastructurePhp($website, $pluginFixes);

        $code .= "// --- LINK DE CONFIGURAÇÕES NA TELA DE PLUGINS ---\n";
        $code .= "add_filter('plugin_action_links_' . plugin_basename(__FILE__), function(\$links) {\n";
        $code .= "    \$settings_link = '<a href=\"' . esc_url(admin_url('admin.php?page=vexors-fixes')) . '\">Configurações</a>';\n";
        $code .= "    array_unshift(\$links, \$settings_link);\n";
        $code .= "    return \$links;\n";
        $code .= "});\n\n";

        // Fix execution conditional on vs_is_fix_active
        $code .= "// --- APLICAÇÃO CONDICIONAL DAS REGRAS DE REMEDIAÇÃO ---\n\n";
        foreach ($pluginFixes as $fix) {
            $cid     = $fix['check_id'] ?? '';
            $snippet = trim($fix['fix_code_snippet'] ?? '');
            if (!empty($snippet)) {
                $snippetClean = preg_replace('/^<\?php\s*/i', '', $snippet);
                $code .= "// Check: {$fix['solution_title']} (ID: {$cid})\n";
                $code .= "if (vs_is_fix_active('{$cid}')) {\n";
                $code .= "    try {\n";
                foreach (explode("\n", $snippetClean) as $line) {
                    $code .= "        " . $line . "\n";
                }
                $code .= "    } catch (\\Throwable \$e) {}\n";
                $code .= "}\n\n";
            }
        }

        // Admin interface
        $code .= "// --- INTERFACE DE CONFIGURAÇÃO NO PAINEL WP ADMIN ---\n";
        $code .= "add_action('admin_head', function() {\n";
        $code .= "    echo '<style>#adminmenu .toplevel_page_vexors-app .wp-menu-image img, #adminmenu #toplevel_page_vexors-app .wp-menu-image img, #adminmenu .toplevel_page_wp-patropi .wp-menu-image img, #adminmenu #toplevel_page_wp-patropi .wp-menu-image img { max-width: 20px !important; max-height: 20px !important; width: 20px !important; height: 20px !important; padding: 3px 0 0 0 !important; object-fit: contain !important; box-sizing: border-box !important; }</style>';\n";
        $code .= "});\n\n";

        $code .= "add_action('admin_menu', function() {\n";
        $code .= "    \$parent_slug = 'vexors-app';\n";
        $code .= "    \$icon_url    = plugins_url('assets/favicon.png', __FILE__);\n";
        $code .= "    if (empty(\$GLOBALS['admin_page_hooks'][\$parent_slug])) {\n";
        $code .= "        add_menu_page('vexors.app', 'vexors.app', 'manage_options', \$parent_slug, 'vs_render_remediation_admin_page', \$icon_url, 80);\n";
        $code .= "    }\n";
        $code .= "    add_submenu_page(\$parent_slug, 'Fixes', 'Fixes', 'manage_options', 'vexors-fixes', 'vs_render_remediation_admin_page');\n";
        $code .= "    add_submenu_page(null, 'vexors.app Fixes', 'vexors.app Fixes', 'manage_options', 'wp-patropi-fixes', 'vs_render_remediation_admin_page');\n";
        $code .= "}, 20);\n\n";

        $code .= "if (!function_exists('vs_render_remediation_admin_page')) {\n";
        $code .= "    function vs_render_remediation_admin_page() {\n";
        $code .= "        if (!current_user_can('manage_options')) {\n";
        $code .= "            return;\n";
        $code .= "        }\n\n";
        $code .= "        \$fixes = vs_get_registered_fixes();\n";
        $code .= "        \$settings = vs_get_fixes_settings();\n";
        $code .= "        \$notice = '';\n\n";
        $code .= "        if (isset(\$_POST['vs_fixes_save_nonce']) && wp_verify_nonce(\$_POST['vs_fixes_save_nonce'], 'vs_save_fixes_action')) {\n";
        $code .= "            \$new_settings = array();\n";
        $code .= "            foreach (\$fixes as \$check_id => \$info) {\n";
        $code .= "                \$new_settings[\$check_id] = isset(\$_POST['vs_fix_' . \$check_id]);\n";
        $code .= "            }\n";
        $code .= "            update_option('vexors_fixes_settings', \$new_settings);\n";
        $code .= "            update_option('wp_patropi_fixes_settings', \$new_settings);\n";
        $code .= "            \$settings = \$new_settings;\n";
        $code .= "            \$notice = '<div class=\"notice notice-success is-dismissible\" style=\"margin: 15px 0 20px 0;\"><p><strong>Configurações de correções salvas com sucesso!</strong></p></div>';\n";
        $code .= "        }\n\n";
        $code .= "        \$logo_url = file_exists(plugin_dir_path(__FILE__) . 'assets/vexors-logo-dark.svg') ? plugins_url('assets/vexors-logo-dark.svg', __FILE__) : plugins_url('assets/vexors-logo.svg', __FILE__);\n";
        $code .= "        echo '<div class=\"wrap\">';\n";
        $code .= "        echo '<h1 class=\"wp-heading-inline\" style=\"display:none;\">vexors.app - Fixes</h1>';\n";
        $code .= "        echo '<hr class=\"wp-header-end\" style=\"display:none;\" />';\n";
        $code .= "        if (\$notice) echo \$notice;\n";
        $code .= "        echo '<div style=\"display: flex; align-items: center; justify-content: space-between; margin: 15px 0; background: #fff; padding: 15px 20px; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);\">';\n";
        $code .= "        echo '  <div style=\"display: flex; align-items: center; gap: 15px;\">';\n";
        $code .= "        echo '    <img src=\"' . esc_url(\$logo_url) . '\" alt=\"vexors.app\" style=\"max-height: 42px; height: 42px; width: auto; object-fit: contain;\" onerror=\"this.style.display=\\'none\\';\" />';\n";
        $code .= "        echo '    <div>';\n";
        $code .= "        echo '      <h2 style=\"margin: 0; font-size: 20px; font-weight: 700; color: #1e293b;\">vexors.app - Fixes</h2>';\n";
        $code .= "        echo '      <p style=\"margin: 2px 0 0 0; font-size: 12px; color: #64748b;\">Desenvolvido por <strong>vexors.app</strong> (<a href=\"https://vexors.app\" target=\"_blank\" style=\"color: #1A7F86; text-decoration: none;\">vexors.app</a>)</p>';\n";
        $code .= "        echo '    </div>';\n";
        $code .= "        echo '  </div>';\n";
        $code .= "        echo '</div>';\n";
        $code .= "        echo '<style>';\n";
        $code .= "        echo '.vs-switch { position: relative; display: inline-block; width: 44px; height: 24px; vertical-align: middle; }';\n";
        $code .= "        echo '.vs-switch input { opacity: 0; width: 0; height: 0; margin: 0; }';\n";
        $code .= "        echo '.vs-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .25s ease; border-radius: 24px; }';\n";
        $code .= "        echo '.vs-slider:before { position: absolute; content: \"\"; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .25s ease; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }';\n";
        $code .= "        echo 'input:checked + .vs-slider { background-color: #10B981; }';\n";
        $code .= "        echo 'input:checked + .vs-slider:before { transform: translateX(20px); }';\n";
        $code .= "        echo '</style>';\n";
        $code .= "        echo '<form method=\"post\">';\n";
        $code .= "        wp_nonce_field('vs_save_fixes_action', 'vs_fixes_save_nonce');\n";
        $code .= "        echo '<table class=\"widefat fixed striped\" style=\"background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);border:1px solid #e2e8f0;\">';\n";
        $code .= "        echo '<thead><tr><th style=\"width:100px;text-align:center;\">Status</th><th>Correção / Funcionalidade</th><th style=\"width:220px;\">ID do Teste</th></tr></thead><tbody>';\n";
        $code .= "        foreach (\$fixes as \$check_id => \$info) {\n";
        $code .= "            \$is_active = vs_is_fix_active(\$check_id);\n";
        $code .= "            echo '<tr>';\n";
        $code .= "            echo '<td style=\"text-align:center;vertical-align:middle;\"><label class=\"vs-switch\"><input type=\"checkbox\" name=\"vs_fix_' . esc_attr(\$check_id) . '\" value=\"1\" ' . checked(\$is_active, true, false) . ' /><span class=\"vs-slider\"></span></label></td>';\n";
        $code .= "            echo '<td style=\"vertical-align:middle;\"><strong>' . esc_html(\$info['title']) . '</strong><br /><span style=\"color:#64748b;font-size:12px;\">' . esc_html(\$info['description']) . '</span></td>';\n";
        $code .= "            echo '<td style=\"vertical-align:middle;\"><code>' . esc_html(\$check_id) . '</code></td>';\n";
        $code .= "            echo '</tr>';\n";
        $code .= "        }\n";
        $code .= "        echo '</tbody></table>';\n";
        $code .= "        echo '<p style=\"margin-top:20px;\"><input type=\"submit\" class=\"button button-primary\" value=\"Salvar Alterações\" style=\"padding:6px 20px;height:auto;font-size:14px;background:#1A7F86;border-color:#1A7F86;\" /></p>';\n";
        $code .= "        echo '</form></div>';\n";
        $code .= "    }\n";
        $code .= "}\n";

        return $code;
    }
}
