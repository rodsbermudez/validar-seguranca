<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\WebsiteModel;
use App\Models\ScanHistoryModel;
use App\Services\WordPressScanner;

class Scan extends ResourceController
{
    protected $format = 'json';

    public function trigger($websiteId = null)
    {
        if (!$websiteId) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($websiteId);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if ($website['user_id'] != $effectiveUserId && !$isAdmin) {
            return $this->failForbidden('Você não tem permissão para auditar este website.');
        }

        $scanHistoryModel = new ScanHistoryModel();

        // Create initial pending scan record
        $scanId = $scanHistoryModel->insert([
            'website_id'        => $website['id'],
            'status'            => 'running',
            'score'             => null,
            'scan_results_json' => null,
            'executed_at'       => date('Y-m-d H:i:s'),
        ]);

        // Execute scan
        try {
            $scanner = new WordPressScanner($website['url']);
            $results = $scanner->runFullScan($website);

            $scanHistoryModel->update($scanId, [
                'status'            => 'completed',
                'score'             => $results['score'],
                'scan_results_json' => json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
                'executed_at'       => date('Y-m-d H:i:s'),
            ]);

            return $this->respond([
                'status'  => 200,
                'message' => 'Varredura de segurança concluída com sucesso.',
                'data'    => [
                    'scan_id'    => $scanId,
                    'website_id' => $website['id'],
                    'score'      => $results['score'],
                    'grade'      => $results['grade'],
                    'summary'    => $results['summary'],
                    'results'    => $results,
                ]
            ]);
        } catch (\Exception $e) {
            $scanHistoryModel->update($scanId, [
                'status'            => 'failed',
                'scan_results_json' => json_encode(['error' => $e->getMessage()]),
                'executed_at'       => date('Y-m-d H:i:s'),
            ]);

            return $this->failServerError('Falha na execução do scan: ' . $e->getMessage());
        }
    }

    public function history($websiteId = null)
    {
        if (!$websiteId) {
            return $this->fail('ID do website não informado.', 400);
        }

        $effectiveUserId = $this->request->effectiveUserId ?? ($this->request->userData->id ?? null);
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        $isAdmin         = (($userData->role ?? 'user') === 'admin') && !$isImpersonating;

        $websiteModel = new WebsiteModel();
        $website = $websiteModel->find($websiteId);

        if (!$website) {
            return $this->failNotFound('Website não encontrado.');
        }

        if ($website['user_id'] != $effectiveUserId && !$isAdmin) {
            return $this->failForbidden('Você não tem permissão para visualizar este histórico.');
        }

        $scanHistoryModel = new ScanHistoryModel();
        $history = $scanHistoryModel->where('website_id', $websiteId)
                                   ->orderBy('executed_at', 'DESC')
                                   ->findAll();

        // Decode JSON results for easier frontend consumption
        foreach ($history as &$item) {
            if (!empty($item['scan_results_json'])) {
                $item['scan_results'] = json_decode($item['scan_results_json'], true);
                unset($item['scan_results_json']);
            }
        }

        return $this->respond([
            'status'  => 200,
            'website' => $website,
            'data'    => $history,
        ]);
    }
}
