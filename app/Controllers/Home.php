<?php

namespace App\Controllers;

class Home extends BaseController
{
    public function index()
    {
        $indexPath = FCPATH . 'index.html';
        if (file_exists($indexPath)) {
            return file_get_contents($indexPath);
        }

        return view('welcome_message');
    }
}
