/* eslint-disable @next/next/no-img-element -- Covers are verified remote shop images rendered without Next image proxying. */
"use client";

import { useMemo, useState } from "react";
import { FilterMenu } from "@/app/components/FilterMenu";
import { CURATED_BOOKS } from "@/app/library";
import { SpaceHeader } from "@/app/components/SpaceHeader";

const ALL_AUTHORS = "전체";

export function BookShelf() {
  const [activeAuthor, setActiveAuthor] = useState(ALL_AUTHORS);

  const authors = useMemo(() => {
    const counts = new Map<string, number>();

    CURATED_BOOKS.forEach((book) => {
      counts.set(book.author, (counts.get(book.author) ?? 0) + 1);
    });

    return [
      { value: ALL_AUTHORS, count: CURATED_BOOKS.length },
      ...Array.from(counts, ([value, count]) => ({ value, count })).sort(
        (left, right) => left.value.localeCompare(right.value, "ko"),
      ),
    ];
  }, []);

  const filteredBooks = useMemo(
    () =>
      activeAuthor === ALL_AUTHORS
        ? CURATED_BOOKS
        : CURATED_BOOKS.filter((book) => book.author === activeAuthor),
    [activeAuthor],
  );

  return (
    <section
      className="book-library-root space-page"
      aria-labelledby="book-library-title"
    >
      <SpaceHeader
        title="책 공간"
        titleId="book-library-title"
        count={CURATED_BOOKS.length}
        countLabel={`전체 책 ${CURATED_BOOKS.length}권`}
        controls={
          <FilterMenu
            label="저자"
            value={activeAuthor}
            options={authors}
            onChange={setActiveAuthor}
          />
        }
      />

      <ul
        className="book-library-grid book-library-grid-four"
        data-columns="4"
      >
        {filteredBooks.map((book) => (
          <li className="book-library-grid-item" key={book.href}>
            <a
              className="book-library-card"
              href={book.href}
              target="_blank"
              rel="noopener noreferrer"
              title={book.title}
              aria-label={`${book.title}, ${book.author}. 교보문고에서 새 창으로 보기`}
            >
              <span className="book-library-cover-wrap">
                <img
                  className="book-library-cover"
                  src={book.cover}
                  alt={`${book.title} 표지`}
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span className="book-library-card-copy">
                <strong className="book-library-card-title">
                  {book.title}
                </strong>
                <span className="book-library-card-author">{book.author}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      {filteredBooks.length === 0 ? (
        <p className="book-library-empty" role="status">
          이 저자의 책은 아직 없습니다.
        </p>
      ) : null}
    </section>
  );
}
