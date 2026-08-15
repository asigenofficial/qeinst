<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SiteContentSeeder extends Seeder
{
    /**
     * Seed reviewed evergreen website content.
     * Avoids fabricated client claims, random demo data, and dated placeholder news.
     */
    public function run(): void
    {
        $now = now();

        $solutions = [
            [1, 'تحليل الاحتياج التدريبي', 'training-needs', 'نحدد فجوات الأداء والأولويات التدريبية لبناء تدخلات دقيقة.', 'تحليل منظم للاحتياجات على مستوى الجهة والإدارات والوظائف.', 'assets/images/solutions/training-needs-hero.jpeg', 'solutions/solution-details.html?slug=training-needs', 1],
            [2, 'تصميم البرامج التدريبية', 'program-design', 'نصمم برامج مخصصة ترتبط بأهداف الجهة والفئات المستهدفة.', 'تصميم الأهداف والمحاور والأنشطة وأدوات القياس بما يلائم الاحتياج.', 'assets/images/solutions/sol-design.jpg', 'solutions/solution-details.html?slug=program-design', 1],
            [3, 'تصميم الحقائب التدريبية', 'training-packages', 'نطور حقائب تدريبية عملية تشمل المحتوى والأنشطة وأدوات المدرب والمتدرب.', 'بناء حقائب قابلة للتنفيذ والتحديث وفق منهجية تدريب واضحة.', 'assets/images/solutions/training-packages-final.jpg', 'solutions/solution-details.html?slug=training-packages', 1],
            [4, 'الاستشارات والحلول المؤسسية', 'consulting-solutions', 'نقدم حلولًا في الجودة والتميز والأداء والحوكمة وتطوير العمليات.', 'حلول استشارية مصممة بحسب واقع الجهة وأولويات التحسين.', 'assets/images/solutions/sol-consulting.jpg', 'solutions/solution-details.html?slug=consulting-solutions', 1],
            [5, 'قياس أثر التدريب', 'measuring-impact', 'نساعد الجهات على قياس انتقال التعلم إلى الأداء وتحديد فرص التحسين.', 'تصميم مؤشرات وأدوات متابعة لقياس نتائج التدريب بعد التنفيذ.', 'assets/images/solutions/measuring-impact-final.jpg', 'solutions/solution-details.html?slug=measuring-impact', 1],
            [6, 'طلب برنامج خاص للمؤسسات', 'request-program', 'نصمم برنامجًا خاصًا وفق أهداف الجهة وعدد المشاركين وطبيعة العمل.', 'حل تدريبي مرن حضوري أو مباشر عن بُعد بحسب الاحتياج.', 'assets/images/solutions/request-program-final.jpg', 'solutions/custom-training.html', 1],
        ];
        $solutionKeys = explode(',', 'id,title,slug,summary,description,image,link,is_active');
        DB::transaction(function () use ($solutions, $solutionKeys, $now) {
            DB::table('corporate_solutions')->delete();
            foreach ($solutions as $row) {
                $record = array_combine($solutionKeys, $row);
                $record['created_at'] = $now;
                $record['updated_at'] = $now;
                DB::table('corporate_solutions')->insert($record);
            }
        });

        $stories = [
            [1, 'تطوير القيادات والإدارة', 'برامج مؤسسية', null, 'نماذج برامج مخصصة لتطوير المهارات القيادية، إدارة الفرق، واتخاذ القرار وفق احتياج الجهة.', null, null, 'assets/images/success/success-leadership-final.jpg', 1, 1],
            [2, 'تحسين تجربة المستفيد', 'برامج مؤسسية', null, 'حلول تدريبية تساعد فرق الخدمة على فهم رحلة المستفيد ورفع جودة نقاط الاتصال ومعالجة الشكاوى.', null, null, 'assets/images/success/success-beneficiary-final.jpg', 2, 1],
            [3, 'الجودة والتميز المؤسسي', 'برامج مؤسسية', null, 'برامج تطبيقية في نظم الجودة والتميز وقياس الأداء والتحسين المستمر للعمليات.', null, null, 'assets/images/success/success-quality-final.jpg', 3, 1],
        ];
        $storyKeys = explode(',', 'id,title,client_name,position_or_company,quote_or_description,stat_number,stat_label,image,sort_order,is_active');
        DB::transaction(function () use ($stories, $storyKeys, $now) {
            DB::table('success_stories')->delete();
            foreach ($stories as $row) {
                $record = array_combine($storyKeys, $row);
                $record['created_at'] = $now;
                $record['updated_at'] = $now;
                DB::table('success_stories')->insert($record);
            }
        });
    }
}
