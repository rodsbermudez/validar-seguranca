<?php

namespace App\Models;

use CodeIgniter\Model;

class WebsiteMaintenanceModel extends Model
{
    protected $table            = 'website_maintenances';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'website_id',
        'user_id',
        'year_month',
        'completed_at',
        'notes',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Busca a manutenção de um website em um mês específico (YYYY-MM).
     */
    public function getMaintenanceForMonth(int $websiteId, string $yearMonth): ?array
    {
        return $this->where('website_id', $websiteId)
                    ->where('year_month', $yearMonth)
                    ->first();
    }

    /**
     * Marca ou atualiza a manutenção do mês como concluída.
     */
    public function completeMaintenance(int $websiteId, int $userId, string $yearMonth, ?string $notes = null): array
    {
        $existing = $this->getMaintenanceForMonth($websiteId, $yearMonth);
        $data = [
            'website_id'   => $websiteId,
            'user_id'      => $userId,
            'year_month'   => $yearMonth,
            'completed_at' => date('Y-m-d H:i:s'),
            'notes'        => $notes ? trim($notes) : ($existing['notes'] ?? null),
        ];

        if ($existing) {
            $this->update($existing['id'], $data);
            $recordId = (int)$existing['id'];
        } else {
            $recordId = (int)$this->insert($data);
        }

        return $this->find($recordId);
    }

    /**
     * Desmarca a manutenção do mês.
     */
    public function uncompleteMaintenance(int $websiteId, string $yearMonth): bool
    {
        $existing = $this->getMaintenanceForMonth($websiteId, $yearMonth);
        if ($existing) {
            return $this->delete($existing['id']);
        }
        return false;
    }

    /**
     * Retorna o histórico de manutenções de um website com dados do usuário que executou.
     */
    public function getHistory(int $websiteId, int $limit = 12): array
    {
        return $this->select('website_maintenances.*, users.name as user_name, users.email as user_email')
                    ->join('users', 'users.id = website_maintenances.user_id', 'left')
                    ->where('website_maintenances.website_id', $websiteId)
                    ->orderBy('website_maintenances.year_month', 'DESC')
                    ->limit($limit)
                    ->findAll();
    }

    /**
     * Calcula o status de manutenção para determinado mês/dia.
     * Retorna: 'completed', 'overdue', 'today', 'upcoming', 'not_scheduled'.
     */
    public static function calculateStatus(?int $maintenanceDay, ?array $maintenanceRecord, ?string $yearMonth = null): array
    {
        $yearMonth = $yearMonth ?: date('Y-m');
        $currentYearMonth = date('Y-m');

        if (!empty($maintenanceRecord)) {
            return [
                'status'         => 'completed',
                'label'          => 'Concluída',
                'badge_color'    => 'green',
                'completed_at'   => $maintenanceRecord['completed_at'] ?? null,
                'completed_by'   => $maintenanceRecord['user_name'] ?? ($maintenanceRecord['user_email'] ?? null),
                'notes'          => $maintenanceRecord['notes'] ?? null,
                'target_day'     => $maintenanceDay,
                'year_month'     => $yearMonth,
            ];
        }

        if (empty($maintenanceDay)) {
            return [
                'status'         => 'not_scheduled',
                'label'          => 'Sem Agendamento',
                'badge_color'    => 'gray',
                'completed_at'   => null,
                'completed_by'   => null,
                'notes'          => null,
                'target_day'     => null,
                'year_month'     => $yearMonth,
            ];
        }

        // Calcula dia efetivo ajustando para o tamanho real do mês (ex: 28/29 dias em fevereiro)
        $daysInMonth = (int)date('t', strtotime("{$yearMonth}-01"));
        $effectiveDay = min((int)$maintenanceDay, $daysInMonth);
        $targetDate = sprintf('%s-%02d', $yearMonth, $effectiveDay);
        $currentDay = (int)date('j');

        if ($yearMonth < $currentYearMonth) {
            return [
                'status'         => 'overdue',
                'label'          => 'Atrasada',
                'badge_color'    => 'red',
                'completed_at'   => null,
                'completed_by'   => null,
                'notes'          => null,
                'target_day'     => $effectiveDay,
                'target_date'    => $targetDate,
                'year_month'     => $yearMonth,
            ];
        }

        if ($yearMonth > $currentYearMonth) {
            return [
                'status'         => 'upcoming',
                'label'          => 'Agendada',
                'badge_color'    => 'blue',
                'completed_at'   => null,
                'completed_by'   => null,
                'notes'          => null,
                'target_day'     => $effectiveDay,
                'target_date'    => $targetDate,
                'year_month'     => $yearMonth,
            ];
        }

        // Mês atual
        if ($currentDay > $effectiveDay) {
            $daysLate = $currentDay - $effectiveDay;
            return [
                'status'         => 'overdue',
                'label'          => "Atrasada ({$daysLate}d)",
                'badge_color'    => 'red',
                'completed_at'   => null,
                'completed_by'   => null,
                'notes'          => null,
                'target_day'     => $effectiveDay,
                'target_date'    => $targetDate,
                'year_month'     => $yearMonth,
            ];
        }

        if ($currentDay === $effectiveDay) {
            return [
                'status'         => 'today',
                'label'          => 'Hoje!',
                'badge_color'    => 'yellow',
                'completed_at'   => null,
                'completed_by'   => null,
                'notes'          => null,
                'target_day'     => $effectiveDay,
                'target_date'    => $targetDate,
                'year_month'     => $yearMonth,
            ];
        }

        $daysRemaining = $effectiveDay - $currentDay;
        return [
            'status'         => 'upcoming',
            'label'          => "Em {$daysRemaining}d",
            'badge_color'    => 'blue',
            'completed_at'   => null,
            'completed_by'   => null,
            'notes'          => null,
            'target_day'     => $effectiveDay,
            'target_date'    => $targetDate,
            'year_month'     => $yearMonth,
        ];
    }
}
