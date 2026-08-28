<?php

namespace App\Controllers;

class Docs extends BaseController
{
    public function index($section = null)
    {
        $data = [
            'activeSection' => $section ?: 'visao-geral',
        ];

        return view('docs/index', $data);
    }
}
