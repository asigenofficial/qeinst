<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Program extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id',
        'title',
        'slug',
        'summary',
        'description',
        'duration_hours',
        'duration_days',
        'level',
        'image',
        'is_featured',
        'is_active',
    ];

    protected $appends = ['image_url'];

    protected function casts(): array
    {
        return [
            'is_featured' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function getImageUrlAttribute()
    {
        $img = $this->image;
        if (empty($img)) {
            return asset('assets/images/programs/courses/course-001.jpeg');
        }

        if (str_starts_with($img, 'http://') || str_starts_with($img, 'https://')) {
            return $img;
        }

        if (str_starts_with($img, 'assets/')) {
            return url('/') . '/' . ltrim($img, '/');
        }

        if (str_starts_with($img, 'storage/')) {
            return url('/') . '/' . ltrim($img, '/');
        }

        return asset('storage/' . ltrim($img, '/'));
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function schedules()
    {
        return $this->hasMany(ProgramSchedule::class);
    }

    public function registrations()
    {
        return $this->hasMany(Registration::class);
    }
}
