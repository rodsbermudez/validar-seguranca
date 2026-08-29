<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\SolutionCatalogModel;
use App\Models\ScanHistoryModel;
use App\Services\AIService;

class SolutionCatalog extends ResourceController
{
    protected $format = 'json';

    protected function checkAdminPermission()
    {
        $userData = $this->request->userData ?? null;
        if (($userData->role ?? 'user') !== 'admin') {
            return false;
        }
        return true;
    }

    /**
     * GET /api/solutions
     * Returns all cataloged solutions indexed by check_id
     */
    public function index()
    {
        $catalogModel = new SolutionCatalogModel();
        $solutions = $catalogModel->orderBy('created_at', 'DESC')->findAll();

        $byCheckId = [];
        foreach ($solutions as $sol) {
            $byCheckId[$sol['check_id']] = $sol;
        }

        return $this->respond([
            'status' => 200,
            'data'   => $solutions,
            'by_check_id' => $byCheckId,
        ]);
    }

    /**
     * PUT /api/solutions/(:num)
     * Update catalog entry manually (Admin only)
     */
    public function update($id = null)
    {
        if (!$this->checkAdminPermission()) {
            return $this->failForbidden('Apenas administradores podem gerenciar o catálogo de soluções.');
        }

        if (!$id) {
            return $this->fail('ID não fornecido.', 400);
        }

        $catalogModel = new SolutionCatalogModel();
        $existing = $catalogModel->find($id);
        if (!$existing) {
            return $this->failNotFound('Solução não encontrada.');
        }

        $json = $this->request->getJSON(true) ?: $this->request->getRawInput();

        $updateData = [];
        if (isset($json['solution_title'])) $updateData['solution_title'] = trim($json['solution_title']);
        if (isset($json['action_type'])) $updateData['action_type'] = $json['action_type'];
        if (isset($json['problem_description'])) $updateData['problem_description'] = trim($json['problem_description']);
        if (isset($json['solution_instructions'])) $updateData['solution_instructions'] = trim($json['solution_instructions']);
        if (isset($json['fix_code_snippet'])) $updateData['fix_code_snippet'] = trim($json['fix_code_snippet']);
        if (isset($json['ai_notes'])) $updateData['ai_notes'] = trim($json['ai_notes']);

        // Strict triaging: clear snippet if action_type is not PLUGIN_AUTO_FIX
        if (isset($updateData['action_type']) && $updateData['action_type'] !== 'PLUGIN_AUTO_FIX') {
            $updateData['fix_code_snippet'] = null;
        }

        $catalogModel->update($id, $updateData);

        return $this->respond([
            'status'  => 200,
            'message' => 'Solução atualizada com sucesso.',
            'data'    => $catalogModel->find($id),
        ]);
    }

    /**
     * POST /api/solutions/generate-single
     * Generate AI solution for a single check (Admin only)
     */
    public function generateSingle()
    {
        @set_time_limit(120);
        if (!$this->checkAdminPermission()) {
            return $this->failForbidden('Apenas administradores podem solicitar geração de soluções com IA.');
        }

        $json = $this->request->getJSON(true) ?: [];
        $checkId   = $json['check_id'] ?? null;
        $checkName = $json['check_name'] ?? 'Checagem de Segurança';
        $details   = $json['details'] ?? '';
        $severity  = $json['severity'] ?? 'medium';
        $apiKey    = $json['api_key'] ?? null;

        if (empty($checkId)) {
            return $this->fail('check_id é obrigatório.', 400);
        }

        try {
            $aiService = new AIService($apiKey);
            $generated = $aiService->generateSolutionForCheck([
                'check_id'   => $checkId,
                'check_name' => $checkName,
                'details'    => $details,
                'severity'   => $severity,
            ]);

            $catalogModel = new SolutionCatalogModel();
            $existing = $catalogModel->getByCheckId($checkId);

            if ($existing) {
                $catalogModel->update($existing['id'], $generated);
                $saved = $catalogModel->find($existing['id']);
            } else {
                $insertedId = $catalogModel->insert($generated);
                $saved = $catalogModel->find($insertedId);
            }

            return $this->respond([
                'status'  => 200,
                'message' => "Solução para '{$checkName}' gerada e salva no catálogo com sucesso.",
                'data'    => $saved,
            ]);
        } catch (\Exception $e) {
            return $this->failServerError("Falha na geração da solução com IA: " . $e->getMessage());
        }
    }

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
     * POST /api/solutions/generate-batch
     * Generate AI solutions for all failed checks in a scan (Admin only)
     */
    public function generateBatch()
    {
        @set_time_limit(600);
        if (!$this->checkAdminPermission()) {
            return $this->failForbidden('Apenas administradores podem solicitar geração em lote de soluções.');
        }

        $json   = $this->request->getJSON(true) ?: [];
        $scanId = $json['scan_id'] ?? null;
        $apiKey = $json['api_key'] ?? null;
        $force  = !empty($json['force']); // If true, regenerate even if existing in catalog

        if (!$scanId) {
            return $this->fail('scan_id é obrigatório.', 400);
        }

        $scanModel = new ScanHistoryModel();
        $scan = $scanModel->find($scanId);
        if (!$scan || empty($scan['scan_results_json'])) {
            return $this->failNotFound('Relatório de varredura não encontrado ou sem resultados.');
        }

        $scanResults = json_decode($scan['scan_results_json'], true);
        if (!is_array($scanResults)) {
            return $this->fail('Estrutura de resultados do scan é inválida.', 400);
        }

        $allChecks = $this->extractAllChecks($scanResults);
        if (empty($allChecks)) {
            return $this->fail('Nenhum teste de segurança encontrado neste relatório.', 400);
        }

        // Collect all failed / alert checks
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
                'message' => 'Nenhuma falha encontrada nesta varredura para gerar soluções.',
                'processed' => 0,
                'items'   => [],
            ]);
        }

        $catalogModel = new SolutionCatalogModel();
        $aiService    = new AIService($apiKey);

        $processedItems = [];
        $errors = [];

        foreach ($failedChecks as $check) {
            $checkId   = $check['id'] ?? ($check['check_id'] ?? null);
            $checkName = $check['name'] ?? ($check['check_name'] ?? 'Teste de Segurança');
            $details   = $check['details'] ?? ($check['message'] ?? '');
            $severity  = $check['severity'] ?? 'medium';

            if (!$checkId) continue;

            $existing = $catalogModel->getByCheckId($checkId);
            if ($existing && !$force) {
                // Already in catalog and force is false
                $processedItems[] = [
                    'check_id' => $checkId,
                    'status'   => 'skipped_existing',
                    'title'    => $existing['solution_title'],
                ];
                continue;
            }

            try {
                // 1 cURL request per check for isolated AI analysis
                $generated = $aiService->generateSolutionForCheck([
                    'check_id'   => $checkId,
                    'check_name' => $checkName,
                    'details'    => $details,
                    'severity'   => $severity,
                ]);

                if ($existing) {
                    $catalogModel->update($existing['id'], $generated);
                    $saved = $catalogModel->find($existing['id']);
                } else {
                    $insertedId = $catalogModel->insert($generated);
                    $saved = $catalogModel->find($insertedId);
                }

                $processedItems[] = [
                    'check_id'    => $checkId,
                    'status'      => 'generated',
                    'action_type' => $saved['action_type'],
                    'title'       => $saved['solution_title'],
                ];
            } catch (\Exception $e) {
                $errors[] = [
                    'check_id' => $checkId,
                    'error'    => $e->getMessage(),
                ];
            }
        }

        $generatedCount = count(array_filter($processedItems, fn($i) => ($i['status'] ?? '') === 'generated'));
        $existingCount  = count(array_filter($processedItems, fn($i) => ($i['status'] ?? '') === 'skipped_existing'));
        $totalProcessed = count($processedItems);

        $msg = "Processamento em lote concluído: {$totalProcessed} item(ns) analisado(s)";
        if ($generatedCount > 0 && $existingCount > 0) {
            $msg .= " ({$generatedCount} gerado(s) via IA Kimi K2.7 Code e {$existingCount} reutilizado(s) do catálogo).";
        } elseif ($generatedCount > 0) {
            $msg .= " ({$generatedCount} solução(ões) gerada(s) via IA Kimi K2.7 Code).";
        } else {
            $msg .= " ({$existingCount} solução(ões) já existente(s) e ativas no catálogo).";
        }

        return $this->respond([
            'status'    => 200,
            'message'   => $msg,
            'processed' => $totalProcessed,
            'generated' => $generatedCount,
            'existing'  => $existingCount,
            'items'     => $processedItems,
            'errors'    => $errors,
        ]);
    }
}
