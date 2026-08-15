<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $addRequestType = !Schema::hasColumn('corporate_requests', 'request_type');
        $addSolutionSlug = !Schema::hasColumn('corporate_requests', 'solution_slug');
        $addSolutionTitle = !Schema::hasColumn('corporate_requests', 'solution_title');

        if (!$addRequestType && !$addSolutionSlug && !$addSolutionTitle) {
            return;
        }

        Schema::table('corporate_requests', function (Blueprint $table) use ($addRequestType, $addSolutionSlug, $addSolutionTitle) {
            if ($addRequestType) {
                $table->string('request_type', 40)->default('custom-program');
            }
            if ($addSolutionSlug) {
                $table->string('solution_slug', 100)->nullable();
            }
            if ($addSolutionTitle) {
                $table->string('solution_title')->nullable();
            }
        });
    }

    public function down(): void
    {
        $drop = [];
        foreach (['solution_title', 'solution_slug', 'request_type'] as $column) {
            if (Schema::hasColumn('corporate_requests', $column)) {
                $drop[] = $column;
            }
        }
        if (!$drop) {
            return;
        }
        Schema::table('corporate_requests', function (Blueprint $table) use ($drop) {
            $table->dropColumn($drop);
        });
    }
};
