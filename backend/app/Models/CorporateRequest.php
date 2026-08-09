<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CorporateRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'applicant_name',
        'company_name',
        'phone',
        'email',
        'trainees_count',
        'training_field',
        'need_description',
        'preferred_date',
        'execution_mode',
        'attachment_path',
        'status',
    ];
}
