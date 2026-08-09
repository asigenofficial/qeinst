<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| QEINST Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return response()->json([
        'status' => true,
        'app' => 'معهد خبراء الجودة (QEINST) REST API',
        'version' => '1.0.0',
        'backend' => 'PHP ' . PHP_VERSION . ' + Laravel ' . app()->version(),
        'endpoints' => [
            'auth_login' => '/api/v1/auth/login [POST]',
            'auth_register' => '/api/v1/auth/register [POST]',
            'programs_list' => '/api/v1/programs [GET]',
            'program_details' => '/api/v1/programs/{slug} [GET]',
            'student_registration' => '/api/v1/registrations [POST]',
            'corporate_request' => '/api/v1/corporate-requests [POST]',
            'support_contact' => '/api/v1/contact [POST]',
        ]
    ], 200, [], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
});
