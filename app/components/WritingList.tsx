"use client";

import Link from "next/link";
import { useState } from "react";

const pageSizes = [5, 10, 20] as const;
const PAGE_GROUP_SIZE = 5;

type PageSize = (typeof pageSizes)[number];

type WritingListPost = {
  slug: string;
  title: string;
  date: string;
  displayDate: string;
  summary: string;
  thumbnail: string | null;
};

type WritingListProps = {
  posts: WritingListPost[];
};

function getPageItems(currentPage: number, totalPages: number) {
  const groupStart =
    Math.floor((currentPage - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const groupEnd = Math.min(groupStart + PAGE_GROUP_SIZE - 1, totalPages);

  return Array.from(
    { length: groupEnd - groupStart + 1 },
    (_, index) => groupStart + index,
  );
}

export function WritingList({ posts }: WritingListProps) {
  const [pageSize, setPageSize] = useState<PageSize>(5);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const visiblePosts = posts.slice(startIndex, startIndex + pageSize);
  const pageItems = getPageItems(currentPage, totalPages);
  const pageGroupStart =
    Math.floor((currentPage - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;

  function changePageSize(nextPageSize: PageSize) {
    setPageSize(nextPageSize);
    setPage(1);
  }

  return (
    <>
      <section className="compact-writing-list" aria-label="모든 글">
        {visiblePosts.map((post, index) => {
          const postNumber = posts.length - (startIndex + index);
          const postNumberLabel = String(postNumber).padStart(2, "0");

          return (
            <Link
              className="compact-writing-row"
              href={`/writing/${encodeURIComponent(post.slug)}`}
              key={post.slug}
            >
              <span className="compact-writing-number" aria-hidden="true">
                {postNumberLabel}
              </span>
              <span className="compact-writing-copy">
                <strong>{post.title}</strong>
                <time className="compact-writing-date" dateTime={post.date}>
                  {post.displayDate}
                </time>
                <small className="compact-writing-summary">{post.summary}</small>
              </span>
              <span
                className={`compact-writing-thumbnail${
                  post.thumbnail
                    ? ""
                    : " compact-writing-thumbnail-placeholder"
                }`}
                aria-hidden="true"
              >
                {post.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Thumbnails are generated local post assets.
                  <img
                    src={post.thumbnail}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </span>
            </Link>
          );
        })}
      </section>

      <footer className="writing-list-footer">
        <nav
          className="writing-pagination"
          aria-label="글 목록 페이지"
        >
          <button
            className="writing-page-button writing-page-arrow"
            type="button"
            aria-label="이전 5페이지"
            disabled={pageGroupStart === 1}
            onClick={() =>
              setPage(Math.max(1, pageGroupStart - PAGE_GROUP_SIZE))
            }
          >
            {"<"}
          </button>

          {pageItems.map((item) => (
            <button
              className="writing-page-button"
              type="button"
              aria-current={item === currentPage ? "page" : undefined}
              key={item}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}

          <button
            className="writing-page-button writing-page-arrow"
            type="button"
            aria-label="다음 5페이지"
            disabled={pageGroupStart + PAGE_GROUP_SIZE > totalPages}
            onClick={() =>
              setPage(
                Math.min(totalPages, pageGroupStart + PAGE_GROUP_SIZE),
              )
            }
          >
            {">"}
          </button>
        </nav>

        <div className="writing-page-size-control">
          <select
            className="writing-page-size-select"
            aria-label="한 페이지에 표시할 글 수"
            value={pageSize}
            onChange={(event) =>
              changePageSize(Number(event.target.value) as PageSize)
            }
          >
            {pageSizes.map((size) => (
              <option value={size} key={size}>
                {`${size}개씩 보기`}
              </option>
            ))}
          </select>
        </div>
      </footer>
    </>
  );
}
