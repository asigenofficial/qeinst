<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Registration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class RegistrationController extends Controller
{
    /**
     * Store a new student registration.
     */
    public function store(Request $request)
    {
        $nationalId = $request->nationalId ?? $request->national_id;
        $fullName   = $request->fullName   ?? $request->full_name;
        $email      = $request->email;
        $phone      = $request->phone;

        $programId = $request->program_id ?? $request->programId;
        $scheduleId = $request->schedule_id ?? $request->scheduleId;

        $validator = Validator::make([
            'national_id' => $nationalId,
            'full_name'   => $fullName,
            'email'       => $email,
            'phone'       => $phone,
            'program_id'  => $programId,
            'schedule_id' => $scheduleId,
        ], [
            'national_id' => ['required', 'regex:/^[0-9]{10}$/'],
            'full_name'   => 'required|string|max:255',
            'email'       => 'required|email:rfc|max:255',
            'phone'       => ['required', 'regex:/^\+?[0-9][0-9\s-]{7,18}$/'],
            'program_id'  => 'nullable|integer|exists:programs,id',
            'schedule_id' => 'nullable|integer|exists:program_schedules,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'يرجى التأكد من كتابة الهوية الوطنية، الاسم الكامل، البريد، ورقم الجوال بالشكل الصحيح',
                'errors' => $validator->errors()
            ], 422);
        }

        $birthDate = $request->birthDate ?? $request->birth_date;

        $programName = $request->program_name ?? $request->programName ?? $request->course_name ?? $request->courseTitle ?? $request->selectedProgram;

        if ($scheduleId && $programId && is_numeric($scheduleId)) {
            $scheduleMatchesProgram = \App\Models\ProgramSchedule::where('id', (int)$scheduleId)
                ->where('program_id', (int)$programId)
                ->exists();
            if (!$scheduleMatchesProgram) {
                $fallbackSched = \App\Models\ProgramSchedule::where('program_id', (int)$programId)->first();
                $scheduleId = $fallbackSched ? $fallbackSched->id : null;
            }
        } else {
            $scheduleId = null;
        }

        if (empty($programName) && !empty($programId)) {
            try {
                $prog = \App\Models\Program::find($programId);
                if ($prog) {
                    $programName = $prog->title;
                }
            } catch (\Throwable $e) {}
        }
        if (empty($programName)) {
            $programName = 'برنامج تدريبي عام';
        }

        $companyName = $request->company_name ?? $request->companyName ?? $request->company ?? $request->employer ?? $request->university;
        $jobTitle    = $request->job_title ?? $request->jobTitle ?? $request->current_job ?? $request->currentJob;
        $entityType  = $request->entity_type ?? $request->entityType ?? $request->sector ?? $request->entity;

        $nationality = $request->nationality ?? 'سعودي';
        if (!in_array($nationality, ['سعودي', 'غير سعودي'])) {
            $nationality = 'سعودي';
        }
        $maritalStatus = $request->maritalStatus ?? $request->marital_status ?? 'أعزب';
        if (!in_array($maritalStatus, ['متزوج', 'أعزب'])) {
            $maritalStatus = 'أعزب';
        }
        $employmentStatus = $request->employmentStatus ?? $request->employment_status ?? 'موظف';
        if (!in_array($employmentStatus, ['موظف', 'باحث عن عمل', 'طالب'])) {
            $employmentStatus = 'موظف';
        }
        $englishLevel = $request->englishLevel ?? $request->english_level ?? 'متوسط';
        if (!in_array($englishLevel, ['مبتدئ', 'متوسط', 'متقدم'])) {
            $englishLevel = 'متوسط';
        }

        $registrationData = [
            'national_id'       => $nationalId,
            'full_name'         => $fullName,
            'birth_date'        => (!empty($birthDate) && strtotime($birthDate)) ? date('Y-m-d', strtotime($birthDate)) : null,
            'nationality'       => $nationality,
            'marital_status'    => $maritalStatus,
            'email'             => $email,
            'phone'             => $phone,
            'city'              => $request->city,
            'qualification'     => $request->qualification ?? $request->education,
            'sector'            => $entityType ?? $request->sector,
            'entity_type'       => $entityType,
            'company_name'      => $companyName,
            'employment_status' => $employmentStatus,
            'department'        => $request->department,
            'is_working'        => $request->working === 'نعم' || $request->working === true || $request->is_working === true,
            'current_job'       => $jobTitle,
            'job_title'         => $jobTitle,
            'english_level'     => $englishLevel,
            'program_id'        => $programId,
            'schedule_id'       => $scheduleId,
            'program_name'      => $programName,
            'status'            => 'جديد',
        ];

        $summaryToken = Str::random(64);
        $registrationData['summary_token_hash'] = hash('sha256', $summaryToken);

        $registration = Registration::create($registrationData);

        return response()->json([
            'status' => true,
            'message' => 'تم استلام طلب التسجيل وحفظ بيانات الطالب بنجاح! رقم الطلب: ' . $registration->registration_number,
            'registration_number' => $registration->registration_number,
            'summary_token' => $summaryToken,
            'data'   => $registration->makeHidden(['summary_token_hash'])
        ], 201);
    }

    /**
     * Download registration summary document for a given student registration.
     */
    public function downloadSummary(Request $request, $idOrNumber)
    {
        $registration = Registration::where('registration_number', $idOrNumber)
            ->orWhere('id', $idOrNumber)
            ->first();

        if (!$registration) {
            return response()->json([
                'status' => false,
                'message' => 'عفواً، طلب التسجيل المطلوب غير موجود في النظام'
            ], 404);
        }

        $token = (string) $request->query('token', '');
        $expectedHash = (string) ($registration->summary_token_hash ?? '');
        if ($token === '' || $expectedHash === '' || !hash_equals($expectedHash, hash('sha256', $token))) {
            return response()->json([
                'status' => false,
                'message' => 'رابط تحميل ملخص التسجيل غير صالح أو منتهي.',
            ], 403);
        }

        $createdAt = $registration->created_at ? $registration->created_at->format('Y-m-d h:i A') : date('Y-m-d h:i A');
        $regNum = htmlspecialchars($registration->registration_number ?? ('QEI-' . $registration->id));
        $fullName = htmlspecialchars($registration->full_name ?? '-');
        $nationalId = htmlspecialchars($registration->national_id ?? '-');
        $email = htmlspecialchars($registration->email ?? '-');
        $phone = htmlspecialchars($registration->phone ?? '-');
        $nationality = htmlspecialchars($registration->nationality ?? 'سعودي');
        $city = htmlspecialchars($registration->city ?? 'غير محدد');
        $qualification = htmlspecialchars($registration->qualification ?? 'غير محدد');
        $employmentStatus = htmlspecialchars($registration->employment_status ?? 'موظف');
        $companyName = htmlspecialchars($registration->company_name ?? 'غير محدد');
        $jobTitle = htmlspecialchars($registration->job_title ?? $registration->current_job ?? 'غير محدد');
        $entityType = htmlspecialchars($registration->entity_type ?? $registration->sector ?? 'غير محدد');
        $englishLevel = htmlspecialchars($registration->english_level ?? 'متوسط');
        $programName = htmlspecialchars($registration->program_name ?? 'برنامج تدريبي مخصص');
        $status = htmlspecialchars($registration->status ?? 'جديد');

        $html = <<<HTML
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="utf-8">
    <title>ملخص طلب التسجيل - {$regNum}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 40px 20px; direction: rtl; text-align: right; }
        .card { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: linear-gradient(135deg, #0c3866 0%, #1e5288 100%); color: #ffffff; padding: 32px 40px; text-align: center; }
        .header h1 { margin: 0 0 10px 0; font-size: 24px; font-weight: 700; }
        .header p { margin: 0; opacity: 0.9; font-size: 14px; }
        .badge { display: inline-block; background: #00b4d8; color: #ffffff; font-weight: bold; font-size: 18px; padding: 8px 24px; border-radius: 30px; margin-top: 15px; letter-spacing: 1px; }
        .body { padding: 40px; }
        .section-title { font-size: 16px; font-weight: bold; color: #0c3866; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin: 24px 0 16px 0; display: flex; align-items: center; justify-content: space-between; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .field { background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #f1f5f9; }
        .field label { font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; }
        .field span { font-size: 14px; font-weight: 600; color: #1e293b; }
        .footer { background: #f1f5f9; padding: 20px 40px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; }
        .print-btn { display: block; width: fit-content; margin: 20px auto 0; padding: 10px 28px; background: #0c3866; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; border: none; cursor: pointer; }
        @media print { .print-btn { display: none; } body { padding: 0; background: #fff; } .card { box-shadow: none; border: none; } }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h1>معهد خبراء الجودة للتدريب (QEI)</h1>
            <p>ملخص وثيقة استلام طلب تسجيل طالب في البرنامج التدريبي</p>
            <div class="badge">رقم الطلب: {$regNum}</div>
        </div>
        <div class="body">
            <div class="section-title">
                <span>معلومات البرنامج التدريبي</span>
                <span style="font-size: 13px; color: #059669;">الحالة: {$status}</span>
            </div>
            <div class="grid">
                <div class="field" style="grid-column: span 2;">
                    <label>البرنامج التدريبي المحدد</label>
                    <span style="color: #0c3866; font-size: 16px;">{$programName}</span>
                </div>
                <div class="field">
                    <label>تاريخ وتوقيت التقديم</label>
                    <span>{$createdAt}</span>
                </div>
                <div class="field">
                    <label>حالة الطلب الحالية</label>
                    <span>{$status}</span>
                </div>
            </div>

            <div class="section-title">البيانات الشخصية والاتصال</div>
            <div class="grid">
                <div class="field">
                    <label>الاسم الرباعي الكامل</label>
                    <span>{$fullName}</span>
                </div>
                <div class="field">
                    <label>رقم الهوية الوطنية / الإقامة</label>
                    <span>{$nationalId}</span>
                </div>
                <div class="field">
                    <label>البريد الإلكتروني</label>
                    <span>{$email}</span>
                </div>
                <div class="field">
                    <label>رقم الجوال</label>
                    <span>{$phone}</span>
                </div>
                <div class="field">
                    <label>الجنسية</label>
                    <span>{$nationality}</span>
                </div>
                <div class="field">
                    <label>المدينة / المنطقة</label>
                    <span>{$city}</span>
                </div>
            </div>

            <div class="section-title">بيانات العمل والتعليم</div>
            <div class="grid">
                <div class="field">
                    <label>المؤهل العلمي</label>
                    <span>{$qualification}</span>
                </div>
                <div class="field">
                    <label>الحالة الوظيفية</label>
                    <span>{$employmentStatus}</span>
                </div>
                <div class="field">
                    <label>نوع الجهة / القطاع</label>
                    <span>{$entityType}</span>
                </div>
                <div class="field">
                    <label>جهة العمل / الشركة</label>
                    <span>{$companyName}</span>
                </div>
                <div class="field">
                    <label>المسمى الوظيفي</label>
                    <span>{$jobTitle}</span>
                </div>
                <div class="field">
                    <label>مستوى اللغة الإنجليزية</label>
                    <span>{$englishLevel}</span>
                </div>
            </div>

            <button class="print-btn" onclick="window.print()">🖨 طباعة الملخص / حفظ PDF</button>
        </div>
        <div class="footer">
            معهد خبراء الجودة للتدريب — جميع الحقوق محفوظة © 2026 | info@qeinst.com | +966 56 716 7988
        </div>
    </div>
</body>
</html>
HTML;

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="QEI-Summary-' . $regNum . '.html"',
        ]);
    }
}
