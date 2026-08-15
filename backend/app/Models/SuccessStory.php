<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SuccessStory extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'client_name',
        'position_or_company',
        'quote_or_description',
        'stat_number',
        'stat_label',
        'image',
        'sort_order',
        'is_active',
    ];

    protected $appends = ['image_url'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function getImageUrlAttribute()
    {
        $img = $this->image;
        if (empty($img)) {
            return asset('assets/images/gallery/gallery-list-1.jpg');
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
}
