<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class FixSubscriptionCycleDates extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('subscriptions')) {
            // Corrige assinaturas mensais que estavam gravadas incorretamente com ciclo anual (+1 ano)
            // Para assinaturas mensais com current_period_end > 35 dias no futuro:
            // Define current_period_end para 30 dias a partir da data de início ou a partir de agora
            $now = date('Y-m-d H:i:s');
            $in30Days = date('Y-m-d H:i:s', strtotime('+30 days'));

            $this->db->query("
                UPDATE subscriptions 
                SET current_period_end = CASE 
                    WHEN current_period_start IS NOT NULL AND DATE_ADD(current_period_start, INTERVAL 30 DAY) > '{$now}'
                        THEN DATE_ADD(current_period_start, INTERVAL 30 DAY)
                    WHEN created_at IS NOT NULL AND DATE_ADD(created_at, INTERVAL 30 DAY) > '{$now}'
                        THEN DATE_ADD(created_at, INTERVAL 30 DAY)
                    ELSE '{$in30Days}'
                END
                WHERE billing_cycle = 'monthly'
                  AND current_period_end > DATE_ADD(NOW(), INTERVAL 35 DAY)
            ");
        }
    }

    public function down()
    {
        // Operação de saneamento de dados irreversível
    }
}
