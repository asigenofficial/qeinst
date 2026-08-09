<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ContactController extends Controller
{
    /**
     * Store contact message.
     */
    public function store(Request $request)
    {
        $fullName = $request->full_name ?? $request->fullName ?? $request->name;
        $email    = $request->email;
        $subject  = $request->subject  ?? 'استفسار عام';
        $message  = $request->message  ?? $request->body;

        $validator = Validator::make([
            'full_name' => $fullName,
            'email'     => $email,
            'subject'   => $subject,
            'message'   => $message,
        ], [
            'full_name' => 'required|string|max:255',
            'email'     => 'required|email',
            'subject'   => 'required|string|max:255',
            'message'   => 'required|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'يرجى كتابة الاسم والبريد الإلكتروني ونص الرسالة',
                'errors' => $validator->errors()
            ], 422);
        }

        $contact = ContactMessage::create([
            'full_name' => $fullName,
            'email'     => $email,
            'subject'   => $subject,
            'message'   => $message,
            'status'    => 'جديد',
        ]);

        return response()->json([
            'status' => true,
            'message' => 'نشكر تواصلك معنا! تم تسليم رسالتك بنجاح وسيتواصل معك فريق الدعم قريباً.',
            'data'   => $contact
        ], 201);
    }
}
