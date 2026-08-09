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
        Schema::create('corporate_requests', function (Blueprint $table) {
            $table->id();
            $table->string('applicant_name');
            $table->string('company_name');
            $table->string('phone');
            $table->string('email');
            $table->string('trainees_count')->nullable();
            $table->string('training_field')->nullable();
            $table->text('need_description');
            $table->date('preferred_date')->nullable();
            $table->enum('execution_mode', ['حضوري', 'عن بُعد', 'مدمج'])->default('عن بُعد');
            $table->string('attachment_path')->nullable();
            $table->enum('status', ['جديد', 'قيد الدراسة', 'تم التواصل', 'مغلق'])->default('جديد');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('corporate_requests');
    }
};
