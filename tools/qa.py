#!/usr/bin/env python3
"""QEINST repository quality checks.

Runs deterministic checks for the static frontend and the packaged SQLite catalog.
No network access is required.
"""
from __future__ import annotations

import re
import sqlite3
import subprocess
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []
WARNINGS: list[str] = []


def error(msg: str) -> None:
    ERRORS.append(msg)


def warn(msg: str) -> None:
    WARNINGS.append(msg)


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[tuple[str, str]] = []
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        for attr in ("src", "href", "poster"):
            value = attrs.get(attr)
            if value:
                self.refs.append((attr, value))
        if attrs.get("srcset"):
            for candidate in attrs["srcset"].split(","):
                url = candidate.strip().split()[0] if candidate.strip() else ""
                if url:
                    self.refs.append(("srcset", url))


def local_target(page: Path, raw: str) -> Path | None:
    raw = raw.strip()
    if not raw or raw.startswith(("#", "mailto:", "tel:", "javascript:", "data:", "blob:")):
        return None
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc:
        return None
    path = unquote(parsed.path)
    if not path or path == "/":
        return None
    if path.startswith("/"):
        return ROOT / path.lstrip("/")
    return (page.parent / path).resolve()


def check_html() -> None:
    html_files = sorted(p for p in ROOT.rglob("*.html") if "vendor" not in p.parts and ".review-backup" not in p.parts)
    if len(html_files) < 40:
        error(f"Expected a full multi-page site; found only {len(html_files)} HTML files")
    missing: list[str] = []
    duplicate_ids: list[str] = []
    for page in html_files:
        parser = AssetParser()
        try:
            parser.feed(page.read_text(encoding="utf-8", errors="replace"))
        except Exception as exc:
            error(f"HTML parse failed: {page.relative_to(ROOT)}: {exc}")
            continue
        counts = Counter(parser.ids)
        for ident, count in counts.items():
            if count > 1:
                duplicate_ids.append(f"{page.relative_to(ROOT)} -> #{ident} x{count}")
        for attr, ref in parser.refs:
            target = local_target(page, ref)
            if target is None:
                continue
            try:
                target.relative_to(ROOT.resolve())
            except ValueError:
                missing.append(f"{page.relative_to(ROOT)} [{attr}] -> {ref} (outside project)")
                continue
            # Extensionless navigation paths are server routes and are not static assets.
            if not target.exists() and (Path(urlsplit(ref).path).suffix or attr in {"src", "poster", "srcset"}):
                missing.append(f"{page.relative_to(ROOT)} [{attr}] -> {ref}")
    if missing:
        error("Missing local HTML assets/links:\n  " + "\n  ".join(missing[:40]))
    if duplicate_ids:
        error("Duplicate HTML ids:\n  " + "\n  ".join(duplicate_ids[:40]))
    print(f"[OK] HTML: {len(html_files)} pages, local references valid, ids unique")


def check_css_urls() -> None:
    missing: list[str] = []
    css_files = [ROOT / "assets/css/app.css"]
    for css in css_files:
        text = css.read_text(encoding="utf-8", errors="replace")
        for raw in re.findall(r"url\(\s*(['\"]?)(.*?)\1\s*\)", text, re.I):
            ref = raw[1].strip()
            if not ref or ref.startswith(("data:", "http://", "https://", "#")):
                continue
            target = (css.parent / unquote(urlsplit(ref).path)).resolve()
            if not target.exists():
                missing.append(f"{css.relative_to(ROOT)} -> {ref}")
    if missing:
        error("Missing CSS url() assets:\n  " + "\n  ".join(missing[:40]))
    print(f"[OK] CSS: checked {len(css_files)} files")


def check_javascript() -> None:
    js_files = sorted((ROOT / "assets/js").glob("*.js"))
    for js in js_files:
        proc = subprocess.run(["node", "--check", str(js)], capture_output=True, text=True)
        if proc.returncode:
            error(f"JavaScript syntax: {js.relative_to(ROOT)}\n{proc.stderr.strip()}")
    ui = (ROOT / "assets/js/ui-runtime.js").read_text(encoding="utf-8")
    names = re.findall(r"^\s*function\s+([A-Za-z_$][\w$]*)\s*\(", ui, re.M)
    dups = {name: count for name, count in Counter(names).items() if count > 1}
    if dups:
        error(f"Duplicate ui-runtime function declarations: {dups}")
    if "عن بُعد (مسجل)" in ui:
        error("Fabricated recorded-training mode still exists in ui-runtime.js")
    print(f"[OK] JavaScript: {len(js_files)} files, syntax valid, no duplicate runtime functions")


def check_php() -> None:
    targets: list[Path] = []
    for rel in ["backend/app", "backend/routes", "backend/config", "backend/database/migrations", "backend/database/seeders", "backend/bootstrap"]:
        targets.extend((ROOT / rel).rglob("*.php"))
    for php in sorted(set(targets)):
        proc = subprocess.run(["php", "-l", str(php)], capture_output=True, text=True)
        if proc.returncode:
            error(f"PHP syntax: {php.relative_to(ROOT)}\n{proc.stdout.strip()}\n{proc.stderr.strip()}")
    route_text = (ROOT / "backend/routes/api.php").read_text(encoding="utf-8")
    if re.search(r"/seed-(?:clients|galleries|registrations)", route_text):
        error("Public database seed endpoint still exists in API routes")
    if (ROOT / "backend/app/Http/Middleware/EnsureDatabaseReady.php").exists():
        error("Obsolete runtime schema mutation middleware still exists")
    if (ROOT / "backend/database/qeinst_db.sql").exists():
        error("Obsolete qeinst_db.sql dump still exists; migrations + reviewed seeders are authoritative")
    for required in ["WebsiteCatalogSeeder.php", "SiteContentSeeder.php", "GalleryMediaSeeder.php"]:
        if not (ROOT / "backend/database/seeders" / required).exists():
            error(f"Required deterministic seeder is missing: {required}")
    print(f"[OK] PHP: {len(set(targets))} application/config/database files lint clean")


def check_database() -> None:
    db = ROOT / "backend/database/database.sqlite"
    if not db.exists():
        error("Packaged SQLite database is missing")
        return
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    try:
        program_count = con.execute("SELECT COUNT(*) FROM programs WHERE is_active=1").fetchone()[0]
        if program_count != 50:
            error(f"Expected 50 active programs, found {program_count}")
        unique_images = con.execute("SELECT COUNT(DISTINCT image) FROM programs WHERE is_active=1").fetchone()[0]
        if unique_images != 50:
            error(f"Expected 50 unique program image paths, found {unique_images}")
        category_count = con.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
        if category_count != 12:
            error(f"Expected 12 program categories, found {category_count}")
        client_count = con.execute("SELECT COUNT(*) FROM clients WHERE is_active=1").fetchone()[0]
        if client_count != 20:
            error(f"Expected 20 active clients/partners, found {client_count}")

        problems = con.execute("""
            SELECT p.id, p.title
            FROM programs p
            LEFT JOIN categories c ON c.id=p.category_id
            WHERE p.is_active=1 AND (p.category_id IS NULL OR c.id IS NULL OR p.image IS NULL OR trim(p.image)='')
        """).fetchall()
        if problems:
            error("Programs missing category/image: " + ", ".join(str(r["id"]) for r in problems))

        no_schedule = con.execute("""
            SELECT p.id FROM programs p
            LEFT JOIN program_schedules s ON s.program_id=p.id
            WHERE p.is_active=1
            GROUP BY p.id HAVING COUNT(s.id)=0
        """).fetchall()
        if no_schedule:
            error("Programs missing schedules: " + ", ".join(str(r[0]) for r in no_schedule))

        for row in con.execute("SELECT id,image FROM programs WHERE is_active=1"):
            front = ROOT / row["image"]
            back = ROOT / "backend/public" / row["image"]
            if not front.exists():
                error(f"Program {row['id']} frontend image missing: {row['image']}")
            if not back.exists():
                error(f"Program {row['id']} backend public mirror missing: {row['image']}")

        for row in con.execute("SELECT id,name,logo FROM clients WHERE is_active=1"):
            front = ROOT / row["logo"]
            back = ROOT / "backend/public" / row["logo"]
            if not front.exists():
                error(f"Client {row['id']} frontend logo missing: {row['logo']}")
            if not back.exists():
                error(f"Client {row['id']} backend public mirror missing: {row['logo']}")

        hearing = con.execute("SELECT logo,type FROM clients WHERE id=19 OR name LIKE '%السمعية%' LIMIT 1").fetchone()
        if not hearing or hearing["logo"] != "assets/images/clients/saudi-hearing.jpg":
            error("Saudi Association for Hearing Impairment is not linked to corrected logo")
        elif hearing["type"] != "غير ربحي":
            error("Saudi Association for Hearing Impairment should be classified as غير ربحي")

        forbidden_titles = ["استراتيحية", "الإداء", "بئية", "المحفوضات", "في في", "الإكترون"]
        all_titles = "\n".join(r[0] for r in con.execute("SELECT title FROM programs"))
        leftovers = [t for t in forbidden_titles if t in all_titles]
        if leftovers:
            error(f"Known course-title typos remain: {leftovers}")

        if con.execute("SELECT COUNT(*) FROM program_schedules WHERE execution_mode LIKE '%مسجل%'").fetchone()[0]:
            error("Database still contains fabricated recorded-training mode")

        gallery_count = con.execute("SELECT COUNT(*) FROM galleries WHERE is_active=1").fetchone()[0]
        if gallery_count != 57:
            error(f"Expected 57 active gallery images, found {gallery_count}")
        video_count = con.execute("SELECT COUNT(*) FROM galleries WHERE type='video'").fetchone()[0]
        if video_count != 0:
            error(f"Gallery still contains video rows: {video_count}")
        described_gallery = con.execute("SELECT COUNT(*) FROM galleries WHERE description IS NOT NULL AND TRIM(description) <> ''").fetchone()[0]
        if described_gallery != 0:
            error(f"Gallery still contains per-image descriptions: {described_gallery}")
        for row in con.execute("SELECT id,type,cover_image,media_path FROM galleries WHERE is_active=1"):
            candidate = row["media_path"] or row["cover_image"]
            if candidate:
                front = ROOT / candidate
                back = ROOT / "backend/public" / candidate
                if not front.exists():
                    error(f"Gallery {row['id']} frontend media missing: {candidate}")
                if not back.exists():
                    error(f"Gallery {row['id']} backend public media missing: {candidate}")

        article_table = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='articles'").fetchone()
        if article_table:
            error("Articles table should not exist in the final no-news build")
        solution_count = con.execute("SELECT COUNT(*) FROM corporate_solutions WHERE is_active=1").fetchone()[0]
        story_count = con.execute("SELECT COUNT(*) FROM success_stories WHERE is_active=1").fetchone()[0]
        if solution_count != 6:
            error(f"Expected 6 corporate solutions, found {solution_count}")
        if story_count != 3:
            error(f"Expected 3 non-fabricated impact examples, found {story_count}")
        for row in con.execute("SELECT id,title,image FROM corporate_solutions WHERE is_active=1"):
            front = ROOT / row["image"]
            back = ROOT / "backend/public" / row["image"]
            if not front.exists():
                error(f"Corporate solution {row['id']} frontend image missing: {row['image']}")
            if not back.exists():
                error(f"Corporate solution {row['id']} backend public mirror missing: {row['image']}")

        for table in ["users", "registrations", "contact_messages", "corporate_requests", "personal_access_tokens"]:
            count = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            if count != 0:
                error(f"Packaged database contains demo/transactional rows in {table}: {count}")

        registration_columns = {r[1] for r in con.execute("PRAGMA table_info(registrations)")}
        if "summary_token_hash" not in registration_columns:
            error("Registration summary token hash column is missing")
        token_table = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='personal_access_tokens'").fetchone()
        if not token_table:
            error("Sanctum personal_access_tokens table is missing")

        print(
            f"[OK] Database: {program_count} programs / {category_count} categories / "
            f"{client_count} clients / {gallery_count} gallery rows / {unique_images} unique course images"
        )
    finally:
        con.close()


def check_copy_consistency() -> None:
    active_html = "\n".join(
        p.read_text(encoding="utf-8", errors="replace")
        for p in ROOT.rglob("*.html")
        if "vendor" not in p.parts
    )
    if "عن بُعد (مسجل)" in active_html:
        error("A visible HTML page still contains 'عن بُعد (مسجل)'")
    solutions_html = (ROOT / "solutions/solutions.html").read_text(encoding="utf-8", errors="replace")
    if solutions_html.count('class="solution-card-link"') != 6:
        error("Corporate solutions page must contain six static fallback cards")
    ui_runtime = (ROOT / "assets/js/ui-runtime.js").read_text(encoding="utf-8", errors="replace")
    if 'solPageGrid && solPageGrid.children.length === 0' not in ui_runtime:
        error("Corporate solutions loader can still hide the static fallback")
    stale_phrases = ["15 - 19 يونيو 2024", "120<small>متدرب", "95%<small>تحسن", "محتوى مؤقت - بحاجة اعتماد العميل"]
    leftovers_stale = [term for term in stale_phrases if term in active_html]
    if leftovers_stale:
        error(f"Stale/fabricated visible placeholder copy remains: {leftovers_stale}")
    legacy_terms = ["الاعتمادات والشراكات", "اعتمادات وشراكات", "اعتماداتنا وعملاؤنا", "عملاؤنا وشراكاتنا"]
    leftovers = [term for term in legacy_terms if term in active_html]
    if leftovers:
        error(f"Legacy clients/accreditations terminology remains: {leftovers}")
    print("[OK] Copy: course modes and clients/partners terminology are consistent")


def main() -> int:
    checks = [check_html, check_css_urls, check_javascript, check_php, check_database, check_copy_consistency]
    for check in checks:
        try:
            check()
        except Exception as exc:
            error(f"{check.__name__} crashed: {exc}")

    if WARNINGS:
        print("\nWARNINGS:")
        for item in WARNINGS:
            print(" -", item)
    if ERRORS:
        print("\nQA FAILED:")
        for item in ERRORS:
            print(" -", item)
        return 1
    print("\nQA PASSED: repository checks completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
