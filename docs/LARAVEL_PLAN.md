# خطة تحويل النموذج إلى Laravel

## الاختيار التقني

- Laravel 12 + PHP 8.3
- Blade Components + Tailwind CSS + Alpine.js
- PostgreSQL 16
- Laravel Breeze للمصادقة
- Spatie Permission للصلاحيات عند الحاجة
- Queue + Notifications للبريد وتأكيد التسجيل

## المسارات المقترحة

```php
Route::get('/', HomeController::class)->name('home');
Route::get('/programs', [ProgramController::class, 'index'])->name('programs.index');
Route::get('/programs/{program:slug}', [ProgramController::class, 'show'])->name('programs.show');
Route::post('/programs/{schedule}/register', [RegistrationController::class, 'store'])->middleware('auth');
Route::view('/about', 'pages.about')->name('about');
Route::view('/solutions', 'pages.solutions')->name('solutions');
Route::post('/contact', [ContactRequestController::class, 'store'])->middleware('throttle:5,1');
Route::post('/corporate-requests', [CorporateRequestController::class, 'store'])->middleware('throttle:5,1');
```

## المكونات

- `x-layouts.app`
- `x-header` / `x-footer`
- `x-program-card`
- `x-section-heading`
- `x-form.input` / `x-form.select`
- `x-empty-state`
- `x-modal`

## لوحة الإدارة

يفضل Filament لإدارة البرامج، الجداول، المدربين، التسجيلات، الطلبات والشركاء. لا تُعرض لوحة الإدارة للعامة، وتُحمى بـ RBAC و2FA للحسابات الإدارية.

## النشر

1. VPS Ubuntu مع Nginx وPHP-FPM وPostgreSQL، أو خدمة Laravel مُدارة.
2. اضبط `APP_ENV=production` و`APP_DEBUG=false`.
3. استخدم HTTPS ونسخاً احتياطية يومية لقاعدة البيانات والملفات.
4. شغّل Queue Worker وScheduler عبر Supervisor/Cron.
5. خزّن الصور في S3-compatible عند نمو المشروع.

## الاستضافة المشتركة

إذا كانت الاستضافة لا تدعم PostgreSQL أو Queue بشكل جيد، استخدم MySQL 8.0 مع نفس بنية Laravel. هذه الواجهة الحالية لا تعتمد على الخادم ويمكن رفعها مباشرة للمعاينة.
