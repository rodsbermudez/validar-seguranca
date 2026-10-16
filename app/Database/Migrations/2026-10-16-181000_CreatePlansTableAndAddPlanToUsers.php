<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePlansTableAndAddPlanToUsers extends Migration
{
    public function up()
    {
        // 1. Criar tabela de planos (Catálogo de Planos)
        if (!$this->db->tableExists('plans')) {
            $this->forge->addField([
                'id' => [
                    'type'           => 'INT',
                    'constraint'     => 11,
                    'unsigned'       => true,
                    'auto_increment' => true,
                ],
                'name' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                ],
                'slug' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                ],
                'description' => [
                    'type' => 'TEXT',
                    'null' => true,
                ],
                'max_websites' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'null'       => true, // NULL = Sites Ilimitados
                ],
                'ai_monthly_tokens' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'default'    => 250000, // Teto obrigatório (sem ilimitado)
                ],
                'price_monthly' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'default'    => '0.00',
                ],
                'is_active' => [
                    'type'       => 'TINYINT',
                    'constraint' => 1,
                    'default'    => 1,
                ],
                'is_default' => [
                    'type'       => 'TINYINT',
                    'constraint' => 1,
                    'default'    => 0,
                ],
                'sort_order' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'default'    => 0,
                ],
                'created_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
                ],
                'updated_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
                ],
            ]);

            $this->forge->addKey('id', true);
            $this->forge->addUniqueKey('slug');
            $this->forge->createTable('plans');

            // Seeds dos planos padrão iniciais:
            // 1. Iniciante: 4 sites | 250k tokens | R$ 97,00 | padrão
            // 2. Profissional: 10 sites | 500k tokens | R$ 197,00
            // 3. Full: Sites Ilimitados (NULL) | 2.000.000 tokens | R$ 397,00
            $now = date('Y-m-d H:i:s');
            $initialPlans = [
                [
                    'name'              => 'Iniciante',
                    'slug'              => 'iniciante',
                    'description'       => 'Plano base para pequenos negócios e gestão essencial.',
                    'max_websites'      => 4,
                    'ai_monthly_tokens' => 250000,
                    'price_monthly'     => 97.00,
                    'is_active'         => 1,
                    'is_default'        => 1,
                    'sort_order'        => 1,
                    'created_at'        => $now,
                    'updated_at'        => $now,
                ],
                [
                    'name'              => 'Profissional',
                    'slug'              => 'profissional',
                    'description'       => 'Ideal para agências e profissionais com múltiplos projetos.',
                    'max_websites'      => 10,
                    'ai_monthly_tokens' => 500000,
                    'price_monthly'     => 197.00,
                    'is_active'         => 1,
                    'is_default'        => 0,
                    'sort_order'        => 2,
                    'created_at'        => $now,
                    'updated_at'        => $now,
                ],
                [
                    'name'              => 'Full',
                    'slug'              => 'full',
                    'description'       => 'Sites ilimitados com ampla cota de IA para alta demanda.',
                    'max_websites'      => null, // Ilimitado
                    'ai_monthly_tokens' => 2000000, // Trava de 2M
                    'price_monthly'     => 397.00,
                    'is_active'         => 1,
                    'is_default'        => 0,
                    'sort_order'        => 3,
                    'created_at'        => $now,
                    'updated_at'        => $now,
                ],
            ];

            $this->db->table('plans')->insertBatch($initialPlans);
        }

        // 2. Adicionar campos de plano, add-ons e valores na tabela users
        if ($this->db->tableExists('users')) {
            $userFields = [];

            if (!$this->db->fieldExists('plan_id', 'users')) {
                $userFields['plan_id'] = [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'null'       => true,
                    'after'      => 'role',
                ];
            }

            if (!$this->db->fieldExists('extra_websites', 'users')) {
                $userFields['extra_websites'] = [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'default'    => 0,
                    'after'      => 'plan_id',
                ];
            }

            if (!$this->db->fieldExists('extra_websites_price', 'users')) {
                $userFields['extra_websites_price'] = [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'default'    => '0.00',
                    'after'      => 'extra_websites',
                ];
            }

            if (!$this->db->fieldExists('extra_ai_tokens', 'users')) {
                $userFields['extra_ai_tokens'] = [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'default'    => 0,
                    'after'      => 'extra_websites_price',
                ];
            }

            if (!$this->db->fieldExists('extra_ai_tokens_price', 'users')) {
                $userFields['extra_ai_tokens_price'] = [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'default'    => '0.00',
                    'after'      => 'extra_ai_tokens',
                ];
            }

            if (!$this->db->fieldExists('custom_price_monthly', 'users')) {
                $userFields['custom_price_monthly'] = [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'null'       => true,
                    'after'      => 'extra_ai_tokens_price',
                ];
            }

            if (!$this->db->fieldExists('custom_max_websites', 'users')) {
                $userFields['custom_max_websites'] = [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'null'       => true,
                    'after'      => 'custom_price_monthly',
                ];
            }

            if (!$this->db->fieldExists('custom_ai_token_limit', 'users')) {
                $userFields['custom_ai_token_limit'] = [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'null'       => true,
                    'after'      => 'custom_max_websites',
                ];
            }

            if (!empty($userFields)) {
                $this->forge->addColumn('users', $userFields);
            }

            // Vincular usuários existentes que não têm plano ao plano padrão (Iniciante)
            $defaultPlan = $this->db->table('plans')->where('is_default', 1)->get()->getRowArray();
            if ($defaultPlan) {
                $this->db->query("UPDATE `users` SET `plan_id` = ? WHERE `plan_id` IS NULL AND `role` != 'admin'", [$defaultPlan['id']]);
            }
        }
    }

    public function down()
    {
        if ($this->db->tableExists('users')) {
            $columnsToDrop = [
                'custom_ai_token_limit',
                'custom_max_websites',
                'custom_price_monthly',
                'extra_ai_tokens_price',
                'extra_ai_tokens',
                'extra_websites_price',
                'extra_websites',
                'plan_id',
            ];
            foreach ($columnsToDrop as $col) {
                if ($this->db->fieldExists($col, 'users')) {
                    $this->forge->dropColumn('users', $col);
                }
            }
        }

        if ($this->db->tableExists('plans')) {
            $this->forge->dropTable('plans');
        }
    }
}
