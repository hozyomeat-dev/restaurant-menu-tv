"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { MenuData, Slide } from "@/lib/menu";
import { buildSlides } from "@/lib/menu";

type Props = { menu: MenuData };

export default function MenuSlideshow({ menu }: Props) {
  const slides = useMemo(() => buildSlides(menu), [menu]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = slides[index];
  const duration =
    current?.kind === "intro"
      ? menu.display.categoryIntroDurationMs
      : current?.kind === "story"
        ? menu.display.storyDurationMs ?? 10000
        : menu.display.slideDurationMs;

  useEffect(() => {
    if (slides.length === 0) return;
    timerRef.current = setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, duration, slides.length]);

  if (slides.length === 0) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p className="text-3xl text-muted">メニューが登録されていません</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg">
      <BurnGuardFrame>
        <Header restaurant={menu.restaurant} />

        <main className="flex-1 overflow-hidden">
          <SlideView key={index} slide={current} currency={menu.restaurant.currency} />
        </main>

        <Footer
          slides={slides}
          index={index}
          durationMs={duration}
          restaurant={menu.restaurant}
        />
      </BurnGuardFrame>
    </div>
  );
}

function BurnGuardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="burn-guard tv-safe flex h-full w-full flex-col">{children}</div>
  );
}

function Header({ restaurant }: { restaurant: MenuData["restaurant"] }) {
  return (
    <header className="flex items-baseline justify-between pb-[2.5vh]">
      <h1 className="font-display text-[3.2vw] font-bold tracking-wide text-ink">
        {restaurant.name}
      </h1>
      {restaurant.tagline && (
        <p className="text-[1.4vw] text-muted">{restaurant.tagline}</p>
      )}
    </header>
  );
}

function SlideView({ slide, currency }: { slide: Slide; currency: string }) {
  if (slide.kind === "intro") {
    return <CategoryIntro slide={slide} />;
  }
  if (slide.kind === "story") {
    return <StorySlide slide={slide} />;
  }
  return <ItemSlide slide={slide} currency={currency} />;
}

function StorySlide({ slide: { story } }: { slide: Extract<Slide, { kind: "story" }> }) {
  const accent = story.accent ?? "#e8b14a";
  const hasImage = Boolean(story.image);

  return (
    <div
      key={story.id}
      className="relative h-full w-full animate-fadeIn overflow-hidden rounded-[1vw]"
    >
      {/* Full-bleed background */}
      {hasImage ? (
        <div className="absolute inset-0 animate-kenBurns">
          <Image
            src={story.image!}
            alt={story.title}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 30% 20%, ${accent}50, transparent 60%), radial-gradient(ellipse at 80% 80%, ${accent}25, transparent 65%), #0b0a08`,
          }}
        />
      )}

      {/* Readability gradient: strong dark at left/bottom, fade to right/top */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.72) 38%, rgba(0,0,0,0.42) 65%, rgba(0,0,0,0.25) 100%)",
        }}
      />
      {/* Accent tint at bottom */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, ${accent}33 0%, transparent 40%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full w-full flex-col p-[4vw]">
        {/* Top bar */}
        <div className="flex items-center gap-[1.5vw]">
          {story.subtitle && (
            <span
              className="font-display text-[1.7vw] font-bold uppercase tracking-[0.45em]"
              style={{ color: accent }}
            >
              {story.subtitle}
            </span>
          )}
          <span
            className="h-[3px] flex-1 max-w-[14vw]"
            style={{ background: accent, opacity: 0.6 }}
          />
          {story.badge && (
            <span
              className="rounded-full px-[1.6vw] py-[0.8vh] text-[1.3vw] font-bold"
              style={{
                background: accent,
                color: "#0b0a08",
                boxShadow: `0 0 30px ${accent}66`,
              }}
            >
              {story.badge}
            </span>
          )}
        </div>

        {/* Vertical spacer to push title down from top bar */}
        <div className="h-[6vh]" />

        {/* Middle: Title + Lead */}
        <div className="flex-1">
          <h2
            className="font-display text-[14vw] font-black leading-[0.9] text-ink"
            style={{
              textShadow: `0 6px 40px rgba(0,0,0,0.9), 0 0 80px ${accent}55`,
              letterSpacing: "-0.02em",
            }}
          >
            {story.title}
          </h2>

          {story.lead && (
            <p
              className="mt-[3.5vh] max-w-[68vw] whitespace-pre-line font-display text-[4.2vw] font-bold leading-[1.25] text-ink"
              style={{
                textShadow: "0 4px 24px rgba(0,0,0,0.95)",
              }}
            >
              {story.lead}
            </p>
          )}
        </div>

        {/* Bottom: Body */}
        <div>
          {story.body && (
            <p
              className="max-w-[80vw] whitespace-pre-line text-[2.4vw] font-medium leading-[1.55] text-ink/95"
              style={{
                textShadow: "0 3px 18px rgba(0,0,0,0.95)",
              }}
            >
              {story.body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryIntro({ slide: { category } }: { slide: Extract<Slide, { kind: "intro" }> }) {
  return (
    <div
      key={category.id}
      className="flex h-full w-full animate-fadeIn flex-col items-center justify-center text-center"
    >
      <div
        className="mb-[2vh] h-[4px] w-[12vw] rounded-full"
        style={{ background: category.accent ?? "#e8b14a" }}
      />
      <p className="font-display text-[2vw] uppercase tracking-[0.4em] text-muted">
        {category.nameEn ?? ""}
      </p>
      <h2
        className="font-display text-[9vw] font-bold leading-none"
        style={{ color: category.accent ?? "#e8b14a" }}
      >
        {category.name}
      </h2>
      <p className="mt-[2.5vh] text-[1.4vw] text-muted">
        {category.items.filter((i) => !i.hidden).length} 品
      </p>
    </div>
  );
}

function ItemSlide({
  slide: { category, item },
  currency,
}: {
  slide: Extract<Slide, { kind: "item" }>;
  currency: string;
}) {
  // Bottle wine items get a dedicated layout featuring pairing chips.
  if (category.id === "drink-bottle") {
    return <WineSlide category={category} item={item} currency={currency} />;
  }
  const hasImage = Boolean(item.image);

  return (
    <div className="grid h-full w-full animate-fadeIn grid-cols-12 gap-[3vw]">
      <div
        className={`relative ${hasImage ? "col-span-7" : "col-span-12"} flex flex-col justify-between py-[2vh]`}
      >
        <div>
          <div className="mb-[2.5vh] flex items-center gap-[1.5vw]">
            <span
              className="h-[2px] w-[3vw]"
              style={{ background: category.accent ?? "#e8b14a" }}
            />
            <span
              className="font-display text-[1.4vw] uppercase tracking-[0.3em]"
              style={{ color: category.accent ?? "#e8b14a" }}
            >
              {category.name}
            </span>
          </div>

          <h2 className="font-display text-[5.6vw] font-bold leading-[1.05] text-ink">
            {item.name}
          </h2>
          {item.nameEn && (
            <p className="mt-[1vh] text-[1.6vw] text-muted">{item.nameEn}</p>
          )}

          {item.description && (
            <p className="mt-[3.5vh] max-w-[40vw] text-[1.8vw] leading-relaxed text-ink/90">
              {item.description}
            </p>
          )}

          {item.badges && item.badges.length > 0 && (
            <div className="mt-[3vh] flex flex-wrap gap-[0.8vw]">
              {item.badges.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-accent/60 px-[1.4vw] py-[0.5vh] text-[1.1vw] font-medium text-accent"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-[1vw]">
          <span className="font-display text-[2vw] text-muted">{currency}</span>
          <span className="font-display text-[5.5vw] font-bold leading-none text-accent">
            {item.price.toLocaleString("ja-JP")}
          </span>
          <span className="text-[1.2vw] text-muted">税込</span>
        </div>
      </div>

      {hasImage && (
        <div className="relative col-span-5 overflow-hidden rounded-[1.5vw]">
          <div className="relative h-full w-full animate-kenBurns">
            <Image
              src={item.image!}
              alt={item.name}
              fill
              priority
              sizes="50vw"
              className="object-cover"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-bg/60 via-transparent to-transparent" />
        </div>
      )}
    </div>
  );
}

/** Parse "赤｜相性○：A／B／C" or "白｜相性○：A／B" into structured pairing data. */
function parseWineDescription(desc: string | undefined): {
  color: "赤" | "白" | "ロゼ" | null;
  prelude: string;
  pairings: string[];
} {
  if (!desc) return { color: null, prelude: "", pairings: [] };
  const colorMatch = desc.match(/^(赤|白|ロゼ)/);
  const color = (colorMatch?.[1] as "赤" | "白" | "ロゼ") ?? null;
  const pairMatch = desc.match(/相性[○◯]?[：:](.+?)$/);
  if (!pairMatch) {
    return { color, prelude: desc.replace(/^(赤|白|ロゼ)[\s|｜]*/, ""), pairings: [] };
  }
  const pairings = pairMatch[1]
    .split(/[／/、,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { color, prelude: "", pairings };
}

function WineSlide({
  category,
  item,
  currency,
}: {
  category: Extract<Slide, { kind: "item" }>["category"];
  item: Extract<Slide, { kind: "item" }>["item"];
  currency: string;
}) {
  const { color, pairings } = parseWineDescription(item.description);
  const colorChip = color === "赤"
    ? { label: "赤 RED", bg: "#7a2d3a", text: "#ffe6dc" }
    : color === "白"
      ? { label: "白 WHITE", bg: "#d9c98c", text: "#3b2f1a" }
      : color === "ロゼ"
        ? { label: "ロゼ ROSÉ", bg: "#c98aa0", text: "#3b1f29" }
        : null;

  return (
    <div className="grid h-full w-full animate-fadeIn grid-cols-12 gap-[3vw]">
      {/* Left: wine identity + notes */}
      <div className="col-span-7 flex flex-col justify-between py-[2vh]">
        <div>
          <div className="mb-[2.5vh] flex items-center gap-[1.5vw]">
            <span
              className="h-[2px] w-[3vw]"
              style={{ background: category.accent ?? "#7a2d3a" }}
            />
            <span
              className="font-display text-[1.4vw] uppercase tracking-[0.3em]"
              style={{ color: category.accent ?? "#7a2d3a" }}
            >
              Bottle Wine
            </span>
            {colorChip && (
              <span
                className="rounded-full px-[1.4vw] py-[0.5vh] text-[1.2vw] font-bold tracking-widest"
                style={{ background: colorChip.bg, color: colorChip.text }}
              >
                {colorChip.label}
              </span>
            )}
          </div>

          <h2 className="font-display text-[4.4vw] font-bold leading-[1.1] text-ink">
            {item.name}
          </h2>

          {item.notes && (
            <p className="mt-[3vh] max-w-[44vw] text-[1.7vw] font-medium leading-[1.7] text-ink/90">
              {item.notes}
            </p>
          )}

          {item.badges && item.badges.length > 0 && (
            <div className="mt-[2vh] flex flex-wrap gap-[0.8vw]">
              {item.badges.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-accent/60 px-[1.4vw] py-[0.5vh] text-[1.1vw] font-medium text-accent"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-[1vw]">
          <span className="font-display text-[2vw] text-muted">{currency}</span>
          <span className="font-display text-[5.6vw] font-bold leading-none text-accent">
            {item.price.toLocaleString("ja-JP")}
          </span>
          <span className="text-[1.2vw] text-muted">税込 / ボトル</span>
        </div>
      </div>

      {/* Right: pairing showcase */}
      <div className="relative col-span-5 flex flex-col justify-center overflow-hidden rounded-[1.5vw] p-[2.5vw]"
        style={{
          background: `radial-gradient(ellipse at 20% 30%, ${(category.accent ?? "#7a2d3a")}55, transparent 65%), radial-gradient(ellipse at 80% 80%, ${(category.accent ?? "#7a2d3a")}30, transparent 65%), #110f0c`,
        }}
      >
        <div className="mb-[2.5vh] flex items-center gap-[1.2vw]">
          <span
            className="text-[2.4vw]"
            style={{ color: category.accent ?? "#e8b14a" }}
          >
            ♥
          </span>
          <span
            className="font-display text-[2.4vw] font-bold uppercase tracking-[0.3em]"
            style={{ color: category.accent ?? "#e8b14a" }}
          >
            Pairing
          </span>
        </div>
        <p className="mb-[2vh] font-display text-[1.6vw] font-medium text-ink/80">
          こちらと一緒に。
        </p>

        {pairings.length > 0 ? (
          <ul className="space-y-[1.4vh]">
            {pairings.map((p, i) => (
              <li
                key={i}
                className="flex items-baseline gap-[1.2vw]"
              >
                <span
                  className="font-display text-[1.6vw] font-bold leading-none"
                  style={{ color: category.accent ?? "#e8b14a" }}
                >
                  0{i + 1}
                </span>
                <span className="font-display text-[2.8vw] font-bold leading-[1.15] text-ink">
                  {p}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[1.6vw] text-ink/70">スタッフへお気軽にお声掛けください。</p>
        )}
      </div>
    </div>
  );
}

function Footer({
  slides,
  index,
  durationMs,
  restaurant,
}: {
  slides: Slide[];
  index: number;
  durationMs: number;
  restaurant: MenuData["restaurant"];
}) {
  const current = slides[index];
  const categoryId =
    current.kind === "story" ? "_story" : current.category.id;

  // Group slide indices by category for nav dots (stories appear as their own group)
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; accent?: string; count: number; firstIndex: number }>();
    slides.forEach((s, i) => {
      if (s.kind === "story") {
        const cur = map.get("_story");
        if (cur) cur.count += 1;
        else map.set("_story", { name: "ストーリー", accent: s.story.accent, count: 1, firstIndex: i });
      } else {
        const cat = s.category;
        const cur = map.get(cat.id);
        if (cur) cur.count += 1;
        else map.set(cat.id, { name: cat.name, accent: cat.accent, count: 1, firstIndex: i });
      }
    });
    return Array.from(map.entries());
  }, [slides]);

  return (
    <footer className="pt-[2.5vh]">
      <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-ink/10">
        <div
          key={index}
          className="h-full origin-left animate-progress bg-accent"
          style={{ animationDuration: `${durationMs}ms` }}
        />
      </div>

      <div className="mt-[2vh] flex items-center justify-between text-[1vw] text-muted">
        <div className="flex items-center gap-[1.5vw]">
          {groups.map(([id, g]) => (
            <div key={id} className="flex items-center gap-[0.6vw]">
              <span
                className="block h-[8px] w-[8px] rounded-full transition-opacity"
                style={{
                  background: g.accent ?? "#a59682",
                  opacity: id === categoryId ? 1 : 0.25,
                }}
              />
              <span style={{ opacity: id === categoryId ? 1 : 0.5 }}>{g.name}</span>
            </div>
          ))}
        </div>
        <div className="tabular-nums">
          {index + 1} / {slides.length}
        </div>
      </div>
    </footer>
  );
}
