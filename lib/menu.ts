import menuData from "@/data/menus.json";

export type MenuItem = {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  price: number;
  image?: string;
  badges?: string[];
  hidden?: boolean;
};

export type MenuCategory = {
  id: string;
  name: string;
  nameEn?: string;
  accent?: string;
  items: MenuItem[];
};

export type Story = {
  id: string;
  title: string;
  subtitle?: string;
  lead?: string;
  body: string;
  accent?: string;
  badge?: string;
  image?: string;
};

export type MenuData = {
  restaurant: {
    name: string;
    tagline?: string;
    currency: string;
  };
  display: {
    slideDurationMs: number;
    showCategoryIntro: boolean;
    categoryIntroDurationMs: number;
    storyDurationMs?: number;
    storyEveryNSlides?: number;
  };
  stories?: Story[];
  categories: MenuCategory[];
};

export function getMenu(): MenuData {
  return menuData as MenuData;
}

/** Flatten visible items into a slide sequence, optionally inserting category intros and stories. */
export type Slide =
  | { kind: "intro"; category: MenuCategory }
  | { kind: "item"; category: MenuCategory; item: MenuItem }
  | { kind: "story"; story: Story };

export function buildSlides(menu: MenuData): Slide[] {
  // Phase 1: build menu slides (intros + items)
  const base: Slide[] = [];
  for (const cat of menu.categories) {
    const visible = cat.items.filter((i) => !i.hidden);
    if (visible.length === 0) continue;
    if (menu.display.showCategoryIntro) {
      base.push({ kind: "intro", category: cat });
    }
    for (const item of visible) {
      base.push({ kind: "item", category: cat, item });
    }
  }

  // Phase 2: interleave stories every N menu slides (round-robin)
  const stories = menu.stories ?? [];
  const n = menu.display.storyEveryNSlides ?? 0;
  if (stories.length === 0 || n <= 0) return base;

  const result: Slide[] = [];
  let storyIdx = 0;
  for (let i = 0; i < base.length; i++) {
    result.push(base[i]);
    if ((i + 1) % n === 0) {
      result.push({ kind: "story", story: stories[storyIdx % stories.length] });
      storyIdx++;
    }
  }
  return result;
}
