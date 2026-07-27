"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FilterMenu } from "@/app/components/FilterMenu";
import { CURATED_TRACKS } from "@/app/library";
import { SpaceHeader } from "@/app/components/SpaceHeader";

const ALL_ARTISTS = "전체";
const TRACKS_PER_PAGE = 10;
const PAGE_GROUP_SIZE = 5;

function getPageItems(currentPage: number, totalPages: number) {
  const groupStart =
    Math.floor((currentPage - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const groupEnd = Math.min(groupStart + PAGE_GROUP_SIZE - 1, totalPages);

  return Array.from(
    { length: groupEnd - groupStart + 1 },
    (_, index) => groupStart + index,
  );
}

function currentRotation(element: HTMLElement) {
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === "none") return 0;

  try {
    const matrix = new DOMMatrixReadOnly(transform);
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  } catch {
    return 0;
  }
}

export function Playlist() {
  const [activeArtist, setActiveArtist] = useState(ALL_ARTISTS);
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState(1);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const lyricsDragRef = useRef({
    pointerId: -1,
    startY: 0,
    startScrollTop: 0,
  });
  const spinAnimationRef = useRef<Animation | null>(null);
  const returnAnimationRef = useRef<Animation | null>(null);
  const trackButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingTrackFocusRef = useRef(false);
  const prefetchedThumbnailRefs = useRef(new Set<string>());

  const artists = useMemo(() => {
    const counts = new Map<string, number>();

    CURATED_TRACKS.forEach((track) => {
      counts.set(track.artist, (counts.get(track.artist) ?? 0) + 1);
    });

    return [
      { value: ALL_ARTISTS, count: CURATED_TRACKS.length },
      ...Array.from(counts, ([value, count]) => ({ value, count })).sort(
        (left, right) => left.value.localeCompare(right.value, "ko"),
      ),
    ];
  }, []);

  const visibleTracks = useMemo(
    () =>
      activeArtist === ALL_ARTISTS
        ? CURATED_TRACKS
        : CURATED_TRACKS.filter((track) => track.artist === activeArtist),
    [activeArtist],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(visibleTracks.length / TRACKS_PER_PAGE),
  );
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * TRACKS_PER_PAGE;
  const pageTracks = useMemo(
    () => visibleTracks.slice(pageStart, pageStart + TRACKS_PER_PAGE),
    [pageStart, visibleTracks],
  );
  const pageItems = getPageItems(currentPage, totalPages);
  const pageGroupStart =
    Math.floor((currentPage - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;

  const selectedIndex = visibleTracks.findIndex(
    (track) => track.youtubeId === selectedId,
  );
  const selectedTrack =
    selectedId && selectedIndex >= 0 ? visibleTracks[selectedIndex] : null;
  const selectedTrackId = selectedTrack?.youtubeId ?? "";
  const pageHasSelectedTrack = pageTracks.some(
    (track) => track.youtubeId === selectedTrackId,
  );

  const selectTrackAtIndex = useCallback(
    (index: number, shouldFocus = false) => {
      const nextTrack = visibleTracks[index];
      if (!nextTrack) return;

      pendingTrackFocusRef.current = shouldFocus;
      setPage(Math.floor(index / TRACKS_PER_PAGE) + 1);
      setSelectedId(nextTrack.youtubeId);
    },
    [visibleTracks],
  );

  const selectTrackFromRow = useCallback(
    (event: ReactMouseEvent<HTMLTableRowElement>, index: number) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".playlist-browser-thumbnail-link")
      ) {
        return;
      }

      selectTrackAtIndex(index);
    },
    [selectTrackAtIndex],
  );

  const prepareTrackTitlePan = useCallback((button: HTMLButtonElement) => {
    const title = button.querySelector<HTMLElement>(
      ".playlist-browser-track-title-text",
    );
    if (!title) return;

    const overflow = Math.ceil(title.scrollWidth - button.clientWidth);
    if (overflow <= 1) {
      delete button.dataset.overflowing;
      button.style.removeProperty("--track-title-shift");
      button.style.removeProperty("--track-title-duration");
      return;
    }

    const duration = Math.min(12, Math.max(5.5, 4 + overflow / 14));
    button.dataset.overflowing = "true";
    button.style.setProperty("--track-title-shift", `${-(overflow + 3)}px`);
    button.style.setProperty("--track-title-duration", `${duration.toFixed(2)}s`);
  }, []);

  const startDiscRotation = useCallback(() => {
    const disc = discRef.current;
    if (
      !disc ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const rotation = currentRotation(disc);
    spinAnimationRef.current?.cancel();
    returnAnimationRef.current?.cancel();
    disc.style.transform = `rotate(${rotation}deg)`;
    spinAnimationRef.current = disc.animate(
      [
        { transform: `rotate(${rotation}deg)` },
        { transform: `rotate(${rotation + 360}deg)` },
      ],
      {
        duration: 12000,
        easing: "linear",
        iterations: Infinity,
      },
    );
  }, []);

  const stopDiscRotation = useCallback(() => {
    const disc = discRef.current;
    if (!disc) return;

    const rotation = currentRotation(disc);
    spinAnimationRef.current?.cancel();
    spinAnimationRef.current = null;
    returnAnimationRef.current?.cancel();
    disc.style.transform = `rotate(${rotation}deg)`;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      disc.style.transform = "rotate(0deg)";
      return;
    }

    const returnAnimation = disc.animate(
      [
        { transform: `rotate(${rotation}deg)` },
        { transform: "rotate(0deg)" },
      ],
      {
        duration: 1400,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    );
    returnAnimationRef.current = returnAnimation;
    returnAnimation.onfinish = () => {
      if (returnAnimationRef.current !== returnAnimation) return;
      disc.style.transform = "rotate(0deg)";
      returnAnimation.cancel();
      returnAnimationRef.current = null;
    };
  }, []);

  const startLyricsDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;

      const lyrics = event.currentTarget;
      lyricsDragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startScrollTop: lyrics.scrollTop,
      };
      lyrics.dataset.dragging = "true";
      lyrics.focus({ preventScroll: true });
      lyrics.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [],
  );

  const moveLyricsDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = lyricsDragRef.current;
      if (drag.pointerId !== event.pointerId) return;

      event.currentTarget.scrollTop =
        drag.startScrollTop - (event.clientY - drag.startY);
      event.preventDefault();
    },
    [],
  );

  const stopLyricsDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (lyricsDragRef.current.pointerId !== event.pointerId) return;

      lyricsDragRef.current.pointerId = -1;
      delete event.currentTarget.dataset.dragging;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  const moveSelection = useCallback(
    (direction: -1 | 1) => {
      if (!visibleTracks.length) return;

      const currentIndex = visibleTracks.findIndex(
        (track) => track.youtubeId === selectedId,
      );
      const nextIndex =
        currentIndex < 0
          ? direction > 0
            ? 0
            : visibleTracks.length - 1
          : (currentIndex + direction + visibleTracks.length) %
            visibleTracks.length;

      selectTrackAtIndex(nextIndex, true);
    },
    [selectTrackAtIndex, selectedId, visibleTracks],
  );

  const selectArtist = useCallback(
    (artist: string) => {
      setActiveArtist(artist);
      pendingTrackFocusRef.current = false;
      setPage(1);
    },
    [],
  );

  const selectPage = useCallback(
    (nextPage: number) => {
      const safePage = Math.min(Math.max(nextPage, 1), totalPages);

      pendingTrackFocusRef.current = false;
      setPage(safePage);
      tableScrollRef.current?.scrollTo({ top: 0 });
    },
    [totalPages],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target;
      if (
        !(target instanceof Element) ||
        !target.closest(".playlist-browser-track-button")
      ) {
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        moveSelection(-1);
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        moveSelection(1);
      } else if (event.key === "Home" && visibleTracks.length) {
        event.preventDefault();
        selectTrackAtIndex(0, true);
      } else if (event.key === "End" && visibleTracks.length) {
        event.preventDefault();
        selectTrackAtIndex(visibleTracks.length - 1, true);
      }
    },
    [moveSelection, selectTrackAtIndex, visibleTracks],
  );

  useEffect(() => {
    const selectedRow = tableScrollRef.current?.querySelector(
      '.playlist-browser-row[data-selected="true"]',
    );

    selectedRow?.scrollIntoView({ block: "nearest" });

    if (pendingTrackFocusRef.current && selectedTrackId) {
      const selectedButton =
        trackButtonRefs.current.get(selectedTrackId) ?? null;

      if (selectedButton) {
        selectedButton.focus({ preventScroll: true });
        pendingTrackFocusRef.current = false;
      }
    }
  }, [currentPage, selectedTrackId]);

  useEffect(() => {
    spinAnimationRef.current?.cancel();
    returnAnimationRef.current?.cancel();
    spinAnimationRef.current = null;
    returnAnimationRef.current = null;
    if (discRef.current) {
      discRef.current.style.transform = "rotate(0deg)";
    }

    return () => {
      spinAnimationRef.current?.cancel();
      returnAnimationRef.current?.cancel();
    };
  }, [selectedTrackId]);

  useEffect(() => {
    if (selectedIndex < 0 || visibleTracks.length < 2) return;

    const adjacentTracks = [
      visibleTracks[
        (selectedIndex - 1 + visibleTracks.length) % visibleTracks.length
      ],
      visibleTracks[(selectedIndex + 1) % visibleTracks.length],
    ];

    adjacentTracks.forEach((track) => {
      if (
        !track?.thumbnail ||
        prefetchedThumbnailRefs.current.has(track.thumbnail)
      ) {
        return;
      }

      prefetchedThumbnailRefs.current.add(track.thumbnail);
      const image = new Image();
      image.src = track.thumbnail;
    });
  }, [selectedIndex, visibleTracks]);

  return (
    <section
      className="playlist-browser space-page"
      aria-label="윤슬의 음악 플레이리스트"
      onKeyDown={handleKeyDown}
    >
      <SpaceHeader
        title="음악 공간"
        count={CURATED_TRACKS.length}
        countLabel={`전체 음악 ${CURATED_TRACKS.length}곡`}
        controls={
          <FilterMenu
            label="아티스트"
            value={activeArtist}
            options={artists}
            onChange={selectArtist}
          />
        }
      />

      <div className="playlist-browser-main">
        <div className="playlist-browser-table-wrap">
          <div
            className="playlist-browser-table-scroll"
            ref={tableScrollRef}
          >
            <table className="playlist-browser-table">
              <caption className="playlist-browser-caption">
                번호, 곡, 아티스트, YouTube로 구성된 플레이리스트
              </caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">곡</th>
                  <th scope="col">아티스트</th>
                  <th scope="col">YouTube</th>
                </tr>
              </thead>
              <tbody>
                {pageTracks.map((track, index) => {
                  const isSelected =
                    track.youtubeId === selectedTrack?.youtubeId;
                  const trackIndex = pageStart + index;

                  return (
                    <tr
                      className={`playlist-browser-row${
                        isSelected ? " playlist-browser-row-active" : ""
                      }`}
                      data-selected={isSelected || undefined}
                      key={track.youtubeId}
                      onClick={(event) =>
                        selectTrackFromRow(event, trackIndex)
                      }
                    >
                      <td aria-label={`${trackIndex + 1}번`}>
                        <span
                          className="playlist-browser-track-number"
                          aria-hidden="true"
                        >
                          {String(trackIndex + 1).padStart(2, "0")}
                        </span>
                      </td>
                      <td>
                        <button
                          className="playlist-browser-track-button"
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`${track.title}, ${track.artist} 선택`}
                          onPointerEnter={(event) =>
                            prepareTrackTitlePan(event.currentTarget)
                          }
                          onFocus={(event) =>
                            prepareTrackTitlePan(event.currentTarget)
                          }
                          tabIndex={
                            isSelected || (!pageHasSelectedTrack && index === 0)
                              ? 0
                              : -1
                          }
                          ref={(node) => {
                            if (node) {
                              trackButtonRefs.current.set(
                                track.youtubeId,
                                node,
                              );
                            } else {
                              trackButtonRefs.current.delete(track.youtubeId);
                            }
                          }}
                        >
                          <span className="playlist-browser-track-title-text">
                            {track.title}
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="playlist-browser-artist">
                          {track.artist}
                        </span>
                      </td>
                      <td>
                        <a
                          className="playlist-browser-thumbnail-link"
                          href={track.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${track.artist}의 ${track.title}, YouTube에서 새 창으로 열기`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube supplies each track thumbnail. */}
                          <img
                            className="playlist-browser-thumbnail"
                            src={track.thumbnail}
                            alt=""
                            width={96}
                            height={54}
                            loading="lazy"
                            decoding="async"
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!visibleTracks.length && (
              <p className="playlist-browser-empty" role="status">
                표시할 곡이 없습니다.
              </p>
            )}
          </div>

          <nav
            className="playlist-pagination"
            aria-label="플레이리스트 페이지"
          >
            <button
              className="playlist-page-button playlist-page-arrow"
              type="button"
              onClick={() =>
                selectPage(Math.max(1, pageGroupStart - PAGE_GROUP_SIZE))
              }
              disabled={pageGroupStart === 1}
              aria-label="이전 5페이지"
            >
              <span aria-hidden="true">{"<"}</span>
            </button>

            {pageItems.map((item) => (
              <button
                className="playlist-page-button playlist-page-number"
                type="button"
                aria-current={item === currentPage ? "page" : undefined}
                aria-label={`${item}페이지`}
                key={item}
                onClick={() => selectPage(item)}
              >
                {item}
              </button>
            ))}

            <button
              className="playlist-page-button playlist-page-arrow"
              type="button"
              onClick={() =>
                selectPage(
                  Math.min(totalPages, pageGroupStart + PAGE_GROUP_SIZE),
                )
              }
              disabled={pageGroupStart + PAGE_GROUP_SIZE > totalPages}
              aria-label="다음 5페이지"
            >
              <span aria-hidden="true">{">"}</span>
            </button>
          </nav>
        </div>

        <aside
          className="playlist-cd-player"
          data-has-selection={selectedTrack ? "true" : "false"}
        >
          {selectedTrack ? (
            <a
              className="playlist-cd-stage playlist-cd-anchor"
              href={selectedTrack.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${selectedTrack.artist}의 ${selectedTrack.title}, CD를 눌러 YouTube에서 새 창으로 듣기`}
              onPointerEnter={startDiscRotation}
              onPointerLeave={stopDiscRotation}
              onFocus={startDiscRotation}
              onBlur={stopDiscRotation}
            >
              <div
                ref={discRef}
                className="playlist-cd-disc"
                key={selectedTrack.youtubeId}
              >
                <span className="playlist-cd-sheen" />
                <span className="playlist-cd-label">
                  {/* eslint-disable-next-line @next/next/no-img-element -- YouTube supplies the selected track thumbnail. */}
                  <img
                    src={selectedTrack.thumbnail}
                    alt=""
                    loading="eager"
                    decoding="async"
                    draggable={false}
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                </span>
                <span className="playlist-cd-hole" />
              </div>
            </a>
          ) : (
            <div
              className="playlist-cd-stage playlist-cd-stage-empty"
              aria-hidden="true"
            >
              <div className="playlist-cd-disc playlist-cd-disc-empty">
                <span className="playlist-cd-sheen" />
                <span className="playlist-cd-hole" />
              </div>
            </div>
          )}

          <div
            ref={lyricsRef}
            className="playlist-lyrics"
            data-empty={
              !selectedTrack || selectedTrack.lyrics === "-" || undefined
            }
            key={
              selectedTrack
                ? `${selectedTrack.youtubeId}-lyrics`
                : "empty-lyrics"
            }
            role="region"
            tabIndex={0}
            aria-label={
              selectedTrack ? `${selectedTrack.title} 가사` : "음악 선택 안내"
            }
            onPointerDown={startLyricsDrag}
            onPointerMove={moveLyricsDrag}
            onPointerUp={stopLyricsDrag}
            onPointerCancel={stopLyricsDrag}
            onLostPointerCapture={stopLyricsDrag}
          >
            {selectedTrack ? (
              <>
                <p className="playlist-lyrics-title">
                  <strong>{selectedTrack.title}</strong>
                </p>
                <p className="playlist-lyrics-body">
                  {selectedTrack.lyrics}
                </p>
              </>
            ) : (
              <p className="playlist-lyrics-prompt">음악을 골라주세요</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
