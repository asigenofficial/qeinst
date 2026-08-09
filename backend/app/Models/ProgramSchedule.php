<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProgramSchedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'program_id',
        'start_date',
        'end_date',
        'execution_mode',
        'location',
        'total_seats',
        'available_seats',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    public function program()
    {
        return $this->belongsTo(Program::class);
    }
}
