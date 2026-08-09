<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Program;
use Illuminate\Http\Request;

class ProgramController extends Controller
{
    /**
     * Display a listing of active programs with their category and schedules.
     *
     * Supported filters:
     * - category_id: numeric category id
     * - category: category slug
     * - level: مبتدئ | متوسط | متقدم | الكل
     * - execution_mode: حضوري | عن بُعد (substring match against schedules)
     * - featured: 1/0 or true/false
     * - search: searches title, summary, description and category name
     * - limit: 1..100
     */
    public function index(Request $request)
    {
        $query = Program::query()
            ->with([
                'category',
                'schedules' => fn ($scheduleQuery) => $scheduleQuery->orderBy('start_date'),
            ])
            ->where('is_active', true);

        if ($request->filled('category_id')) {
            $query->where('category_id', (int) $request->input('category_id'));
        }

        if ($request->filled('category')) {
            $categorySlug = trim((string) $request->input('category'));
            $query->whereHas('category', fn ($categoryQuery) => $categoryQuery->where('slug', $categorySlug));
        }

        if ($request->filled('level')) {
            $level = trim((string) $request->input('level'));
            if ($level !== 'الكل') {
                $query->where('level', $level);
            }
        }

        if ($request->filled('execution_mode')) {
            $mode = trim((string) $request->input('execution_mode'));
            $query->whereHas('schedules', function ($scheduleQuery) use ($mode) {
                $scheduleQuery->where('execution_mode', 'like', '%' . $mode . '%');
            });
        }

        if ($request->has('featured')) {
            $featured = filter_var($request->input('featured'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($featured !== null) {
                $query->where('is_featured', $featured);
            }
        }

        if ($request->filled('search')) {
            $term = trim((string) $request->input('search'));
            $query->where(function ($searchQuery) use ($term) {
                $searchQuery
                    ->where('title', 'like', '%' . $term . '%')
                    ->orWhere('summary', 'like', '%' . $term . '%')
                    ->orWhere('description', 'like', '%' . $term . '%')
                    ->orWhereHas('category', fn ($categoryQuery) => $categoryQuery->where('name', 'like', '%' . $term . '%'));
            });
        }

        if ($request->filled('limit')) {
            $limit = max(1, min(100, (int) $request->input('limit')));
            $query->limit($limit);
        }

        $programs = $query
            ->orderByDesc('is_featured')
            ->orderBy('id')
            ->get();

        return response()->json([
            'status' => true,
            'count' => $programs->count(),
            'data' => $programs,
        ], 200);
    }

    /**
     * Display a single active program with its category and schedules.
     */
    public function show($slug)
    {
        $program = Program::query()
            ->with([
                'category',
                'schedules' => fn ($scheduleQuery) => $scheduleQuery->orderBy('start_date'),
            ])
            ->where('is_active', true)
            ->where(function ($query) use ($slug) {
                $query->where('slug', $slug);
                if (is_numeric($slug)) {
                    $query->orWhere('id', (int) $slug);
                }
            })
            ->first();

        if (!$program) {
            return response()->json([
                'status' => false,
                'message' => 'البرنامج التدريبي غير موجود',
            ], 404);
        }

        return response()->json([
            'status' => true,
            'data' => $program,
        ], 200);
    }
}
