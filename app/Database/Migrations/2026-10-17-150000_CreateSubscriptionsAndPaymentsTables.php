<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSubscriptionsAndPaymentsTables extends Migration
{
    public function up()
    {
        // 1. Campos adicionais na tabela users (para faturamento e integração Asaas)
        if ($this->db->tableExists('users')) {
            $userFields = [];

            if (!$this->db->fieldExists('cpf_cnpj', 'users')) {
                $userFields['cpf_cnpj'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 25,
                    'null'       => true,
                    'after'      => 'email',
                ];
            }

            if (!$this->db->fieldExists('phone', 'users')) {
                $userFields['phone'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 30,
                    'null'       => true,
                    'after'      => 'cpf_cnpj',
                ];
            }

            if (!$this->db->fieldExists('asaas_customer_id', 'users')) {
                $userFields['asaas_customer_id'] = [
                    'type'       => 'VARCHAR',
                    'constraint' => 60,
                    'null'       => true,
                    'after'      => 'phone',
                ];
            }

            if (!empty($userFields)) {
                $this->forge->addColumn('users', $userFields);
            }
        }

        // 2. Tabela de Assinaturas (subscriptions)
        if (!$this->db->tableExists('subscriptions')) {
            $this->forge->addField([
                'id' => [
                    'type'           => 'INT',
                    'constraint'     => 11,
                    'unsigned'       => true,
                    'auto_increment' => true,
                ],
                'user_id' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                ],
                'plan_id' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                ],
                'status' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 30,
                    'default'    => 'pending', // pending, active, past_due, canceled
                ],
                'gateway' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'default'    => 'asaas',
                ],
                'gateway_subscription_id' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                    'null'       => true,
                ],
                'gateway_customer_id' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                    'null'       => true,
                ],
                'billing_cycle' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 20,
                    'default'    => 'monthly',
                ],
                'price' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'default'    => '0.00',
                ],
                'extra_websites' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'default'    => 0,
                ],
                'extra_websites_price' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'default'    => '0.00',
                ],
                'extra_ai_tokens' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'default'    => 0,
                ],
                'extra_ai_tokens_price' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'default'    => '0.00',
                ],
                'current_period_start' => [
                    'type' => 'DATETIME',
                    'null' => true,
                ],
                'current_period_end' => [
                    'type' => 'DATETIME',
                    'null' => true,
                ],
                'canceled_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
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
            $this->forge->addKey('user_id');
            $this->forge->addKey('plan_id');
            $this->forge->addKey('status');
            $this->forge->addKey('gateway_subscription_id');
            $this->forge->createTable('subscriptions');
        }

        // 3. Tabela de Transações Financeiras (payment_transactions)
        if (!$this->db->tableExists('payment_transactions')) {
            $this->forge->addField([
                'id' => [
                    'type'           => 'INT',
                    'constraint'     => 11,
                    'unsigned'       => true,
                    'auto_increment' => true,
                ],
                'user_id' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                ],
                'subscription_id' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                    'null'       => true,
                ],
                'plan_id' => [
                    'type'       => 'INT',
                    'constraint' => 11,
                    'unsigned'   => true,
                ],
                'gateway' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'default'    => 'asaas',
                ],
                'gateway_transaction_id' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                ],
                'amount' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'default'    => '0.00',
                ],
                'payment_method' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 30,
                    'default'    => 'pix', // pix, credit_card, boleto
                ],
                'status' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 30,
                    'default'    => 'pending', // pending, paid, failed, refunded
                ],
                'pix_qr_code' => [
                    'type' => 'LONGTEXT',
                    'null' => true,
                ],
                'pix_copy_paste' => [
                    'type' => 'TEXT',
                    'null' => true,
                ],
                'pix_expiration' => [
                    'type' => 'DATETIME',
                    'null' => true,
                ],
                'invoice_url' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 500,
                    'null'       => true,
                ],
                'metadata' => [
                    'type' => 'LONGTEXT',
                    'null' => true,
                ],
                'paid_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
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
            $this->forge->addUniqueKey('gateway_transaction_id');
            $this->forge->addKey('user_id');
            $this->forge->addKey('subscription_id');
            $this->forge->addKey('status');
            $this->forge->createTable('payment_transactions');
        }
    }

    public function down()
    {
        $this->forge->dropTable('payment_transactions', true);
        $this->forge->dropTable('subscriptions', true);

        if ($this->db->tableExists('users')) {
            $cols = ['cpf_cnpj', 'phone', 'asaas_customer_id'];
            foreach ($cols as $col) {
                if ($this->db->fieldExists($col, 'users')) {
                    $this->forge->dropColumn('users', $col);
                }
            }
        }
    }
}
