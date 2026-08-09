<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Rebuild the public website catalog from deterministic, reviewed data.
     * No demo users, passwords, fake registrations, or random transactional rows are created.
     */
    public function run(): void
    {
        $this->call([
            WebsiteCatalogSeeder::class,
            SiteContentSeeder::class,
            GalleryMediaSeeder::class,
        ]);
    }
}
