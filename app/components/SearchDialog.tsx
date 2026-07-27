"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  books,
  musics,
  photos,
  posts,
} from "@/app/content.generated";
import { BOOKS } from "@/app/library-meta";

type SearchItem = {
  category: "글" | "책" | "음악" | "사진";
  title: string;
  detail: string;
  href: string;
  keywords: string;
};

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

export default function SearchDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<SearchItem[]>(
    () => [
      ...posts.map((post) => ({
        category: "글" as const,
        title: post.title,
        detail: post.displayDate,
        href: `/writing/${encodeURIComponent(post.slug)}`,
        keywords: `${post.title} ${post.plainText}`,
      })),
      ...books.map((book) => {
        const author =
          BOOKS.find((item) => item.href === book.url)?.author ?? "기록 중";

        return {
          category: "책" as const,
          title: book.title,
          detail: author,
          href: book.url,
          keywords: `${book.title} ${author}`,
        };
      }),
      ...musics.map((track) => ({
        category: "음악" as const,
        title: track.title,
        detail: track.artist ?? "기록 중",
        href: track.url,
        keywords: `${track.title} ${track.artist ?? ""}`,
      })),
      ...photos.map((photo) => ({
        category: "사진" as const,
        title: `${photo.displayDate} 사진`,
        detail: photo.displayDate,
        href: `/photos?photo=${encodeURIComponent(photo.id)}`,
        keywords: `${photo.filename} ${photo.takenAt}`,
      })),
    ],
    [],
  );

  const results = useMemo(() => {
    const needle = normalizeSearch(query);
    return (needle
      ? items.filter((item) => normalizeSearch(item.keywords).includes(needle))
      : items
    ).slice(0, 9);
  }, [items, query]);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (!focusableElements?.length) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div
      className="search-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="사이트 검색"
        onKeyDown={trapFocus}
      >
        <div className="search-input-row">
          <Search size={17} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
            }}
            placeholder="검색"
            aria-label="검색어"
          />
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="검색 닫기"
          >
            <X size={17} />
          </button>
        </div>

        <div className="search-results" aria-live="polite">
          {results.length ? (
            results.map((item) => {
              const external = item.href.startsWith("http");
              const content = (
                <>
                  <span className="search-category">{item.category}</span>
                  <span className="search-result-copy">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </>
              );

              return external ? (
                <a
                  className="search-result"
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  key={`${item.category}-${item.href}-${item.title}`}
                  onClick={onClose}
                >
                  {content}
                </a>
              ) : (
                <Link
                  className="search-result"
                  href={item.href}
                  key={`${item.category}-${item.href}-${item.title}`}
                  onClick={onClose}
                >
                  {content}
                </Link>
              );
            })
          ) : (
            <p className="search-empty">검색 결과가 없습니다.</p>
          )}
        </div>
        <div className="search-hint">
          <span>제목과 본문을 검색합니다.</span>
          <kbd>ESC</kbd>
        </div>
      </section>
    </div>
  );
}
