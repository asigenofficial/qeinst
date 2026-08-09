<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SQLite requires a table rebuild for changing CHECK-constrained columns;
        // Laravel's schema builder performs that rebuild on supported versions.
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('clients', function (Blueprint $table) {
                $table->string('type', 50)->default('عميل')->change();
            });
            return;
        }

        // MySQL/MariaDB: remove the old ENUM restriction so "غير ربحي" is valid.
        DB::statement("ALTER TABLE clients MODIFY type VARCHAR(50) NOT NULL DEFAULT 'عميل'");
    }

    public function down(): void
    {
        // Keep the wider string type on rollback to avoid losing valid values.
    }
};
