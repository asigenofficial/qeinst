<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'logo',
        'type',
        'sort_order',
        'is_active',
    ];

    protected $appends = ['logo_url', 'image_url'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function getLogoUrlAttribute()
    {
        $img = $this->logo;
        if (empty($img)) {
            return url('/') . '/assets/images/brand/favicon.png';
        }

        if (str_starts_with($img, 'http://') || str_starts_with($img, 'https://')) {
            return $img;
        }

        return url('/') . '/' . ltrim($img, '/');
    }

    public function getImageUrlAttribute()
    {
        return $this->getLogoUrlAttribute();
    }
}
