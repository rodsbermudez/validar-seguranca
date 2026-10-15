<?php

namespace App\Models;

use CodeIgniter\Model;

class WebsiteNoteModel extends Model
{
    protected $table            = 'website_notes';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'website_id',
        'user_id',
        'title',
        'category',
        'content',
        'action_date',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Retorna todas as notas de um website com os dados do usuário autor.
     */
    public function getNotesForWebsite(int $websiteId, ?string $category = null): array
    {
        $builder = $this->select('website_notes.*, users.name as user_name, users.email as user_email')
                        ->join('users', 'users.id = website_notes.user_id', 'left')
                        ->where('website_notes.website_id', $websiteId);

        if ($category && $category !== 'all') {
            $builder->where('website_notes.category', $category);
        }

        return $builder->orderBy('website_notes.action_date', 'DESC')
                       ->orderBy('website_notes.id', 'DESC')
                       ->findAll();
    }
}
