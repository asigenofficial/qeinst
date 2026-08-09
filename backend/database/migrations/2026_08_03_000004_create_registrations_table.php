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
        Schema::create('registrations', function (Blueprint $table) {
            $table->id();
            $table->string('registration_number')->nullable()->unique();
            $table->string('summary_token_hash', 64)->nullable()->unique();
            $table->foreignId('program_id')->nullable()->constrained('programs')->nullOnDelete();
            $table->foreignId('schedule_id')->nullable()->constrained('program_schedules')->nullOnDelete();
            $table->string('program_name')->nullable();
            
            // البيانات الشخصية (Personal Info)
            $table->string('national_id', 10);
            $table->string('full_name');
            $table->date('birth_date')->nullable();
            $table->enum('nationality', ['سعودي', 'غير سعودي'])->default('سعودي');
            $table->enum('marital_status', ['متزوج', 'أعزب'])->default('أعزب');
            $table->string('email');
            $table->string('phone');
            $table->string('city')->nullable();

            // بيانات العمل والتعليم (Work & Education Info)
            $table->string('qualification')->nullable();
            $table->string('sector')->nullable();
            $table->string('entity_type')->nullable();
            $table->string('company_name')->nullable();
            $table->enum('employment_status', ['موظف', 'باحث عن عمل', 'طالب'])->default('موظف');
            $table->string('department')->nullable();
            $table->boolean('is_working')->default(true);
            $table->string('current_job')->nullable();
            $table->string('job_title')->nullable();
            $table->enum('english_level', ['مبتدئ', 'متوسط', 'متقدم'])->default('متوسط');

            // حالة الطلب (Status)
            $table->enum('status', ['جديد', 'مقبول', 'قيد الانتظار', 'مكتمل', 'ملغى'])->default('جديد');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('registrations');
    }
};
