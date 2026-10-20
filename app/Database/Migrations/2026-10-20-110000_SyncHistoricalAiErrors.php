<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use App\Services\PlatformErrorLogger;

class SyncHistoricalAiErrors extends Migration
{
    public function up()
    {
        PlatformErrorLogger::syncHistoricalAiErrors();
    }

    public function down()
    {
        // No destructive action on backfilled logs
    }
}
