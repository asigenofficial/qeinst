<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ProgramController;
use App\Http\Controllers\Api\RegistrationController;
use App\Http\Controllers\Api\CorporateRequestController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\GalleryController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\SuccessStoryController;

/*
|--------------------------------------------------------------------------
| QEINST REST API Routes
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {
    // 0. التصنيفات (Categories)
    Route::get('/categories', [CategoryController::class, 'index']);

    // 1. المصادقة وتدقيق تسجيل دخول الطلاب (Auth & Login)
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:6,1');
    Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

    // 2. البرامج والدورات (Programs)
    Route::get('/programs', [ProgramController::class, 'index']);
    Route::get('/programs/{slug}', [ProgramController::class, 'show']);

    // 3. طلبات التسجيل الفردية (Registrations)
    Route::post('/registrations', [RegistrationController::class, 'store'])->middleware('throttle:10,1');
    Route::get('/registrations/{idOrNumber}/summary', [RegistrationController::class, 'downloadSummary'])->middleware('throttle:30,1');

    // 4. طلبات الشركات والحلول الخاصة (Corporate Requests & Solutions)
    Route::get('/corporate-solutions', [CorporateRequestController::class, 'index']);
    Route::post('/corporate-requests', [CorporateRequestController::class, 'store'])->middleware('throttle:6,1');

    // 5. تواصل معنا والدعم (Contact Messages)
    Route::post('/contact', [ContactController::class, 'store'])->middleware('throttle:8,1');

    // 6. معرض الصور (Gallery)
    Route::get('/galleries', [GalleryController::class, 'index']);
    Route::get('/galleries/{idOrSlug}', [GalleryController::class, 'show']);

    // 7. العملاء والشركاء (Clients & Partners)
    Route::get('/clients', [ClientController::class, 'index']);

    // 8. قصص النجاح والأثر (Success Stories & Impact)
    Route::get('/success-stories', [SuccessStoryController::class, 'index']);
});
