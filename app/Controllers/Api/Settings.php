<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use App\Models\SettingsModel;

class Settings extends ResourceController
{
    protected $format = 'json';

    public static function getAvailableModels(): array
    {
        return [
            [
                'id'          => 'kimi-k2.7-code',
                'name'        => 'Kimi K2.7 Code',
                'provider'    => 'OpenCode Zen',
                'description' => 'Modelo padrão otimizado para análise de segurança WordPress, geração de plugins e código PHP seguro.',
                'badge'       => 'RECOMENDADO',
                'color'       => 'indigo',
            ],
            [
                'id'          => 'deepseek-v4-pro',
                'name'        => 'DeepSeek V4 Pro',
                'provider'    => 'OpenCode Zen',
                'description' => 'Modelo avançado com raciocínio profundo para triagem de vulnerabilidades complexas e guia de servidor.',
                'badge'       => 'AVANÇADO',
                'color'       => 'blue',
            ],
            [
                'id'          => 'qwen-3.8-max',
                'name'        => 'Qwen 3.8 Max',
                'provider'    => 'OpenCode Zen',
                'description' => 'Modelo Qwen de altíssima velocidade para remediação em lote e rápida geração de relatórios.',
                'badge'       => 'ALTA VELOCIDADE',
                'color'       => 'teal',
            ],
        ];
    }

    /**
     * Check if user is Admin
     */
    protected function checkAdminAccess()
    {
        $userData = $this->request->userData ?? null;
        if (!$userData || ($userData->role ?? '') !== 'admin') {
            return false;
        }
        return true;
    }

    /**
     * GET /api/settings
     */
    public function index()
    {
        if (!$this->checkAdminAccess()) {
            return $this->respond([
                'status'  => 403,
                'success' => false,
                'message' => 'Acesso negado. Apenas administradores podem acessar as configurações de IA.',
            ], 403);
        }

        $activeModel = SettingsModel::getSetting('ai_model', env('OPENCODE_MODEL') ?: 'kimi-k2.7-code');
        $apiKey = env('OPENCODE_API_KEY');
        $hasKey = !empty($apiKey);

        return $this->respond([
            'status'           => 200,
            'success'          => true,
            'active_ai_model'  => $activeModel,
            'has_api_key'      => $hasKey,
            'available_models' => self::getAvailableModels(),
        ]);
    }

    /**
     * POST /api/settings
     */
    public function update($id = null)
    {
        if (!$this->checkAdminAccess()) {
            return $this->respond([
                'status'  => 403,
                'success' => false,
                'message' => 'Acesso negado. Apenas administradores podem alterar as configurações de IA.',
            ], 403);
        }

        $json = $this->request->getJSON(true);
        $aiModel = trim($json['ai_model'] ?? $this->request->getPost('ai_model') ?? '');

        if (empty($aiModel)) {
            return $this->fail('O campo ai_model é obrigatório.', 400);
        }

        $availableIds = array_column(self::getAvailableModels(), 'id');
        if (!in_array($aiModel, $availableIds, true)) {
            return $this->fail('Modelo de IA selecionado inválido.', 400);
        }

        $saved = SettingsModel::setSetting('ai_model', $aiModel);

        if (!$saved) {
            return $this->fail('Falha ao salvar configuração no banco de dados.', 500);
        }

        return $this->respond([
            'status'          => 200,
            'success'         => true,
            'message'         => 'Modelo de IA atualizado com sucesso para todas as consultas da plataforma.',
            'active_ai_model' => $aiModel,
        ]);
    }
}
