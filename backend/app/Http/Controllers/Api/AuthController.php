<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    /**
     * Handle user/student login.
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'login' => 'required|string', // Email or National ID
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'يرجى إدخال اسم المستخدم وكلمة المرور',
                'errors' => $validator->errors(),
            ], 422);
        }

        $login = $request->login;

        // Find user by Email OR National ID
        $user = User::where('email', $login)
            ->orWhere('national_id', $login)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'status' => false,
                'message' => 'بيانات الدخول غير صحيحة، يرجى التأكد من البريد الإلكتروني أو الهوية وكلمة المرور',
            ], 401);
        }

        $user->tokens()->where('name', 'qeinst-web')->delete();
        $token = $user->createToken('qeinst-web', ['web'])->plainTextToken;

        return response()->json([
            'status' => true,
            'message' => 'تم تسجيل الدخول بنجاح! أهلاً بك في منصة معهد خبراء الجودة.',
            'user' => [
                'id' => $user->id,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'national_id' => $user->national_id,
                'role' => $user->role,
            ],
            'token' => $token,
        ], 200);
    }

    /**
     * Handle new student account creation.
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'phone' => 'nullable|string',
            'national_id' => 'nullable|string|size:10',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'تعذر إنشاء الحساب، يرجى مراجعة البيانات',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = User::create([
            'full_name' => $request->full_name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'national_id' => $request->national_id,
            'role' => 'student',
        ]);

        $token = $user->createToken('qeinst-web', ['web'])->plainTextToken;

        return response()->json([
            'status' => true,
            'message' => 'تم إنشاء حساب الطالب بنجاح، يمكنك الآن الدخول للمنصة.',
            'user' => [
                'id' => $user->id,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'national_id' => $user->national_id,
                'role' => $user->role,
            ],
            'token' => $token,
        ], 201);
    }

    /**
     * Revoke the current browser token.
     */
    public function logout(Request $request)
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'status' => true,
            'message' => 'تم تسجيل الخروج بنجاح.',
        ]);
    }
}
