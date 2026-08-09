<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    /**
     * Display a listing of categories with their program counts.
     */
    public function index()
    {
        $categories = Category::withCount('programs')->get();

        return response()->json([
            'status' => true,
            'count' => $categories->count(),
            'data' => $categories,
        ], 200);
    }
}
