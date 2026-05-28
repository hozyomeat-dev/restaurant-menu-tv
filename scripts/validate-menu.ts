/**
 * Validates data/menus.json against the expected schema.
 * Run: npm run validate
 * Exits non-zero on any error (for CI).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const errors: string[] = [];

function err(path: string, msg: string) {
  errors.push(`  ✗ ${path}: ${msg}`);
}

function isStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function isOptStr(v: unknown): v is string | undefined {
  return v === undefined || typeof v === "string";
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}
function isBool(v: unknown): v is boolean {
  return typeof v === "boolean";
}

const filePath = resolve(process.cwd(), "data/menus.json");
let raw: string;
try {
  raw = readFileSync(filePath, "utf8");
} catch (e) {
  console.error(`Could not read ${filePath}:`, e);
  process.exit(2);
}

let data: any;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("✗ JSON parse error:", (e as Error).message);
  process.exit(2);
}

// restaurant
if (!data.restaurant) err("restaurant", "missing");
else {
  if (!isStr(data.restaurant.name)) err("restaurant.name", "must be non-empty string");
  if (!isStr(data.restaurant.currency)) err("restaurant.currency", "must be non-empty string");
  if (!isOptStr(data.restaurant.tagline)) err("restaurant.tagline", "must be string if present");
}

// display
if (!data.display) err("display", "missing");
else {
  if (!isNum(data.display.slideDurationMs) || data.display.slideDurationMs < 1000)
    err("display.slideDurationMs", "must be a number >= 1000");
  if (!isBool(data.display.showCategoryIntro))
    err("display.showCategoryIntro", "must be boolean");
  if (!isNum(data.display.categoryIntroDurationMs) || data.display.categoryIntroDurationMs < 500)
    err("display.categoryIntroDurationMs", "must be a number >= 500");
}

// categories
if (!Array.isArray(data.categories) || data.categories.length === 0) {
  err("categories", "must be a non-empty array");
} else {
  const catIds = new Set<string>();
  const allItemIds = new Set<string>();

  data.categories.forEach((cat: any, ci: number) => {
    const path = `categories[${ci}]`;
    if (!isStr(cat.id)) err(`${path}.id`, "must be non-empty string");
    else if (catIds.has(cat.id)) err(`${path}.id`, `duplicate id "${cat.id}"`);
    else catIds.add(cat.id);

    if (!isStr(cat.name)) err(`${path}.name`, "must be non-empty string");
    if (!isOptStr(cat.nameEn)) err(`${path}.nameEn`, "must be string if present");
    if (cat.accent !== undefined && !/^#[0-9a-fA-F]{3,8}$/.test(cat.accent))
      err(`${path}.accent`, "must be a hex color like #e8b14a");

    if (!Array.isArray(cat.items) || cat.items.length === 0) {
      err(`${path}.items`, "must be a non-empty array");
      return;
    }
    cat.items.forEach((item: any, ii: number) => {
      const ip = `${path}.items[${ii}]`;
      if (!isStr(item.id)) err(`${ip}.id`, "must be non-empty string");
      else if (allItemIds.has(item.id)) err(`${ip}.id`, `duplicate id "${item.id}"`);
      else allItemIds.add(item.id);

      if (!isStr(item.name)) err(`${ip}.name`, "must be non-empty string");
      if (!isOptStr(item.nameEn)) err(`${ip}.nameEn`, "must be string if present");
      if (!isOptStr(item.description)) err(`${ip}.description`, "must be string if present");
      if (!isNum(item.price)) err(`${ip}.price`, "must be a non-negative number");
      if (item.image !== undefined && !isStr(item.image))
        err(`${ip}.image`, "must be a string URL or path");
      if (item.badges !== undefined) {
        if (!Array.isArray(item.badges)) err(`${ip}.badges`, "must be an array");
        else item.badges.forEach((b: any, bi: number) => {
          if (!isStr(b)) err(`${ip}.badges[${bi}]`, "must be non-empty string");
        });
      }
      if (item.hidden !== undefined && !isBool(item.hidden))
        err(`${ip}.hidden`, "must be boolean if present");
    });
  });

  // Stats for friendly output
  if (errors.length === 0) {
    const totalItems = data.categories.reduce(
      (n: number, c: any) => n + c.items.filter((i: any) => !i.hidden).length,
      0,
    );
    const hidden = data.categories.reduce(
      (n: number, c: any) => n + c.items.filter((i: any) => i.hidden).length,
      0,
    );
    console.log(`✓ menus.json is valid`);
    console.log(`  ${data.categories.length} categories, ${totalItems} visible items (${hidden} hidden)`);
    process.exit(0);
  }
}

console.error("✗ menus.json failed validation:");
errors.forEach((e) => console.error(e));
process.exit(1);
