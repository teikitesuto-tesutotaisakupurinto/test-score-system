import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const failures = [];
const checked = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else checked.push(full);
  }
}

walk(root);

const jsFiles = checked.filter(file => /\.(?:js|mjs|cjs)$/.test(file));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push(`JavaScript syntax: ${path.relative(root, file)}\n${result.stderr || result.stdout}`);
}

for (const file of checked.filter(file => file.endsWith(".html"))) {
  const html = fs.readFileSync(file, "utf8");
  const pattern = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    const src = match[1].trim();
    if (/^(?:https?:)?\/\//i.test(src) || /^(?:data:|blob:|#)/i.test(src)) continue;
    const clean = src.split(/[?#]/, 1)[0];
    const target = clean.startsWith("/")
      ? path.join(root, clean.slice(1))
      : path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(target)) {
      failures.push(`Missing script: ${path.relative(root, file)} -> ${src}`);
    }
  }
}

const renderPath = path.join(root, "render.yaml");
if (fs.existsSync(renderPath)) {
  const render = fs.readFileSync(renderPath, "utf8");
  for (const match of render.matchAll(/^\s*destination:\s*["']?([^\s"'#]+)["']?\s*$/gm)) {
    const destination = match[1];
    const target = path.join(root, destination.replace(/^\//, ""));
    if (!fs.existsSync(target)) failures.push(`Missing Render route destination: ${destination}`);
  }
}

const upload = fs.readFileSync(path.join(root, "js/teacher/answer-upload.js"), "utf8");
if (!/original_file_path:\s*originalPath/.test(upload) ||
    !/\.storage\s*\.from\(["']test-files["']\)\s*\.upload\(originalPath,\s*file/s.test(upload)) {
  failures.push("Answer upload must store the original file and persist its Storage path.");
}

const publish = fs.readFileSync(path.join(root, "js/teacher/test-publish.js"), "utf8");
if (!/\.in\(\s*["']layout_box_id["']\s*,\s*answerBoxIds\s*\)/s.test(publish)) {
  failures.push("Publication readiness must count only registered answer boxes.");
}

const security = fs.readFileSync(path.join(root, "supabase/security-hardening.sql"), "utf8");
if (!/and\s+public\.student_has_published_answer\(id\)/i.test(security)) {
  failures.push("Student test RLS must require the student's own published answer.");
}

if (failures.length) {
  console.error(failures.join("\n\n"));
  console.error(`\nValidation failed: ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`Validation passed: ${jsFiles.length} JavaScript files parsed; local script references and Render destinations checked; workflow invariants verified.`);
