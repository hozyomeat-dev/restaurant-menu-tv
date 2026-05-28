import menuData from "@/data/menus.json";

export type MenuItem = {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  /** Extended product notes (e.g., for bottle wines: producer, region, taste). */
  notes?: string;
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
  /** Insert this story right before the slide with this category id or item id.
   *  If unset, falls back to display.storyEveryNSlides round-robin. */
  insertBefore?: string;
  /** Always prepend this story at the very start of the slideshow. Stories
   *  with showAtStart appear in `stories` array order before any menu slides. */
  showAtStart?: boolean;
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
  // - When showCategoryIntro is false, interleave items round-robin across
  //   categories (one from each cat per round) so the slideshow mixes dish
  //   types rather than walking through each category in a block.
  const groups = menu.categories
    .map((cat) => ({ cat, items: cat.items.filter((i) => !i.hidden) }))
    .filter((g) => g.items.length > 0);

  const base: Slide[] = [];

  if (menu.display.showCategoryIntro) {
    // Grouped layout: intro + items per category, in order.
    for (const { cat, items } of groups) {
      base.push({ kind: "intro", category: cat });
      for (const item of items) base.push({ kind: "item", category: cat, item });
    }
  } else {
    // Round-robin: take one item from each non-empty category per round.
    const queues = groups.map((g) => ({ cat: g.cat, items: [...g.items] }));
    while (queues.some((q) => q.items.length > 0)) {
      for (const q of queues) {
        const item = q.items.shift();
        if (item) base.push({ kind: "item", category: q.cat, item });
      }
    }
  }

  const stories = menu.stories ?? [];
  if (stories.length === 0) return base;

  // Phase 2a: prepend stories flagged showAtStart, in stories[] order.
  const startStories = stories.filter((s) => s.showAtStart);
  const startSlides: Slide[] = startStories.map((story) => ({ kind: "story", story }));
  const result: Slide[] = [...startSlides, ...base];

  // Phase 2b: place stories with `insertBefore` at the matching slide.
  // Walk back-to-front so earlier insertions don't shift later target indices.
  const anchored = stories.filter((s) => s.insertBefore);
  const free = stories.filter((s) => !s.insertBefore && !s.showAtStart);

  // Skip the prepended startSlides region when searching for anchor targets.
  const searchStart = startSlides.length;
  const anchorPositions = anchored
    .map((story) => {
      const target = story.insertBefore!;
      let idx = -1;
      for (let i = searchStart; i < result.length; i++) {
        const s = result[i];
        if (s.kind === "intro" && s.category.id === target) {
          idx = i;
          break;
        }
        if (s.kind === "item" && (s.item.id === target || s.category.id === target)) {
          idx = i;
          break;
        }
      }
      return { story, idx };
    })
    .filter((x) => x.idx >= 0)
    .sort((a, b) => b.idx - a.idx);

  for (const { story, idx } of anchorPositions) {
    result.splice(idx, 0, { kind: "story", story });
  }

  // Phase 2b: interleave any remaining (un-anchored) stories every N menu slides.
  const n = menu.display.storyEveryNSlides ?? 0;
  if (free.length === 0 || n <= 0) return result;

  const interleaved: Slide[] = [];
  let storyIdx = 0;
  for (let i = 0; i < result.length; i++) {
    interleaved.push(result[i]);
    if ((i + 1) % n === 0) {
      interleaved.push({ kind: "story", story: free[storyIdx % free.length] });
      storyIdx++;
    }
  }
  return interleaved;
}
