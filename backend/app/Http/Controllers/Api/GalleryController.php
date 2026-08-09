<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Gallery;
use Illuminate\Http\Request;

class GalleryController extends Controller
{
    /**
     * Display a listing of active galleries.
     */
    public function index(Request $request)
    {
        $query = Gallery::where('is_active', true);

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->boolean('featured')) {
            $query->where('is_featured', true);
        }

        $galleries = $query->latest('event_date')->get();

        return response()->json([
            'status' => true,
            'count' => $galleries->count(),
            'data' => $galleries,
        ], 200);
    }

    /**
     * Display the specified gallery item by ID or Slug.
     */
    public function show($idOrSlug)
    {
        $gallery = Gallery::where('is_active', true)
            ->where(function ($q) use ($idOrSlug) {
                $q->where('id', $idOrSlug)->orWhere('slug', $idOrSlug);
            })->first();

        if (!$gallery) {
            return response()->json([
                'status' => false,
                'message' => 'عنصر المعرض غير موجود',
            ], 404);
        }

        return response()->json([
            'status' => true,
            'data' => $gallery,
        ], 200);
    }
}
