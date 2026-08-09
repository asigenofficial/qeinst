<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('registrations', 'summary_token_hash')) {
            Schema::table('registrations', function (Blueprint $table) {
                $table->string('summary_token_hash', 64)->nullable()->unique()->after('registration_number');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('registrations', 'summary_token_hash')) {
            Schema::table('registrations', function (Blueprint $table) {
                $table->dropUnique(['summary_token_hash']);
                $table->dropColumn('summary_token_hash');
            });
        }
    }
};
