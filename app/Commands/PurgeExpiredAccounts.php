<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Models\UserModel;
use App\Models\WebsiteModel;

class PurgeExpiredAccounts extends BaseCommand
{
    protected $group       = 'Accounts';
    protected $name        = 'accounts:purge-expired';
    protected $description = 'Expurga sites e dados operacionais de contas cuja carência de 90 dias expirou, preservando métricas de IA e financeiras';

    public function run(array $params)
    {
        $now = date('Y-m-d H:i:s');
        CLI::write("===> Iniciando verificação de carências de 90 dias expiradas: {$now}", 'yellow');

        $userModel = new UserModel();
        $expiredUsers = $userModel
            ->where('account_status', 'pending_deletion')
            ->where('deletion_scheduled_at <=', $now)
            ->findAll();

        if (empty($expiredUsers)) {
            CLI::write("Nenhuma conta com carência de 90 dias expirada no momento.", 'green');
            return;
        }

        $websiteModel = new WebsiteModel();
        $db = \Config\Database::connect();

        $purgedCount = 0;
        foreach ($expiredUsers as $user) {
            $userId = (int) $user['id'];
            $email = $user['email'];
            CLI::write("Processando expurgo da conta #{$userId} ({$email})...", 'cyan');

            $db->transStart();
            try {
                // 1. Localizar e deletar sites do usuário e dados operacionais
                $websites = $websiteModel->where('user_id', $userId)->findAll();
                $deletedSitesCount = 0;

                foreach ($websites as $ws) {
                    $wsId = (int) $ws['id'];
                    // Exclui dependências do site
                    $db->table('scan_history')->where('website_id', $wsId)->delete();
                    $db->table('website_shares')->where('website_id', $wsId)->delete();
                    $db->table('website_notes')->where('website_id', $wsId)->delete();
                    
                    // Exclui o site em si
                    $websiteModel->delete($wsId);
                    $deletedSitesCount++;
                }

                // 2. Atualizar a conta do usuário como 'purged' (NUNCA deletar a linha de users)
                // Isso preserva ai_usage_logs (que tem foreign key para users.id) e faturas/pagamentos
                $userModel->update($userId, [
                    'account_status' => 'purged',
                    'purged_at'      => date('Y-m-d H:i:s'),
                    'is_active'      => 0,
                ]);

                $db->transComplete();

                if ($db->transStatus() === false) {
                    CLI::error("✗ Falha na transação ao expurgar conta #{$userId} ({$email})");
                } else {
                    $purgedCount++;
                    CLI::write("✓ Conta #{$userId} ({$email}) purgada com sucesso. {$deletedSitesCount} sites removidos. Histórico de IA e pagamentos mantidos intactos.", 'green');

                    // Registrar log de erro/auditoria da plataforma
                    try {
                        $logModel = new \App\Models\PlatformErrorLogModel();
                        $logModel->logError([
                            'error_type'    => 'audit_notice',
                            'severity'      => 'info',
                            'user_id'       => $userId,
                            'error_message' => "Expurgo de 90 dias concluído para o usuário {$email} (#{$userId}). {$deletedSitesCount} sites removidos permanentemente. Histórico de IA e pagamentos arquivados com sucesso.",
                        ]);
                    } catch (\Throwable $e) {
                        // ignore log error
                    }
                }
            } catch (\Throwable $e) {
                $db->transRollback();
                CLI::error("✗ Erro ao expurgar conta #{$userId}: " . $e->getMessage());
            }
        }

        CLI::write("===> Concluído: {$purgedCount} conta(s) purgada(s).", 'green');
    }
}
