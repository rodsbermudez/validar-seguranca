<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\PlatformErrorLogModel;
use App\Services\PlatformErrorLogger;

class PlatformErrors extends ResourceController
{
    protected $format = 'json';

    /**
     * Check if the authenticated user has administrator privileges.
     */
    protected function checkAdminPermission(): bool
    {
        $userData        = $this->request->userData ?? null;
        $isImpersonating = $this->request->isImpersonating ?? false;
        return (($userData->role ?? 'user') === 'admin') && !$isImpersonating;
    }

    /**
     * GET /api/platform-errors
     * List error logs with pagination and filters.
     */
    public function index()
    {
        if (!$this->checkAdminPermission()) {
            return $this->failForbidden('Apenas administradores podem acessar a central de logs de erros.');
        }

        // Auto-sync any unrecorded historical AI errors
        PlatformErrorLogger::syncHistoricalAiErrors();

        $logModel = new PlatformErrorLogModel();

        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(5, (int) ($this->request->getGet('per_page') ?? 25)));

        $filters = [
            'status'      => $this->request->getGet('status') ?? 'all',
            'severity'    => $this->request->getGet('severity') ?? 'all',
            'category'    => $this->request->getGet('category') ?? 'all',
            'website_id'  => $this->request->getGet('website_id') ?? 'all',
            'user_id'     => $this->request->getGet('user_id') ?? 'all',
            'http_status' => $this->request->getGet('http_status') ?? null,
            'search'      => $this->request->getGet('search') ?? null,
            'date_from'   => $this->request->getGet('date_from') ?? null,
            'date_to'     => $this->request->getGet('date_to') ?? null,
        ];

        $result = $logModel->getFilteredLogs($filters, $page, $perPage);

        return $this->respond([
            'status' => 200,
            'data'   => $result,
        ]);
    }

    /**
     * GET /api/platform-errors/metrics
     * Overview cards metrics.
     */
    public function metrics()
    {
        if (!$this->checkAdminPermission()) {
            return $this->failForbidden('Apenas administradores podem acessar métricas de erros.');
        }

        $logModel = new PlatformErrorLogModel();
        $metrics  = $logModel->getMetrics();

        return $this->respond([
            'status' => 200,
            'data'   => $metrics,
        ]);
    }

    /**
     * GET /api/platform-errors/filters
     * Distinct websites and users with errors to populate frontend filter dropdowns.
     */
    public function filters()
    {
        if (!$this->checkAdminPermission()) {
            return $this->failForbidden('Apenas administradores podem acessar opções de filtro.');
        }

        $logModel = new PlatformErrorLogModel();

        return $this->respond([
            'status' => 200,
            'data'   => [
                'websites' => $logModel->getFilterWebsites(),
                'users'    => $logModel->getFilterUsers(),
            ],
        ]);
    }

    /**
     * GET /api/platform-errors/{id}
     * Retrieve single error log details.
     */
    public function show($id = null)
    {
        if (!$this->checkAdminPermission()) {
            return $this->failForbidden('Apenas administradores podem visualizar detalhes de erro.');
        }

        if (!$id) {
            return $this->fail('ID do log não fornecido.', 400);
        }

        $logModel = new PlatformErrorLogModel();
        $log = $logModel->find($id);

        if (!$log) {
            return $this->failNotFound('Registro de log não encontrado.');
        }

        return $this->respond([
            'status' => 200,
            'data'   => $log,
        ]);
    }

    /**
     * PUT /api/platform-errors/{id}/status
     * Update log status and admin notes.
     */
    public function updateStatus($id = null)
    {
        if (!$this->checkAdminPermission()) {
            return $this->failForbidden('Apenas administradores podem alterar o status de erros.');
        }

        if (!$id) {
            return $this->fail('ID do log não fornecido.', 400);
        }

        $logModel = new PlatformErrorLogModel();
        $log = $logModel->find($id);

        if (!$log) {
            return $this->failNotFound('Registro de log não encontrado.');
        }

        $json = $this->request->getJSON(true) ?: [];
        $status     = $json['status'] ?? null;
        $adminNotes = $json['admin_notes'] ?? null;

        $validStatuses = ['unresolved', 'investigating', 'resolved', 'ignored'];
        if ($status && !in_array($status, $validStatuses, true)) {
            return $this->fail('Status inválido.', 400);
        }

        $updateData = [];
        if ($status) {
            $updateData['status'] = $status;
            if ($status === 'resolved') {
                $updateData['resolved_at'] = date('Y-m-d H:i:s');
                $updateData['resolved_by'] = $this->request->userData->id ?? null;
            } else {
                $updateData['resolved_at'] = null;
                $updateData['resolved_by'] = null;
            }
        }

        if ($adminNotes !== null) {
            $updateData['admin_notes'] = trim($adminNotes);
        }

        if (!empty($updateData)) {
            $updateData['updated_at'] = date('Y-m-d H:i:s');
            $logModel->update($id, $updateData);
        }

        return $this->respond([
            'status'  => 200,
            'message' => 'Status do log atualizado com sucesso.',
            'data'    => $logModel->find($id),
        ]);
    }

    /**
     * DELETE /api/platform-errors/clear
     * Bulk purge resolved or ignored logs older than X days.
     */
    public function clear()
    {
        if (!$this->checkAdminPermission()) {
            return $this->failForbidden('Apenas administradores podem limpar logs de erro.');
        }

        $days = (int) ($this->request->getGet('days') ?? 30);
        $threshold = date('Y-m-d H:i:s', strtotime("-{$days} days"));

        $logModel = new PlatformErrorLogModel();
        $db = \Config\Database::connect();

        $builder = $db->table('platform_error_logs')
            ->whereIn('status', ['resolved', 'ignored'])
            ->where('created_at <=', $threshold);

        $deletedCount = $builder->countAllResults(false);
        $builder->delete();

        return $this->respond([
            'status'  => 200,
            'message' => "{$deletedCount} logs antigos foram excluídos com sucesso.",
            'data'    => [
                'deleted_count' => $deletedCount,
            ],
        ]);
    }
}
