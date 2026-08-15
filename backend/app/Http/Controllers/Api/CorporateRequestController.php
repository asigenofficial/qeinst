<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CorporateRequest;
use App\Models\CorporateSolution;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CorporateRequestController extends Controller
{
    /**
     * Get list of corporate solutions dynamically from database table corporate_solutions.
     */
    public function index(Request $request)
    {
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('corporate_solutions')) {
                $query = CorporateSolution::where('is_active', true);
                if ($request->filled('limit')) {
                    $query->take(max(1, min(50, (int) $request->input('limit'))));
                }
                $dbSolutions = $query->get();
                if ($dbSolutions->count() > 0) {
                    return response()->json([
                        'status' => true,
                        'message' => 'تم جلب حلول المؤسسات بنجاح من جدول corporate_solutions في قاعدة البيانات',
                        'data' => $dbSolutions
                    ]);
                }
            }
        } catch (\Throwable $e) {
            // Fallback below
        }

        $solutions = [
            [
                'id' => 1,
                'slug' => 'training-needs',
                'title' => 'تحليل الاحتياج التدريبي',
                'summary' => 'نحدد الفجوات ونحلل الاحتياجات لتصميم حلول تدريبية دقيقة وفعالة.',
                'image' => 'assets/images/gallery/gallery-list-1.jpg',
                'link' => 'solutions/solution-details.html?slug=training-needs'
            ],
            [
                'id' => 2,
                'slug' => 'program-design',
                'title' => 'تصميم البرامج التدريبية',
                'summary' => 'نصمم برامج مخصصة تلبي أهداف مؤسستك وتحقق نتائج ملموسة.',
                'image' => 'assets/images/gallery/gallery-related-design.jpg',
                'link' => 'solutions/solution-details.html?slug=program-design'
            ],
            [
                'id' => 3,
                'slug' => 'training-packages',
                'title' => 'تصميم الحقائب التدريبية',
                'summary' => 'نطور حقائب تدريبية احترافية تواكب أفضل الممارسات العالمية.',
                'image' => 'assets/images/gallery/gallery-list-2.jpg',
                'link' => 'solutions/solution-details.html?slug=training-packages'
            ],
            [
                'id' => 4,
                'slug' => 'consulting-solutions',
                'title' => 'الاستشارات والحلول المؤسسية',
                'summary' => 'نقدم استشارات استراتيجية وحلول تدريبية تعزز الأداء وتحقق الأثر.',
                'image' => 'assets/images/gallery/gallery-list-8.jpg',
                'link' => 'solutions/solution-details.html?slug=consulting-solutions'
            ],
            [
                'id' => 5,
                'slug' => 'measuring-impact',
                'title' => 'قياس أثر التدريب',
                'summary' => 'نضمن أثر التدريب على الأداء لضمان تحقيق العائد الاستثماري.',
                'image' => 'assets/images/gallery/gallery-list-5.jpg',
                'link' => 'solutions/solution-details.html?slug=measuring-impact'
            ],
            [
                'id' => 6,
                'slug' => 'request-program',
                'title' => 'طلب برنامج خاص للمؤسسات',
                'summary' => 'نصمم برنامجاً خاصاً يلبي احتياجاتك النوعية وأهدافك المؤسسية.',
                'image' => 'assets/images/gallery/gallery-list-6.jpg',
                'link' => 'solutions/custom-training.html'
            ]
        ];

        return response()->json([
            'status' => true,
            'message' => 'تم جلب حلول المؤسسات بنجاح من الباك اند وقاعدة البيانات',
            'data' => $solutions
        ]);
    }
    /**
     * Store custom corporate training request.
     */
    public function store(Request $request)
    {
        $applicantName   = $request->applicant_name ?? $request->applicantName ?? $request->fullName;
        $companyName     = $request->company_name   ?? $request->companyName   ?? $request->employer;
        $phone           = $request->phone;
        $email           = $request->email;
        $needDescription = $request->need_description ?? $request->needDescription ?? $request->description ?? 'طلب تدريب خاص للمؤسسات';
        $requestType     = $request->request_type ?? $request->requestType ?? 'custom-program';
        $solutionSlug    = $request->solution_slug ?? $request->solutionSlug;
        $solutionTitle   = $request->solution_title ?? $request->solutionTitle;

        $validator = Validator::make([
            'applicant_name'   => $applicantName,
            'company_name'     => $companyName,
            'phone'            => $phone,
            'email'            => $email,
            'need_description' => $needDescription,
            'execution_mode'   => $request->execution_mode ?? $request->executionMode,
            'request_type'     => $requestType,
            'solution_slug'    => $solutionSlug,
            'solution_title'   => $solutionTitle,
        ], [
            'applicant_name'   => 'required|string|max:255',
            'company_name'     => 'required|string|max:255',
            'phone'            => ['required', 'regex:/^\+?[0-9][0-9\s-]{7,18}$/'],
            'email'            => 'required|email:rfc|max:255',
            'need_description' => 'required|string|max:2000',
            'execution_mode'   => 'nullable|in:حضوري,عن بُعد,مدمج',
            'request_type'     => 'nullable|in:custom-program,corporate-solution',
            'solution_slug'    => 'nullable|string|max:100',
            'solution_title'   => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'يرجى استكمال البيانات الأساسية للجهة ومقدم الطلب',
                'errors' => $validator->errors()
            ], 422);
        }

        $attachmentPath = null;
        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('corporate_attachments', 'public');
        }

        $prefDate = $request->preferred_date ?? $request->preferredDate;

        $corporateRequest = CorporateRequest::create([
            'request_type'     => $requestType,
            'solution_slug'    => $solutionSlug,
            'solution_title'   => $solutionTitle,
            'applicant_name'   => $applicantName,
            'company_name'     => $companyName,
            'phone'            => $phone,
            'email'            => $email,
            'trainees_count'   => $request->trainees_count ?? $request->traineesCount,
            'training_field'   => $request->training_field ?? $request->trainingField,
            'need_description' => $needDescription,
            'preferred_date'   => (!empty($prefDate) && strtotime($prefDate)) ? date('Y-m-d', strtotime($prefDate)) : null,
            'execution_mode'   => $request->execution_mode ?? $request->executionMode ?? 'عن بُعد',
            'attachment_path'  => $attachmentPath,
            'status'           => 'جديد',
        ]);

        return response()->json([
            'status' => true,
            'message' => ($requestType === 'corporate-solution'
                ? 'تم استقبال طلب الحل المؤسسي' . ($solutionTitle ? ' «' . $solutionTitle . '»' : '')
                : 'تم استقبال طلب البرنامج التدريبي الخاص') . ' بنجاح برقم #' . $corporateRequest->id . '، وسيقوم مستشارنا بالتواصل معكم قريباً.',
            'data'   => $corporateRequest
        ], 201);
    }
}
