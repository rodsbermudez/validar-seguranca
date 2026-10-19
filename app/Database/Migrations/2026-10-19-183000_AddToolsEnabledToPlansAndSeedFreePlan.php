<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddToolsEnabledToPlansAndSeedFreePlan extends Migration
{
    public function up()
    {
        // 1. Adicionar coluna tools_enabled na tabela plans
        if ($this->db->tableExists('plans') && !$this->db->fieldExists('tools_enabled', 'plans')) {
            $this->forge->addColumn('plans', [
                'tools_enabled' => [
                    'type'       => 'TINYINT',
                    'constraint' => 1,
                    'default'    => 1,
                    'after'      => 'price_monthly',
                ],
            ]);
        }

        // 2. Garantir que os planos pagos existentes tenham tools_enabled = 1 e ordem correta
        if ($this->db->tableExists('plans')) {
            $this->db->query("UPDATE `plans` SET `tools_enabled` = 1 WHERE `slug` != 'free'");
            $this->db->query("UPDATE `plans` SET `sort_order` = 1 WHERE `slug` = 'iniciante'");
            $this->db->query("UPDATE `plans` SET `sort_order` = 2 WHERE `slug` = 'profissional'");
            $this->db->query("UPDATE `plans` SET `sort_order` = 3 WHERE `slug` = 'full'");

            // 3. Cadastrar o Plano Free padrão caso ainda não exista
            $freePlan = $this->db->table('plans')->where('slug', 'free')->get()->getRowArray();
            if (!$freePlan) {
                $this->db->table('plans')->insert([
                    'name'              => 'Free',
                    'slug'              => 'free',
                    'description'       => 'Ideal para testar o diagnóstico e auditoria completa de segurança em 1 website.',
                    'max_websites'      => 1,
                    'ai_monthly_tokens' => 10000,
                    'price_monthly'     => 0.00,
                    'tools_enabled'     => 0,
                    'is_active'         => 1,
                    'is_default'        => 0,
                    'sort_order'        => 0,
                    'created_at'        => date('Y-m-d H:i:s'),
                    'updated_at'        => date('Y-m-d H:i:s'),
                ]);
            } else {
                $this->db->table('plans')->where('slug', 'free')->update([
                    'tools_enabled' => 0,
                    'sort_order'    => 0,
                    'price_monthly' => 0.00,
                    'max_websites'  => 1,
                ]);
            }
        }
    }

    public function down()
    {
        if ($this->db->tableExists('plans')) {
            if ($this->db->fieldExists('tools_enabled', 'plans')) {
                $this->forge->dropColumn('plans', 'tools_enabled');
            }
            $this->db->table('plans')->where('slug', 'free')->delete();
        }
    }
}
