<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\WebsiteModel;
use App\Models\ScanHistoryModel;
use App\Models\SolutionCatalogModel;
use App\Services\AIService;
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

        if ($website['user_id'] != $effectiveUserId && ($userData->role ?? 'user') !== 'admin') {
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

        try {
            $aiService = new AIService($apiKey);
            $pluginCode = $aiService->generateRemediationPlugin($pluginFixableSolutions, $website['url'], $customPrompt);
        } catch (\Exception $e) {
            // Fallback to native deterministic PHP plugin generation if AI times out or is unavailable
            $pluginCode = $this->buildNativeRemediationPlugin($pluginFixableSolutions, $website['url']);
        }

        try {
            // Package into ZIP
            $siteHost = parse_url($website['url'], PHP_URL_HOST) ?: 'site';
            $siteSlug = preg_replace('/[^a-zA-Z0-9_\-]/', '-', $siteHost);
            $zipFilename = "validar-seguranca-fix-{$siteSlug}.zip";

            $tempDir = WRITEPATH . 'uploads/temp_remediation/';
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            $zipPath = $tempDir . 'fix_' . uniqid() . '.zip';

            $zip = new ZipArchive();
            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                return $this->failServerError('Não foi possível criar o arquivo ZIP de remediação.');
            }

            $pluginDirName = 'validar-seguranca-fix';
            $zip->addFromString("{$pluginDirName}/validar-seguranca-fix.php", $pluginCode);

            // Create Readme.txt
            $readmeText = "====================================================\n" .
                "VALIDAR SEGURANÇA - PLUGIN CUSTOMIZADO DE REMEDIAÇÃO\n" .
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
                "Após a ativação, re-execute a varredura na plataforma Validar Segurança para confirmar o sanamento das falhas.\n";

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
        $json      = $this->request->getJSON(true) ?: [];
        $scanId    = $json['scan_id'] ?? null;
        $websiteId = $json['website_id'] ?? null;
        $apiKey    = $json['api_key'] ?? null;

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);
        $userData        = $this->request->userData ?? null;

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

        if ($website['user_id'] != $effectiveUserId && ($userData->role ?? 'user') !== 'admin') {
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

        // Check if we already have a saved guide in scanResults
        if (!$forceRefresh && !empty($scanResults['server_guide_html'])) {
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

        try {
            $aiService = new AIService($apiKey);
            $guideHtml = $aiService->generateServerGuide($serverFixableItems, $website['url']);
        } catch (\Exception $e) {
            // Fallback to rich built-in template HTML guide if AI is unreachable or API key missing
            $guideHtml = $this->buildFallbackServerGuideHtml($serverFixableItems, $website['url']);
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

    protected function buildNativeRemediationPlugin(array $pluginFixes, string $websiteUrl): string
    {
        $siteHost = parse_url($websiteUrl, PHP_URL_HOST) ?: 'wordpress-site';
        $siteHostClean = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $siteHost);

        $code = "<?php\n";
        $code .= "/**\n";
        $code .= " * Plugin Name: Validar Segurança Fix - {$siteHost}\n";
        $code .= " * Description: Plugin customizado de remediação de segurança gerado pela plataforma Validar Segurança.\n";
        $code .= " * Version: 1.0.0\n";
        $code .= " * Author: Validar Segurança\n";
        $code .= " */\n\n";
        $code .= "if (!defined('ABSPATH')) {\n    exit;\n}\n\n";

        $code .= "// --- APLICAÇÃO DIRETA DAS REGRAS DE REMEDIAÇÃO DE SEGURANÇA ---\n\n";

        foreach ($pluginFixes as $fix) {
            $snippet = trim($fix['fix_code_snippet'] ?? '');
            if (!empty($snippet)) {
                $snippetClean = preg_replace('/^<\?php\s*/i', '', $snippet);
                $code .= "// Check: {$fix['solution_title']} (ID: {$fix['check_id']})\n";
                $code .= "try {\n";
                foreach (explode("\n", $snippetClean) as $line) {
                    $code .= "    " . $line . "\n";
                }
                $code .= "} catch (\\Throwable \$e) {}\n\n";
            }
        }

        $code .= "// --- INTERFACE DE VISUALIZAÇÃO NO PAINEL WP ADMIN ---\n";
        $code .= "add_action('admin_menu', function() {\n";
        $code .= "    add_menu_page('Validar Segurança', 'Validar Segurança', 'manage_options', 'validar-seguranca-fix', 'vs_render_remediation_admin_page', 'dashicons-shield', 80);\n";
        $code .= "});\n\n";

        $code .= "if (!function_exists('vs_render_remediation_admin_page')) {\n";
        $code .= "    function vs_render_remediation_admin_page() {\n";
        $code .= "        echo '<div class=\"wrap\"><h1>Shield - Correções de Segurança Ativas</h1><p>Este plugin foi gerado pela plataforma Validar Segurança para o site <strong>" . htmlspecialchars($siteHost) . "</strong>.</p>';\n";
        $code .= "        echo '<table class=\"widefat fixed striped\"><thead><tr><th>ID da Verificação</th><th>Correção</th><th>Status</th></tr></thead><tbody>';\n";
        foreach ($pluginFixes as $fix) {
            $code .= "        echo '<tr><td><code>" . htmlspecialchars($fix['check_id']) . "</code></td><td><strong>" . htmlspecialchars($fix['solution_title']) . "</strong></td><td><span style=\"background:#10B981;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;\">Ativo</span></td></tr>';\n";
        }
        $code .= "        echo '</tbody></table></div>';\n";
        $code .= "    }\n";
        $code .= "}\n";

        return $code;
    }
}
