<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SuccessStory;
use Illuminate\Http\Request;

class SuccessStoryController extends Controller
{
    /**
     * Display a listing of active success stories.
     */
    public function index(Request $request)
    {
        $stories = SuccessStory::where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->latest()
            ->get();

        return response()->json([
            'status' => true,
            'count' => $stories->count(),
            'data' => $stories,
        ], 200);
    }
}
