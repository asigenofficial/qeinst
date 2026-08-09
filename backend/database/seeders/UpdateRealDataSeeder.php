<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * @deprecated Kept only for backward compatibility with older deployment notes.
 * The authoritative catalog is WebsiteCatalogSeeder.
 */
class UpdateRealDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(WebsiteCatalogSeeder::class);
    }
}
