<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Gallery extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'slug',
        'type',
        'category',
        'description',
        'event_date',
        'cover_image',
        'media_path',
        'is_featured',
        'is_active',
    ];

    protected $appends = ['cover_image_url', 'image_url', 'media_url'];

    protected $casts = [
        'is_featured' => 'boolean',
        'is_active' => 'boolean',
        'event_date' => 'date',
    ];

    public function getCoverImageUrlAttribute()
    {
        $img = $this->cover_image;
        if (empty($img)) {
            return asset('storage/uploads/gallery/gallery-main.jpg');
        }

        if (str_starts_with($img, 'http://') || str_starts_with($img, 'https://')) {
            return $img;
        }

        if (str_starts_with($img, 'assets/') || str_starts_with($img, 'storage/')) {
            return url('/') . '/' . ltrim($img, '/');
        }

        return asset('storage/' . ltrim($img, '/'));
    }

    public function getImageUrlAttribute()
    {
        return $this->getCoverImageUrlAttribute();
    }

    public function getMediaUrlAttribute()
    {
        $media = $this->media_path ?: $this->cover_image;
        if (empty($media)) {
            return $this->getCoverImageUrlAttribute();
        }

        if (str_starts_with($media, 'http://') || str_starts_with($media, 'https://')) {
            return $media;
        }

        if (str_starts_with($media, 'assets/') || str_starts_with($media, 'storage/')) {
            return url('/') . '/' . ltrim($media, '/');
        }

        return asset('storage/' . ltrim($media, '/'));
    }
}
