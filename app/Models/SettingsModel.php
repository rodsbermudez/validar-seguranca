<?php

namespace App\Models;

use CodeIgniter\Model;

class SettingsModel extends Model
{
    protected $table      = 'settings';
    protected $primaryKey = 'key';

    protected $useAutoIncrement = false;
    protected $returnType       = 'array';

    protected $allowedFields = ['key', 'value', 'updated_at'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = '';
    protected $updatedField  = 'updated_at';

    /**
     * Get a setting by key with fallback default
     */
    public static function getSetting(string $key, string $default = ''): string
    {
        try {
            $model = new self();
            $record = $model->find($key);
            if ($record && isset($record['value'])) {
                return $record['value'];
            }
        } catch (\Throwable $e) {
            log_message('error', 'Error fetching setting ' . $key . ': ' . $e->getMessage());
        }

        return $default;
    }

    /**
     * Set/update a setting value
     */
    public static function setSetting(string $key, string $value): bool
    {
        try {
            $model = new self();
            $existing = $model->find($key);
            $data = [
                'key'        => $key,
                'value'      => $value,
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            if ($existing) {
                return (bool) $model->update($key, $data);
            } else {
                return (bool) $model->insert($data);
            }
        } catch (\Throwable $e) {
            log_message('error', 'Error saving setting ' . $key . ': ' . $e->getMessage());
            return false;
        }
    }
}
