"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Children,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";

type MarkdownGalleryProps = {
  children: ReactNode;
  layout: "grid" | "slider";
};

const DRAG_THRESHOLD = 44;
const CLICK_CANCEL_THRESHOLD = 6;

export function MarkdownGallery({
  children,
  layout,
}: MarkdownGalleryProps) {
  const slides = Children.toArray(children);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const cancelNextClick = useRef(false);
  const slideCount = slides.length;

  const showPrevious = useCallback(() => {
    setActiveIndex((current) =>
      current === 0 ? slideCount - 1 : current - 1,
    );
  }, [slideCount]);

  const showNext = useCallback(() => {
    setActiveIndex((current) =>
      current === slideCount - 1 ? 0 : current + 1,
    );
  }, [slideCount]);

  if (!slideCount) return null;

  if (layout === "grid") {
    return (
      <section
        className="markdown-gallery markdown-gallery--grid"
        aria-label={`${slideCount}장의 사진`}
      >
        {slides.map((slide, index) => (
          <div className="markdown-gallery-grid-item" key={index}>
            {slide}
          </div>
        ))}
      </section>
    );
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    dragStartX.current = event.clientX;
    cancelNextClick.current = false;
    setDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;

    const nextOffset = event.clientX - dragStartX.current;
    setDragOffset(nextOffset);

    if (Math.abs(nextOffset) >= CLICK_CANCEL_THRESHOLD) {
      cancelNextClick.current = true;
      setIsDragging(true);
    }
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;

    const finalOffset = event.clientX - dragStartX.current;
    dragStartX.current = null;
    setDragOffset(0);
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (finalOffset <= -DRAG_THRESHOLD) {
      showNext();
    } else if (finalOffset >= DRAG_THRESHOLD) {
      showPrevious();
    }

    window.setTimeout(() => {
      cancelNextClick.current = false;
    }, 0);
  };

  const cancelDrag = (event: PointerEvent<HTMLDivElement>) => {
    dragStartX.current = null;
    cancelNextClick.current = false;
    setDragOffset(0);
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      className="markdown-gallery markdown-gallery--slider"
      aria-label={`${slideCount}장의 사진 슬라이드`}
    >
      <div
        className={`markdown-gallery-slider-window${isDragging ? " is-dragging" : ""}`}
        onClickCapture={(event) => {
          if (!cancelNextClick.current) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={handleKeyDown}
        onPointerCancel={cancelDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        tabIndex={0}
      >
        {slides.map((slide, index) => (
          <div
            className="markdown-gallery-slide"
            hidden={index !== activeIndex}
            key={index}
            style={
              index === activeIndex
                ? { transform: `translateX(${dragOffset}px)` }
                : undefined
            }
          >
            {slide}
          </div>
        ))}
      </div>

      {slideCount > 1 && (
        <div className="markdown-gallery-controls">
          <button
            type="button"
            className="markdown-gallery-arrow"
            onClick={showPrevious}
            aria-label="이전 사진"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="markdown-gallery-position" aria-live="polite">
            {activeIndex + 1} / {slideCount}
          </span>
          <button
            type="button"
            className="markdown-gallery-arrow"
            onClick={showNext}
            aria-label="다음 사진"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
