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
  };
  categories: MenuCategory[];
};

export function getMenu(): MenuData {
  return menuData as MenuData;
}

/** Flatten visible items into a slide sequence, optionally inserting category intros. */
export type Slide =
  | { kind: "intro"; category: MenuCategory }
  | { kind: "item"; category: MenuCategory; item: MenuItem };

export function buildSlides(menu: MenuData): Slide[] {
  const slides: Slide[] = [];
  for (const cat of menu.categories) {
    const visible = cat.items.filter((i) => !i.hidden);
    if (visible.length === 0) continue;
    if (menu.display.showCategoryIntro) {
      slides.push({ kind: "intro", category: cat });
    }
    for (const item of visible) {
      slides.push({ kind: "item", category: cat, item });
    }
  }
  return slides;
}
