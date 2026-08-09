<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('program_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('program_id')->constrained('programs')->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('execution_mode', 100)->default('عن بُعد');
            $table->string('location')->nullable();
            $table->integer('total_seats')->default(30);
            $table->integer('available_seats')->default(30);
            $table->string('status')->default('متاح');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('program_schedules');
    }
};
