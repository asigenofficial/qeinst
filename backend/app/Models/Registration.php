<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Registration extends Model
{
    use HasFactory;

    protected $fillable = [
        'registration_number',
        'summary_token_hash',
        'program_id',
        'schedule_id',
        'program_name',
        'national_id',
        'full_name',
        'birth_date',
        'nationality',
        'marital_status',
        'email',
        'phone',
        'city',
        'qualification',
        'sector',
        'entity_type',
        'company_name',
        'employment_status',
        'department',
        'is_working',
        'current_job',
        'job_title',
        'english_level',
        'status',
    ];

    protected static function booted()
    {
        static::creating(function ($registration) {
            if (empty($registration->registration_number)) {
                $year = date('Y');
                do {
                    $random = random_int(100000, 999999);
                    $number = "QEI-{$year}-{$random}";
                } while (static::where('registration_number', $number)->exists());

                $registration->registration_number = $number;
            }
        });
    }

    public function program()
    {
        return $this->belongsTo(Program::class);
    }
}
