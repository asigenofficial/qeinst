<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    /**
     * Display a listing of active clients and partners.
     */
    public function index(Request $request)
    {
        $query = Client::where('is_active', true);

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        $clients = $query->orderBy('sort_order', 'asc')->get();

        return response()->json([
            'status' => true,
            'count' => $clients->count(),
            'data' => $clients,
        ], 200);
    }
}
