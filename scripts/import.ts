/**
 * Imports images and PDFs from `incoming/` into menus.json + public/menu-images/.
 *
 *   npm run import
 *
 * Image rules:
 *   • incoming/images/<categoryId>/<itemName>[__price].(jpg|png|webp)
 *     → folder = category id; filename = item name; __price optional
 *   • incoming/images/<itemName>.<ext>  (root-level)
 *     → treated as _uncategorized
 *   • Matching against existing menus.json items:
 *     1. exact name match in the same folder's category
 *     2. exact name match in any category
 *     3. fuzzy (substring + normalized hiragana/katakana) in any category
 *     If no match → created as draft (hidden:true, _draft:true)
 *
 * PDF rules:
 *   • incoming/pdfs/<name>.pdf → extracted, name+price detected, drafts added
 *     under category `pdf-<name>`. Items whose name already exists *anywhere*
 *     in menus.json are skipped.
 *   • Non-PDF files in incoming/pdfs/ → warned, not processed.
 *
 * Output:
 *   • data/menus.json updated in place
 *   • public/menu-images/<categoryId>/ — copies of source images
 *   • incoming/IMPORT_REPORT.md — human-readable report
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

// ---- Utils ----

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

/** Normalize: NFKC + lowercase + hiragana→katakana + strip spaces +
 *  strip trailing variant numbers ("ウニクリームパスタ2" → "ウニクリームパスタ").
 *  Won't strip digits after `_` (so "IMG_7922" stays distinct from "IMG_7923"). */
function norm(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\s\t　・]+/g, "")
    .replace(/(?<![_a-z0-9])[0-9]{1,2}$/, "");
}

function parseImageFilename(file: string): { name: string; price?: number } {
  const base = basename(file, extname(file));
  const m = base.match(/^(.+?)(?:__(\d+))?$/);
  const name = (m?.[1] ?? base).trim();
  const price = m?.[2] ? parseInt(m[2], 10) : undefined;
  return { name, price };
}

/** Search menu for an item matching `name`. Returns {category, item, kind}. */
function findMatch(
  menu: Menu,
  name: string,
  preferCategoryId?: string,
): { category: Category; item: Item; kind: "exact-same-cat" | "exact-any" | "fuzzy-any" } | null {
  const target = norm(name);

  if (preferCategoryId) {
    const cat = menu.categories.find((c) => c.id === preferCategoryId);
    if (cat) {
      const it = cat.items.find((i) => norm(i.name) === target);
      if (it) return { category: cat, item: it, kind: "exact-same-cat" };
    }
  }

  for (const cat of menu.categories) {
    const it = cat.items.find((i) => norm(i.name) === target);
    if (it) return { category: cat, item: it, kind: "exact-any" };
  }

  // Fuzzy: substring (image-name appears in item-name, or vice versa)
  // Pick the longest item-name match (most specific).
  let best: { category: Category; item: Item; score: number } | null = null;
  for (const cat of menu.categories) {
    for (const it of cat.items) {
      const a = norm(it.name);
      const b = target;
      if (a.length < 2 || b.length < 2) continue;
      if (a.includes(b) || b.includes(a)) {
        const score = Math.min(a.length, b.length);
        if (!best || score > best.score) best = { category: cat, item: it, score };
      }
    }
  }
  if (best) return { category: best.category, item: best.item, kind: "fuzzy-any" };
  return null;
}

// ---- Image import ----

type ImgEntry = { categoryFolder: string; fullPath: string; fileName: string };

function listIncomingImages(): ImgEntry[] {
  if (!existsSync(INCOMING_IMG_DIR)) return [];
  const out: ImgEntry[] = [];

  // Root-level files: treat as _uncategorized
  for (const f of readdirSync(INCOMING_IMG_DIR)) {
    if (f.startsWith(".")) continue;
    const p = join(INCOMING_IMG_DIR, f);
    if (statSync(p).isDirectory()) continue;
    const ext = extname(f).toLowerCase();
    if (!IMG_EXTS.has(ext)) continue;
    out.push({ categoryFolder: "_uncategorized", fullPath: p, fileName: f });
  }

  // Subfolders
  for (const entry of readdirSync(INCOMING_IMG_DIR)) {
    if (entry.startsWith(".")) continue;
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
    report.push("_No images found._\n");
    return;
  }

  let attachedExact = 0;
  let attachedFuzzy = 0;
  let drafted = 0;
  const unnamedDrafts: string[] = [];

  for (const img of imgs) {
    const { name, price } = parseImageFilename(img.fileName);

    // Try matching across all categories (prefer same category folder if it exists)
    const match = findMatch(
      menu,
      name,
      img.categoryFolder === "_uncategorized" ? undefined : img.categoryFolder,
    );

    // Decide target category
    let targetCat: Category;
    if (match) {
      targetCat = match.category;
    } else if (img.categoryFolder === "_uncategorized") {
      targetCat = ensureCategory(menu, "imported", "未分類（要確認）");
    } else {
      targetCat = ensureCategory(menu, img.categoryFolder, img.categoryFolder);
    }

    // Copy file to public/menu-images/<cat>/
    // Normalize filename to NFC — macOS HFS+/APFS tends to give NFD, but
    // Vercel/Linux serves filenames in NFC. Without normalizing, files
    // copied from macOS-typed names 404 in production.
    const destDir = join(PUBLIC_IMG_DIR, targetCat.id);
    mkdirSync(destDir, { recursive: true });
    const destFileName = img.fileName.normalize("NFC");
    const destPath = join(destDir, destFileName);
    copyFileSync(img.fullPath, destPath);
    const publicUrl = `/menu-images/${encodeURIComponent(targetCat.id)}/${encodeURIComponent(destFileName)}`;

    if (match) {
      match.item.image = publicUrl;
      if (match.kind === "fuzzy-any") {
        attachedFuzzy++;
        report.push(
          `- 🔍 \`${name}\` → **${match.category.id}** / **${match.item.name}** (fuzzy match)`,
        );
      } else {
        attachedExact++;
        report.push(`- ✓ \`${name}\` → **${match.category.id}** / **${match.item.name}**`);
      }
    } else {
      const isUnnamed = /^img_?\d+$/i.test(name);
      const newItem: Item = {
        id: randomId(isUnnamed ? "review" : "img"),
        name: isUnnamed ? `（要確認: ${img.fileName}）` : name,
        price: price ?? 0,
        image: publicUrl,
        hidden: true,
        _draft: true,
        _source: `incoming/images/${img.categoryFolder}/${img.fileName}`,
      };
      targetCat.items.push(newItem);
      drafted++;
      if (isUnnamed) unnamedDrafts.push(img.fileName);
      else
        report.push(
          `- ➕ \`${name}\` → 新規ドラフトに追加 (\`${targetCat.id}\`, \`hidden:true\`)${price ? ` ¥${price.toLocaleString("ja-JP")}` : ""}`,
        );
    }
  }

  report.push("");
  report.push(`**${attachedExact}** 件: 完全一致で既存メニューに画像紐付け`);
  report.push(`**${attachedFuzzy}** 件: 部分一致で画像紐付け（要確認推奨）`);
  report.push(`**${drafted}** 件: 新規ドラフト追加（\`hidden: true\`）`);
  if (unnamedDrafts.length > 0) {
    report.push("");
    report.push(`### 🤔 名前不明の画像 (${unnamedDrafts.length}件)`);
    report.push("");
    report.push("`IMG_XXXX.jpg` 形式の画像は料理名が判別できないため、`imported` カテゴリに `hidden:true` で追加しました。");
    report.push("対応方法（いずれか）：");
    report.push("");
    report.push("1. **ファイルをリネーム**して再 `npm run import` — 例: `IMG_7922.jpg` → `生ハムユッケ.jpg` にすると既存メニューに紐付きます");
    report.push("2. **不要なら削除** — 食事中の風景写真等は `incoming/images/_uncategorized/` から削除");
    report.push("3. **このまま手動編集** — `data/menus.json` の `imported` カテゴリで `name` を直して `hidden:false` に");
    report.push("");
    report.push("対象ファイル:");
    report.push("");
    report.push("```");
    unnamedDrafts.slice(0, 30).forEach((f) => report.push(f));
    if (unnamedDrafts.length > 30) report.push(`...他 ${unnamedDrafts.length - 30} 件`);
    report.push("```");
  }
  report.push("");
}

// ---- PDF import ----

const PRICE_LINE = /^(.+?)[\s\t　]+[¥￥]?(\d{2,5}(?:,\d{3})*)円?$/;
const PRICE_ONLY = /^[¥￥]?(\d{2,5}(?:,\d{3})*)円?$/;

/** Heuristic: looks like a menu item name (not a description fragment). */
function looksLikeItemName(name: string): boolean {
  if (name.length < 2 || name.length > 30) return false;
  // Skip lines ending with sentence punctuation (descriptions)
  if (/[。！？!?…]\s*$/.test(name) || /\.\.\.?$/.test(name)) return false;
  // Skip names with parentheses (usually annotations/modifiers in this PDF)
  if (/[()（）]/.test(name)) return false;
  // Skip names starting with a digit (often a stray price)
  if (/^[¥￥]?\d/.test(name)) return false;
  // Skip names that are mostly description-y (too many particles)
  const particles = (name.match(/[をにがでとはのも]/g) ?? []).length;
  if (particles >= 3) return false;
  return true;
}

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
      if (looksLikeItemName(name) && price >= 100 && price <= 99999) {
        found.push({ name, price });
        continue;
      }
    }
    const m2 = line.match(PRICE_ONLY);
    if (m2 && i > 0) {
      const prev = lines[i - 1];
      if (looksLikeItemName(prev) && !PRICE_LINE.test(prev) && !PRICE_ONLY.test(prev)) {
        const price = parseInt(m2[1].replace(/,/g, ""), 10);
        if (price >= 100 && price <= 99999) found.push({ name: prev, price });
      }
    }
  }

  const seen = new Set<string>();
  return found.filter((c) => {
    const k = norm(c.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function importPdfs(menu: Menu, report: string[]): Promise<void> {
  report.push("## 📄 PDFs\n");
  if (!existsSync(INCOMING_PDF_DIR)) {
    report.push("_No pdfs folder._\n");
    return;
  }

  const allFiles = readdirSync(INCOMING_PDF_DIR).filter(
    (f) => !f.startsWith(".") && !/^readme\b/i.test(f) && !f.toLowerCase().endsWith(".md"),
  );
  const pdfFiles = allFiles.filter((f) => f.toLowerCase().endsWith(".pdf"));
  const nonPdf = allFiles.filter((f) => !f.toLowerCase().endsWith(".pdf"));

  if (nonPdf.length > 0) {
    report.push("⚠️ PDF以外のファイルが pdfs/ にあります（無視されました）:");
    for (const f of nonPdf) report.push(`- \`${f}\``);
    report.push("→ PDFに変換するか、画像なら `incoming/images/` に移してください。\n");
  }

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
        report.push("⚠️ テキスト抽出ができませんでした。スキャンPDFの可能性 → OCR推奨。\n");
        continue;
      }

      const items = detectItems(text);
      if (items.length === 0) {
        report.push("⚠️ 価格パターンを検出できませんでした。\n");
        continue;
      }

      const slug = basename(pdfFile, ".pdf").toLowerCase().replace(/[^\w\-]+/g, "-");
      const catId = `pdf-${slug}`;
      const catName = basename(pdfFile, ".pdf");
      const cat = ensureCategory(menu, catId, catName);

      let added = 0,
        skippedFuzzy = 0,
        skippedAsDescription = 0;
      for (const it of items) {
        // Use the same fuzzy matcher used for images — skip if any existing
        // item (in any category) matches manually-transcribed entries.
        const match = findMatch(menu, it.name);
        if (match) {
          skippedFuzzy++;
          continue;
        }
        // If this candidate "name" appears in any existing item's description,
        // it's actually a description fragment from the PDF, not a menu name.
        const target = norm(it.name);
        const looksLikeDescription = menu.categories.some((c) =>
          c.items.some((x) => x.description && norm(x.description).includes(target)),
        );
        if (looksLikeDescription) {
          skippedAsDescription++;
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
        `- 検出 **${items.length}** 件 / 追加 **${added}** 件 / 既存メニューと一致 **${skippedFuzzy}** 件 / 説明文と判定して除外 **${skippedAsDescription}** 件`,
      );
      if (added > 0) report.push(`- カテゴリ \`${catId}\` (\`hidden:true\` で追加)\n`);
      else report.push(`- 全てが既存メニューに一致したため、新規カテゴリは作成しません\n`);

      // If no items were added, remove the (empty) category we created.
      if (added === 0) {
        const idx = menu.categories.findIndex((c) => c.id === catId);
        if (idx >= 0 && menu.categories[idx].items.length === 0) {
          menu.categories.splice(idx, 1);
        }
      }
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
  console.log(`  Report: incoming/IMPORT_REPORT.md`);
  console.log(`  Diff:   git diff data/menus.json`);
}

main().catch((e) => {
  console.error("✗ Import failed:", e);
  process.exit(1);
});
