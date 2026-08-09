<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class GalleryMediaSeeder extends Seeder
{
    /**
     * Seed gallery metadata from the institute media bundled with the project.
     * Media is copied into Laravel public assets if it is not already present.
     */
    public function run(): void
    {
        $now = now();

        $records = [
            [1, 'تغطية مصورة من فعاليات معهد الجودة رقم 1', 'gallery-photo-1', 'image', 'حفلات تخرج ورش عمل', null, '2026-08-06', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.31 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.31 PM (1).jpeg', null, 0, 1],
            [2, 'تغطية مصورة من فعاليات معهد الجودة رقم 2', 'gallery-photo-2', 'image', 'فعاليات المعهد', null, '2026-08-04', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.31 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.31 PM.jpeg', null, 0, 1],
            [3, 'تغطية مصورة من فعاليات معهد الجودة رقم 3', 'gallery-photo-3', 'image', 'استشارات واجتماعات', null, '2026-08-02', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.33 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.33 PM (1).jpeg', null, 1, 1],
            [4, 'تغطية مصورة من فعاليات معهد الجودة رقم 4', 'gallery-photo-4', 'image', 'مؤتمرات وملتقيات', null, '2026-07-31', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.33 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.33 PM.jpeg', null, 0, 1],
            [5, 'تغطية مصورة من فعاليات معهد الجودة رقم 5', 'gallery-photo-5', 'image', 'حفلات تخرج ورش عمل', null, '2026-07-29', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.35 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.35 PM (1).jpeg', null, 0, 1],
            [6, 'تغطية مصورة من فعاليات معهد الجودة رقم 6', 'gallery-photo-6', 'image', 'فعاليات المعهد', null, '2026-07-27', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.35 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.35 PM.jpeg', null, 1, 1],
            [7, 'تغطية مصورة من فعاليات معهد الجودة رقم 7', 'gallery-photo-7', 'image', 'استشارات واجتماعات', null, '2026-07-25', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.36 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.36 PM (1).jpeg', null, 0, 1],
            [8, 'تغطية مصورة من فعاليات معهد الجودة رقم 8', 'gallery-photo-8', 'image', 'مؤتمرات وملتقيات', null, '2026-07-23', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.36 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.36 PM.jpeg', null, 0, 1],
            [9, 'تغطية مصورة من فعاليات معهد الجودة رقم 9', 'gallery-photo-9', 'image', 'حفلات تخرج ورش عمل', null, '2026-07-21', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.37 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.37 PM (1).jpeg', null, 1, 1],
            [10, 'تغطية مصورة من فعاليات معهد الجودة رقم 10', 'gallery-photo-10', 'image', 'فعاليات المعهد', null, '2026-07-19', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.37 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.37 PM.jpeg', null, 0, 1],
            [11, 'تغطية مصورة من فعاليات معهد الجودة رقم 11', 'gallery-photo-11', 'image', 'استشارات واجتماعات', null, '2026-07-17', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.38 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.38 PM (1).jpeg', null, 0, 1],
            [12, 'تغطية مصورة من فعاليات معهد الجودة رقم 12', 'gallery-photo-12', 'image', 'مؤتمرات وملتقيات', null, '2026-07-15', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.38 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.38 PM.jpeg', null, 1, 1],
            [13, 'تغطية مصورة من فعاليات معهد الجودة رقم 13', 'gallery-photo-13', 'image', 'حفلات تخرج ورش عمل', null, '2026-07-13', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.39 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.39 PM (1).jpeg', null, 0, 1],
            [14, 'تغطية مصورة من فعاليات معهد الجودة رقم 14', 'gallery-photo-14', 'image', 'فعاليات المعهد', null, '2026-07-11', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.39 PM (2).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.39 PM (2).jpeg', null, 0, 1],
            [15, 'تغطية مصورة من فعاليات معهد الجودة رقم 15', 'gallery-photo-15', 'image', 'استشارات واجتماعات', null, '2026-07-09', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.39 PM (3).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.39 PM (3).jpeg', null, 1, 1],
            [16, 'تغطية مصورة من فعاليات معهد الجودة رقم 16', 'gallery-photo-16', 'image', 'مؤتمرات وملتقيات', null, '2026-07-07', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.39 PM (4).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.39 PM (4).jpeg', null, 0, 1],
            [17, 'تغطية مصورة من فعاليات معهد الجودة رقم 17', 'gallery-photo-17', 'image', 'حفلات تخرج ورش عمل', null, '2026-07-05', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.39 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.39 PM.jpeg', null, 0, 1],
            [18, 'تغطية مصورة من فعاليات معهد الجودة رقم 18', 'gallery-photo-18', 'image', 'فعاليات المعهد', null, '2026-07-03', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.40 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.40 PM (1).jpeg', null, 1, 1],
            [19, 'تغطية مصورة من فعاليات معهد الجودة رقم 19', 'gallery-photo-19', 'image', 'استشارات واجتماعات', null, '2026-07-01', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.40 PM (2).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.40 PM (2).jpeg', null, 0, 1],
            [20, 'تغطية مصورة من فعاليات معهد الجودة رقم 20', 'gallery-photo-20', 'image', 'مؤتمرات وملتقيات', null, '2026-06-29', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.40 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.40 PM.jpeg', null, 0, 1],
            [21, 'تغطية مصورة من فعاليات معهد الجودة رقم 21', 'gallery-photo-21', 'image', 'حفلات تخرج ورش عمل', null, '2026-06-27', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.41 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.41 PM (1).jpeg', null, 1, 1],
            [22, 'تغطية مصورة من فعاليات معهد الجودة رقم 22', 'gallery-photo-22', 'image', 'فعاليات المعهد', null, '2026-06-25', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.41 PM (2).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.41 PM (2).jpeg', null, 0, 1],
            [23, 'تغطية مصورة من فعاليات معهد الجودة رقم 23', 'gallery-photo-23', 'image', 'استشارات واجتماعات', null, '2026-06-23', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.41 PM (3).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.41 PM (3).jpeg', null, 0, 1],
            [24, 'تغطية مصورة من فعاليات معهد الجودة رقم 24', 'gallery-photo-24', 'image', 'مؤتمرات وملتقيات', null, '2026-06-21', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.41 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.41 PM.jpeg', null, 1, 1],
            [25, 'تغطية مصورة من فعاليات معهد الجودة رقم 25', 'gallery-photo-25', 'image', 'حفلات تخرج ورش عمل', null, '2026-06-19', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.42 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.42 PM (1).jpeg', null, 0, 1],
            [26, 'تغطية مصورة من فعاليات معهد الجودة رقم 26', 'gallery-photo-26', 'image', 'فعاليات المعهد', null, '2026-06-17', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.42 PM (2).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.42 PM (2).jpeg', null, 0, 1],
            [27, 'تغطية مصورة من فعاليات معهد الجودة رقم 27', 'gallery-photo-27', 'image', 'استشارات واجتماعات', null, '2026-06-15', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.42 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.42 PM.jpeg', null, 1, 1],
            [28, 'تغطية مصورة من فعاليات معهد الجودة رقم 28', 'gallery-photo-28', 'image', 'مؤتمرات وملتقيات', null, '2026-06-13', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.43 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.43 PM (1).jpeg', null, 0, 1],
            [29, 'تغطية مصورة من فعاليات معهد الجودة رقم 29', 'gallery-photo-29', 'image', 'حفلات تخرج ورش عمل', null, '2026-06-11', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.43 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.43 PM.jpeg', null, 0, 1],
            [30, 'تغطية مصورة من فعاليات معهد الجودة رقم 30', 'gallery-photo-30', 'image', 'فعاليات المعهد', null, '2026-06-09', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.44 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.44 PM (1).jpeg', null, 1, 1],
            [31, 'تغطية مصورة من فعاليات معهد الجودة رقم 31', 'gallery-photo-31', 'image', 'استشارات واجتماعات', null, '2026-06-07', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.44 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.51.44 PM.jpeg', null, 0, 1],
            [32, 'تغطية مصورة من فعاليات معهد الجودة رقم 32', 'gallery-photo-32', 'image', 'مؤتمرات وملتقيات', null, '2026-06-05', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.41 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.41 PM (1).jpeg', null, 0, 1],
            [33, 'تغطية مصورة من فعاليات معهد الجودة رقم 33', 'gallery-photo-33', 'image', 'حفلات تخرج ورش عمل', null, '2026-06-03', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.41 PM (2).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.41 PM (2).jpeg', null, 1, 1],
            [34, 'تغطية مصورة من فعاليات معهد الجودة رقم 34', 'gallery-photo-34', 'image', 'فعاليات المعهد', null, '2026-06-01', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.41 PM (3).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.41 PM (3).jpeg', null, 0, 1],
            [35, 'تغطية مصورة من فعاليات معهد الجودة رقم 35', 'gallery-photo-35', 'image', 'استشارات واجتماعات', null, '2026-05-30', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.41 PM (4).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.41 PM (4).jpeg', null, 0, 1],
            [36, 'تغطية مصورة من فعاليات معهد الجودة رقم 36', 'gallery-photo-36', 'image', 'مؤتمرات وملتقيات', null, '2026-05-28', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.41 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.41 PM.jpeg', null, 1, 1],
            [37, 'تغطية مصورة من فعاليات معهد الجودة رقم 37', 'gallery-photo-37', 'image', 'حفلات تخرج ورش عمل', null, '2026-05-26', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.42 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.42 PM (1).jpeg', null, 0, 1],
            [38, 'تغطية مصورة من فعاليات معهد الجودة رقم 38', 'gallery-photo-38', 'image', 'فعاليات المعهد', null, '2026-05-24', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.42 PM (2).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.42 PM (2).jpeg', null, 0, 1],
            [39, 'تغطية مصورة من فعاليات معهد الجودة رقم 39', 'gallery-photo-39', 'image', 'استشارات واجتماعات', null, '2026-05-22', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.42 PM (3).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.42 PM (3).jpeg', null, 1, 1],
            [40, 'تغطية مصورة من فعاليات معهد الجودة رقم 40', 'gallery-photo-40', 'image', 'مؤتمرات وملتقيات', null, '2026-05-20', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.42 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.42 PM.jpeg', null, 0, 1],
            [41, 'تغطية مصورة من فعاليات معهد الجودة رقم 41', 'gallery-photo-41', 'image', 'حفلات تخرج ورش عمل', null, '2026-05-18', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM (1).jpeg', null, 0, 1],
            [42, 'تغطية مصورة من فعاليات معهد الجودة رقم 42', 'gallery-photo-42', 'image', 'فعاليات المعهد', null, '2026-05-16', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM (2).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM (2).jpeg', null, 1, 1],
            [43, 'تغطية مصورة من فعاليات معهد الجودة رقم 43', 'gallery-photo-43', 'image', 'استشارات واجتماعات', null, '2026-05-14', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM (3).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM (3).jpeg', null, 0, 1],
            [44, 'تغطية مصورة من فعاليات معهد الجودة رقم 44', 'gallery-photo-44', 'image', 'مؤتمرات وملتقيات', null, '2026-05-12', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM (4).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM (4).jpeg', null, 0, 1],
            [45, 'تغطية مصورة من فعاليات معهد الجودة رقم 45', 'gallery-photo-45', 'image', 'حفلات تخرج ورش عمل', null, '2026-05-10', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM (5).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM (5).jpeg', null, 1, 1],
            [46, 'تغطية مصورة من فعاليات معهد الجودة رقم 46', 'gallery-photo-46', 'image', 'فعاليات المعهد', null, '2026-05-08', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.43 PM.jpeg', null, 0, 1],
            [47, 'تغطية مصورة من فعاليات معهد الجودة رقم 47', 'gallery-photo-47', 'image', 'استشارات واجتماعات', null, '2026-05-06', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.44 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.44 PM (1).jpeg', null, 0, 1],
            [48, 'تغطية مصورة من فعاليات معهد الجودة رقم 48', 'gallery-photo-48', 'image', 'مؤتمرات وملتقيات', null, '2026-05-04', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.44 PM (2).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.44 PM (2).jpeg', null, 1, 1],
            [49, 'تغطية مصورة من فعاليات معهد الجودة رقم 49', 'gallery-photo-49', 'image', 'حفلات تخرج ورش عمل', null, '2026-05-02', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.44 PM (3).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.44 PM (3).jpeg', null, 0, 1],
            [50, 'تغطية مصورة من فعاليات معهد الجودة رقم 50', 'gallery-photo-50', 'image', 'فعاليات المعهد', null, '2026-04-30', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.44 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.54.44 PM.jpeg', null, 0, 1],
            [51, 'تغطية مصورة من فعاليات معهد الجودة رقم 51', 'gallery-photo-51', 'image', 'استشارات واجتماعات', null, '2026-04-28', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.24 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.24 PM (1).jpeg', null, 1, 1],
            [52, 'تغطية مصورة من فعاليات معهد الجودة رقم 52', 'gallery-photo-52', 'image', 'مؤتمرات وملتقيات', null, '2026-04-26', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.24 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.24 PM.jpeg', null, 0, 1],
            [53, 'تغطية مصورة من فعاليات معهد الجودة رقم 53', 'gallery-photo-53', 'image', 'حفلات تخرج ورش عمل', null, '2026-04-24', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.25 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.25 PM.jpeg', null, 0, 1],
            [54, 'تغطية مصورة من فعاليات معهد الجودة رقم 54', 'gallery-photo-54', 'image', 'فعاليات المعهد', null, '2026-04-22', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.26 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.26 PM.jpeg', null, 1, 1],
            [55, 'تغطية مصورة من فعاليات معهد الجودة رقم 55', 'gallery-photo-55', 'image', 'استشارات واجتماعات', null, '2026-04-20', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.27 PM (1).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.27 PM (1).jpeg', null, 0, 1],
            [56, 'تغطية مصورة من فعاليات معهد الجودة رقم 56', 'gallery-photo-56', 'image', 'مؤتمرات وملتقيات', null, '2026-04-18', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.27 PM (2).jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.27 PM (2).jpeg', null, 0, 1],
            [57, 'تغطية مصورة من فعاليات معهد الجودة رقم 57', 'gallery-photo-57', 'image', 'حفلات تخرج ورش عمل', null, '2026-04-16', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.27 PM.jpeg', 'assets/images/gallery/images/WhatsApp Image 2026-07-23 at 5.55.27 PM.jpeg', null, 1, 1],
        ];
        $keys = explode(',', 'id,title,slug,type,category,description,event_date,cover_image,media_path,video_url,is_featured,is_active');

        DB::transaction(function () use ($records, $keys, $now) {
            DB::table('galleries')->delete();
            foreach ($records as $row) {
                $record = array_combine($keys, $row);
                $record['created_at'] = $now;
                $record['updated_at'] = $now;
                DB::table('galleries')->insert($record);
            }
        });

        $sourceRoot = database_path('images/gallery');
        $targetRoot = public_path('assets/images/gallery');

        foreach (['images'] as $folder) {
            $source = $sourceRoot . DIRECTORY_SEPARATOR . $folder;
            $target = $targetRoot . DIRECTORY_SEPARATOR . $folder;

            if (File::isDirectory($source)) {
                File::ensureDirectoryExists($target);
                File::copyDirectory($source, $target);
            }
        }
    }
}
