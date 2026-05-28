/**
 * Imports images and PDFs from `incoming/` into menus.json + public/menu-images/.
 *
 *   npm run import
 *
 * Behavior:
 *   • Images: incoming/images/<categoryId>/<itemName>[__<price>].<ext>
 *       - If an existing item with matching name exists in that category → set its image.
 *       - Otherwise create a draft item (hidden:true, _draft:true).
 *       - Files copied to public/menu-images/<categoryId>/.
 *   • PDFs: incoming/pdfs/<name>.pdf
 *       - Extracts text via pdf-parse.
 *       - Heuristically detects "name + price" lines.
 *       - Adds detected items as drafts under a new category `pdf-<name>` (hidden:true).
 *
 * The script is idempotent — re-running it does not duplicate.
 * A markdown report is written to incoming/IMPORT_REPORT.md.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { createRequire } from "node:module";

const requireFn = createRequire(import.meta.url);

// pdf-parse triggers a debug code path when its module index sees an isMain
// context with no input; importing the inner lib avoids that.
let pdfParse: ((buf: Buffer) => Promise<{ text: string }>) | null = null;
try {
  pdfParse = requireFn("pdf-parse/lib/pdf-parse.js");
} catch {
  pdfParse = null;
}

const ROOT = process.cwd();
const MENUS_FILE = join(ROOT, "data/menus.json");
const INCOMING_IMG_DIR = join(ROOT, "incoming/images");
const INCOMING_PDF_DIR = join(ROOT, "incoming/pdfs");
const PUBLIC_IMG_DIR = join(ROOT, "public/menu-images");
const REPORT_FILE = join(ROOT, "incoming/IMPORT_REPORT.md");

const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

type Item = {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  price: number;
  image?: string;
  badges?: string[];
  hidden?: boolean;
  _draft?: boolean;
  _source?: string;
};
type Category = {
  id: string;
  name: string;
  nameEn?: string;
  accent?: string;
  items: Item[];
};
type Menu = {
  restaurant: { name: string; tagline?: string; currency: string };
  display: { slideDurationMs: number; showCategoryIntro: boolean; categoryIntroDurationMs: number };
  categories: Category[];
};

function loadMenu(): Menu {
  return JSON.parse(readFileSync(MENUS_FILE, "utf8")) as Menu;
}

function saveMenu(menu: Menu) {
  writeFileSync(MENUS_FILE, JSON.stringify(menu, null, 2) + "\n", "utf8");
}

function ensureCategory(menu: Menu, id: string, name: string): Category {
  let cat = menu.categories.find((c) => c.id === id);
  if (cat) return cat;
  cat = { id, name, accent: "#888888", items: [] };
  menu.categories.push(cat);
  return cat;
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseImageFilename(file: string): { name: string; price?: number } {
  const base = basename(file, extname(file));
  const m = base.match(/^(.+?)(?:__(\d+))?$/);
  const name = (m?.[1] ?? base).trim();
  const price = m?.[2] ? parseInt(m[2], 10) : undefined;
  return { name, price };
}

// ---- Image import ----

type ImgEntry = { categoryFolder: string; fullPath: string; fileName: string };

function listIncomingImages(): ImgEntry[] {
  if (!existsSync(INCOMING_IMG_DIR)) return [];
  const out: ImgEntry[] = [];
  for (const entry of readdirSync(INCOMING_IMG_DIR)) {
    const sub = join(INCOMING_IMG_DIR, entry);
    if (!statSync(sub).isDirectory()) continue;
    for (const f of readdirSync(sub)) {
      if (f.startsWith(".")) continue;
      const ext = extname(f).toLowerCase();
      if (!IMG_EXTS.has(ext)) continue;
      out.push({ categoryFolder: entry, fullPath: join(sub, f), fileName: f });
    }
  }
  return out;
}

function importImages(menu: Menu, report: string[]): void {
  const imgs = listIncomingImages();
  report.push("## 📸 Images\n");

  if (imgs.length === 0) {
    report.push("_No images in `incoming/images/`._\n");
    return;
  }

  let attached = 0;
  let drafted = 0;

  for (const img of imgs) {
    const catId = img.categoryFolder === "_uncategorized" ? "imported" : img.categoryFolder;
    const catName =
      img.categoryFolder === "_uncategorized" ? "未分類（要確認）" : img.categoryFolder;
    const cat = ensureCategory(menu, catId, catName);

    const { name, price } = parseImageFilename(img.fileName);

    // Copy to public/menu-images/<catId>/
    const destDir = join(PUBLIC_IMG_DIR, catId);
    mkdirSync(destDir, { recursive: true });
    const destPath = join(destDir, img.fileName);
    copyFileSync(img.fullPath, destPath);
    const publicUrl = `/menu-images/${catId}/${img.fileName}`;

    const existing = cat.items.find((i) => i.name === name);
    if (existing) {
      existing.image = publicUrl;
      attached++;
      report.push(`- ✓ \`${catId}/${name}\` ← 画像を紐付け`);
    } else {
      cat.items.push({
        id: randomId("img"),
        name,
        price: price ?? 0,
        image: publicUrl,
        hidden: true,
        _draft: true,
        _source: `incoming/images/${img.categoryFolder}/${img.fileName}`,
      });
      drafted++;
      report.push(
        `- ➕ \`${catId}/${name}\` ← 新規ドラフト${price ? ` (¥${price.toLocaleString("ja-JP")})` : "（価格未設定）"}`,
      );
    }
  }

  report.push("");
  report.push(`**${attached}** 件: 既存メニューに画像を紐付け`);
  report.push(`**${drafted}** 件: 新規ドラフト追加（\`hidden: true\`）`);
  report.push("");
}

// ---- PDF import ----

const PRICE_LINE = /^(.+?)[\s\t　]+[¥￥]?(\d{2,5}(?:,\d{3})*)円?$/;
const PRICE_ONLY = /^[¥￥]?(\d{2,5}(?:,\d{3})*)円?$/;

function detectItems(text: string): { name: string; price: number }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[\s　]+$/g, "").replace(/^[\s　]+/g, ""))
    .filter((l) => l.length > 0);

  const found: { name: string; price: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const m1 = line.match(PRICE_LINE);
    if (m1) {
      const name = m1[1].trim();
      const price = parseInt(m1[2].replace(/,/g, ""), 10);
      if (name.length >= 2 && name.length <= 40 && price >= 100 && price <= 99999) {
        found.push({ name, price });
        continue;
      }
    }

    const m2 = line.match(PRICE_ONLY);
    if (m2 && i > 0) {
      const prev = lines[i - 1];
      if (prev.length >= 2 && prev.length <= 40 && !PRICE_LINE.test(prev) && !PRICE_ONLY.test(prev)) {
        const price = parseInt(m2[1].replace(/,/g, ""), 10);
        if (price >= 100 && price <= 99999) {
          found.push({ name: prev, price });
        }
      }
    }
  }

  // Dedup by name (keep first)
  const seen = new Set<string>();
  return found.filter((c) => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

async function importPdfs(menu: Menu, report: string[]): Promise<void> {
  report.push("## 📄 PDFs\n");

  if (!existsSync(INCOMING_PDF_DIR)) {
    report.push("_No `incoming/pdfs/` folder._\n");
    return;
  }
  const pdfFiles = readdirSync(INCOMING_PDF_DIR).filter((f) =>
    f.toLowerCase().endsWith(".pdf"),
  );
  if (pdfFiles.length === 0) {
    report.push("_No PDFs in `incoming/pdfs/`._\n");
    return;
  }
  if (!pdfParse) {
    report.push("⚠️ `pdf-parse` が読み込めません。`npm install` を実行してください。\n");
    return;
  }

  for (const pdfFile of pdfFiles) {
    report.push(`### ${pdfFile}\n`);
    try {
      const buffer = readFileSync(join(INCOMING_PDF_DIR, pdfFile));
      const data = await pdfParse(buffer);
      const text = data.text ?? "";

      if (text.trim().length < 20) {
        report.push(
          "⚠️ ほぼテキストが抽出できませんでした。スキャン画像のみのPDFの可能性。OCR推奨。\n",
        );
        continue;
      }

      const items = detectItems(text);

      if (items.length === 0) {
        report.push("⚠️ 価格パターンを検出できませんでした。テキスト先頭:");
        report.push("");
        report.push("```");
        report.push(text.slice(0, 600));
        report.push("```");
        report.push("");
        continue;
      }

      const slug = basename(pdfFile, ".pdf").toLowerCase().replace(/[^\w\-]+/g, "-");
      const catId = `pdf-${slug}`;
      const catName = basename(pdfFile, ".pdf");
      const cat = ensureCategory(menu, catId, catName);

      let added = 0;
      let skipped = 0;
      for (const it of items) {
        if (cat.items.some((x) => x.name === it.name)) {
          skipped++;
          continue;
        }
        cat.items.push({
          id: randomId("pdf"),
          name: it.name,
          price: it.price,
          hidden: true,
          _draft: true,
          _source: `incoming/pdfs/${pdfFile}`,
        });
        added++;
      }

      report.push(
        `- 検出 **${items.length}** 件、追加 **${added}** 件、既存スキップ **${skipped}** 件 → カテゴリ \`${catId}\``,
      );
      report.push(`- レビュー後 \`hidden: false\` で表示開始\n`);
    } catch (e) {
      report.push(`⚠️ パース失敗: ${(e as Error).message}\n`);
    }
  }
}

// ---- Main ----

async function main(): Promise<void> {
  if (!existsSync(MENUS_FILE)) {
    console.error("✗ data/menus.json が見つかりません");
    process.exit(2);
  }

  const menu = loadMenu();
  const report: string[] = [];
  report.push("# Import Report");
  report.push(`Generated: ${new Date().toISOString()}\n`);

  importImages(menu, report);
  await importPdfs(menu, report);

  saveMenu(menu);
  writeFileSync(REPORT_FILE, report.join("\n") + "\n", "utf8");

  console.log("✓ Import complete");
  console.log(`  Report: ${REPORT_FILE}`);
  console.log(`  Run 'git diff data/menus.json' to review changes`);
}

main().catch((e) => {
  console.error("✗ Import failed:", e);
  process.exit(1);
});
