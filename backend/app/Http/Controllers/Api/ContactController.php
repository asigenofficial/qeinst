<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class ContactController extends Controller
{
    /**
     * Store a contact message, then try to email a copy to the institute.
     *
     * Database persistence is the primary delivery path. If SMTP is temporarily
     * unavailable, the API still succeeds after saving the message and logs the
     * mail error for the administrator.
     */
    public function store(Request $request)
    {
        $fullName = $request->full_name ?? $request->fullName ?? $request->name;
        $email = $request->email;
        $subject = $request->subject ?? 'استفسار عام';
        $message = $request->message ?? $request->body;

        $validator = Validator::make([
            'full_name' => $fullName,
            'email' => $email,
            'subject' => $subject,
            'message' => $message,
        ], [
            'full_name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'subject' => 'required|string|max:255',
            'message' => 'required|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'يرجى كتابة الاسم والبريد الإلكتروني ونص الرسالة',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Prevent CR/LF header injection in the subject line.
        $safeSubject = trim((string) preg_replace('/[\r\n]+/', ' ', (string) $subject));

        $contact = ContactMessage::create([
            'full_name' => $fullName,
            'email' => $email,
            'subject' => $safeSubject,
            'message' => $message,
            'status' => 'جديد',
        ]);

        $emailSent = false;

        try {
            $recipient = trim((string) config('mail.contact_to', 'info@qeinst.com')) ?: 'info@qeinst.com';

            $mailBody = implode(PHP_EOL, [
                'رسالة جديدة من نموذج «تواصل معنا» في موقع QEI Institute',
                '',
                'رقم الرسالة: ' . $contact->id,
                '',
                'الاسم: ' . $fullName,
                'البريد الإلكتروني: ' . $email,
                'الموضوع: ' . $safeSubject,
                '',
                'نص الرسالة:',
                $message,
                '',
                '--------------------------------',
                'تم إرسال هذه الرسالة من موقع QEI Institute.',
            ]);

            Mail::raw($mailBody, function ($mail) use ($recipient, $fullName, $email, $safeSubject) {
                $mail->to($recipient)
                    ->replyTo($email, $fullName)
                    ->subject('رسالة جديدة من موقع QEI - ' . $safeSubject);
            });

            $emailSent = true;
        } catch (\Throwable $e) {
            Log::error('QEI Contact Email Failed', [
                'contact_message_id' => $contact->id,
                'visitor_email' => $email,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'status' => true,
            'message' => 'تم استلام رسالتك بنجاح، وسيتم التواصل معك من قبل فريق المعهد.',
            'data' => [
                'id' => $contact->id,
                'email_sent' => $emailSent,
            ],
        ], 201);
    }
}
