<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Services\PlatformErrorLogger;

class SyncAiErrors extends BaseCommand
{
    protected $group       = 'Errors';
    protected $name        = 'errors:sync-ai-logs';
    protected $description = 'Sincroniza erros históricos de IA da tabela ai_usage_logs para a central platform_error_logs';
    protected $usage       = 'errors:sync-ai-logs';

    public function run(array $params)
    {
        CLI::write('Iniciando sincronização de falhas de IA...', 'yellow');

        $synced = PlatformErrorLogger::syncHistoricalAiErrors();

        if ($synced > 0) {
            CLI::write("✓ Sincronização concluída: {$synced} incidentes de IA foram importados para a Central de Erros da Plataforma!", 'green');
        } else {
            CLI::write('✓ Todos os registros de falha da IA já se encontram sincronizados com a Central de Erros.', 'cyan');
        }
    }
}
