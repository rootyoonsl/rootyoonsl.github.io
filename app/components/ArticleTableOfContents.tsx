"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { MarkdownHeading } from "@/app/markdown-headings";

const COMPACT_TOC_QUERY = "(max-width: 999px)";

function subscribeToCompactLayout(onChange: () => void) {
  const mediaQuery = window.matchMedia(COMPACT_TOC_QUERY);
  mediaQuery.addEventListener("change", onChange);

  return () => mediaQuery.removeEventListener("change", onChange);
}

function getCompactLayoutSnapshot() {
  return window.matchMedia(COMPACT_TOC_QUERY).matches;
}

function getServerCompactLayoutSnapshot() {
  return false;
}

export function ArticleTableOfContents({
  headings,
}: {
  headings: readonly MarkdownHeading[];
}) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");
  const isCompactLayout = useSyncExternalStore(
    subscribeToCompactLayout,
    getCompactLayoutSnapshot,
    getServerCompactLayoutSnapshot,
  );

  useEffect(() => {
    if (isCompactLayout || headings.length === 0) return;

    const targetIds = headings.map((heading) => heading.id);
    let animationFrame = 0;

    const updateActiveHeading = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        let nextActiveId = targetIds[0] ?? "";

        for (const id of targetIds) {
          const target = document.getElementById(id);
          if (!target) continue;
          if (target.getBoundingClientRect().top <= 96) {
            nextActiveId = id;
          } else {
            break;
          }
        }

        setActiveId((currentId) =>
          currentId === nextActiveId ? currentId : nextActiveId,
        );
      });
    };

    updateActiveHeading();
    window.addEventListener("scroll", updateActiveHeading, { passive: true });
    window.addEventListener("resize", updateActiveHeading);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updateActiveHeading);
      window.removeEventListener("resize", updateActiveHeading);
    };
  }, [headings, isCompactLayout]);

  if (headings.length === 0 || isCompactLayout) return null;

  const navigateToHeading = (headingId: string) => {
    const target = document.getElementById(headingId);
    if (!target) return;

    const nextHash = `#${headingId}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(window.history.state, "", nextHash);
    }

    setActiveId(headingId);
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  return (
    <nav className="article-toc" aria-label="게시글 목차">
      <ol className="article-toc-list">
        {headings.map((heading) => (
          <li
            className="article-toc-item"
            data-level={heading.level}
            key={heading.id}
          >
            <a
              href={`#${heading.id}`}
              aria-current={activeId === heading.id ? "location" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigateToHeading(heading.id);
              }}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
