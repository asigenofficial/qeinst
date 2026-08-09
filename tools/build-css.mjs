#!/usr/bin/env node
/**
 * Build assets/css/app.css from the modules in assets/css/src/.
 *
 *   node tools/build-css.mjs           build the bundle
 *   node tools/build-css.mjs --check   exit 1 if the bundle is out of date (CI)
 *
 * The module order in src/manifest.json is authoritative: the modules are
 * contiguous slices of the stylesheet, so concatenating them in that order
 * reproduces the exact cascade. Never reorder them by hand.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(here, "..", "assets", "css", "src")
const manifestPath = join(srcDir, "manifest.json")

if (!existsSync(manifestPath)) {
	console.error(`\u2717 missing ${manifestPath}`)
	process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const outPath = resolve(srcDir, manifest.output ?? "../app.css")

const banner = [
	"/*!",
	" * QEI \u2014 Quality Experts Institute for Training",
	" * Generated file \u2014 DO NOT EDIT DIRECTLY.",
	" * Edit the modules in assets/css/src/ then run: npm run build:css",
	` * Modules: ${manifest.order.length}`,
	" */",
	"",
].join("\n")

const chunks = manifest.order.map((rel) => {
	const file = join(srcDir, rel)
	if (!existsSync(file)) {
		console.error(`\u2717 missing module: ${rel}`)
		process.exit(1)
	}
	return `/* ---------- ${rel} ---------- */\n${readFileSync(file, "utf8").trim()}\n`
})

const bundle = `${banner}\n${chunks.join("\n")}`

if (process.argv.includes("--check")) {
	const current = existsSync(outPath) ? readFileSync(outPath, "utf8") : ""
	if (current !== bundle) {
		console.error("\u2717 app.css is stale \u2014 run: npm run build:css")
		process.exit(1)
	}
	console.log("\u2713 app.css is up to date")
	process.exit(0)
}

writeFileSync(outPath, bundle)
console.log(
	`\u2713 built assets/css/app.css from ${manifest.order.length} modules (${bundle.length.toLocaleString("en-US")} bytes)`,
)
