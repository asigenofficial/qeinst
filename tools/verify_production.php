<?php

$endpoints = [
    'Categories' => 'http://127.0.0.1:8000/api/v1/categories',
    'Programs' => 'http://127.0.0.1:8000/api/v1/programs',
    'Galleries' => 'http://127.0.0.1:8000/api/v1/galleries',
    'Clients' => 'http://127.0.0.1:8000/api/v1/clients',
    'Corporate Solutions' => 'http://127.0.0.1:8000/api/v1/corporate-solutions',
    'Success Stories' => 'http://127.0.0.1:8000/api/v1/success-stories'
];

echo "========================================\n";
echo "QEINST API Production Verification Report\n";
echo "========================================\n";

$allPassed = true;

foreach ($endpoints as $name => $url) {
    $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        echo "[-] $name: FAILED to connect ($url)\n";
        $allPassed = false;
        continue;
    }

    $json = json_decode($raw, true);
    if (!is_array($json) || !isset($json['status']) || $json['status'] !== true) {
        echo "[-] $name: FAILED invalid JSON response\n";
        $allPassed = false;
        continue;
    }

    $count = isset($json['count']) ? $json['count'] : (isset($json['data']) ? count($json['data']) : 0);
    echo "[+] $name: OK (Returned $count items)\n";
}

echo "----------------------------------------\n";

// Test Registration POST
$regData = [
    'national_id' => '1029384756',
    'full_name' => 'متدرب تجريبي للتحقق النهائي',
    'email' => 'test.verify@https://qeitraining.com',
    'phone' => '0567167988',
    'nationality' => 'سعودي',
    'marital_status' => 'أعزب',
    'city' => 'الرياض',
    'qualification' => 'بكالوريوس',
    'entity_type' => 'خاص',
    'company_name' => 'شركة خبراء الجودة',
    'job_title' => 'أخصائي جودة',
    'program_name' => 'أفضل ممارسات التميز القيادي والأداء الإبداعي',
    'program_id' => 1
];

$opts = [
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\nAccept: application/json\r\n",
        'content' => json_encode($regData),
        'timeout' => 5,
        'ignore_errors' => true
    ]
];

$regRaw = @file_get_contents('http://127.0.0.1:8000/api/v1/registrations', false, stream_context_create($opts));
$regJson = json_decode($regRaw, true);

if ($regJson && isset($regJson['status']) && $regJson['status'] === true && isset($regJson['registration_number'])) {
    echo "[+] POST /registrations: OK (Created {$regJson['registration_number']})\n";
} else {
    echo "[-] POST /registrations: FAILED (" . json_encode($regJson, JSON_UNESCAPED_UNICODE) . ")\n";
    $allPassed = false;
}

echo "========================================\n";
echo $allPassed ? ">>> ALL ENDPOINTS & FLOWS VERIFIED 100% SUCCESS <<<\n" : ">>> SOME CHECKS FAILED <<<\n";
