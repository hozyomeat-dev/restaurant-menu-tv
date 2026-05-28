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
      className="relative grid h-full w-full animate-fadeIn grid-cols-12 gap-[3vw]"
    >
      {/* Left: text */}
      <div className="col-span-7 flex flex-col justify-between py-[2vh]">
        <div>
          <div className="mb-[2.5vh] flex items-center gap-[1.5vw]">
            <span
              className="font-display text-[1.4vw] uppercase tracking-[0.4em]"
              style={{ color: accent }}
            >
              Story
            </span>
            <span
              className="h-[2px] flex-1 max-w-[6vw]"
              style={{ background: accent, opacity: 0.6 }}
            />
            {story.badge && (
              <span
                className="rounded-full border px-[1.2vw] py-[0.4vh] text-[1vw] font-medium"
                style={{ borderColor: accent, color: accent }}
              >
                {story.badge}
              </span>
            )}
          </div>

          <h2
            className="font-display text-[7vw] font-bold leading-[1.0]"
            style={{ color: accent }}
          >
            {story.title}
          </h2>
          {story.subtitle && (
            <p className="mt-[1.2vh] font-display text-[1.5vw] tracking-wider text-muted">
              {story.subtitle}
            </p>
          )}

          {story.lead && (
            <p
              className="mt-[3vh] font-display text-[2.4vw] font-medium leading-[1.4] text-ink"
              style={{ textShadow: `0 0 30px ${accent}33` }}
            >
              {story.lead}
            </p>
          )}

          {story.body && (
            <div className="mt-[3vh] max-w-[42vw] space-y-[1.2vh]">
              {story.body.split(/\n\n+/).map((p, i) => (
                <p
                  key={i}
                  className="text-[1.5vw] leading-[1.7] text-ink/85"
                >
                  {p}
                </p>
              ))}
            </div>
          )}
        </div>

        <p className="text-[1vw] uppercase tracking-[0.3em] text-muted">— 産地から、テーブルまで —</p>
      </div>

      {/* Right: decorative panel / optional image */}
      <div className="relative col-span-5 overflow-hidden rounded-[1.5vw]">
        {hasImage ? (
          <div className="relative h-full w-full animate-kenBurns">
            <Image
              src={story.image!}
              alt={story.title}
              fill
              priority
              sizes="50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-bg/70 via-transparent to-transparent" />
          </div>
        ) : (
          <div
            className="relative flex h-full w-full items-center justify-center"
            style={{
              background: `radial-gradient(ellipse at 30% 30%, ${accent}40, transparent 70%), radial-gradient(ellipse at 70% 70%, ${accent}20, transparent 70%), #110f0c`,
            }}
          >
            <div
              className="absolute inset-[8%] rounded-[1vw] border opacity-30"
              style={{ borderColor: accent }}
            />
            <div className="text-center">
              <p
                className="font-display text-[10vw] font-bold leading-none opacity-15"
                style={{ color: accent }}
              >
                {story.title.slice(0, 1)}
              </p>
              <p
                className="mt-[2vh] text-[1vw] uppercase tracking-[0.5em]"
                style={{ color: accent, opacity: 0.7 }}
              >
                {story.badge ?? "Producer Story"}
              </p>
            </div>
          </div>
        )}
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
