"use client";

import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import type { GeneratedPhoto } from "@/app/content.generated";
import { SpaceHeader } from "@/app/components/SpaceHeader";

type PhotoGalleryProps = {
  photos: GeneratedPhoto[];
};

type LightboxPhase = "closed" | "opening" | "open" | "closing";

type PhotoLayoutStyle = CSSProperties & {
  "--photo-ratio": number;
  "--photo-basis-wide": string;
  "--photo-basis-medium": string;
  "--photo-basis-compact": string;
};

function getPhotoLayoutStyle(photo: GeneratedPhoto): PhotoLayoutStyle {
  const ratio = photo.width / photo.height;

  return {
    "--photo-ratio": ratio,
    "--photo-basis-wide": `${ratio * 360}px`,
    "--photo-basis-medium": `${ratio * 280}px`,
    "--photo-basis-compact": `${ratio * 185}px`,
  };
}

const PHOTO_TRANSITION_MS = 680;
const MOBILE_PHOTO_TRANSITION_MS = 420;

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [lightboxPhase, setLightboxPhase] =
    useState<LightboxPhase>("closed");
  const lightboxRef = useRef<HTMLDivElement>(null);
  const enlargedPhotoRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadedPhotoSourcesRef = useRef(new Set<string>());
  const isOpen = activeIndex !== null;
  const activePhoto = activeIndex === null ? null : photos[activeIndex];
  const activePhotoRatio = activePhoto
    ? activePhoto.width / activePhoto.height
    : 1;

  const preloadPhoto = useCallback((photo: GeneratedPhoto) => {
    if (preloadedPhotoSourcesRef.current.has(photo.src)) return;

    preloadedPhotoSourcesRef.current.add(photo.src);
    const image = new Image();
    image.decoding = "async";
    image.src = photo.src;
  }, []);

  const closePhoto = useCallback(() => {
    if (closeTimerRef.current) return;

    setLightboxPhase("closing");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const mobileLayout = window.matchMedia("(max-width: 760px)").matches;
    const delay = reducedMotion
      ? 0
      : mobileLayout
        ? MOBILE_PHOTO_TRANSITION_MS
        : PHOTO_TRANSITION_MS;

    closeTimerRef.current = setTimeout(() => {
      setActiveIndex(null);
      setLightboxPhase("closed");
      closeTimerRef.current = null;

      const url = new URL(window.location.href);
      if (url.searchParams.has("photo")) {
        url.searchParams.delete("photo");
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      }
    }, delay);
  }, []);

  const revealPhoto = useCallback(
    (index: number, trigger?: HTMLButtonElement) => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (trigger) {
        lastTriggerRef.current = trigger;
      }
      setActiveIndex(index);
      setLightboxPhase("opening");
    },
    [],
  );

  const openPhoto = useCallback(
    (index: number, event: MouseEvent<HTMLButtonElement>) => {
      revealPhoto(index, event.currentTarget);
    },
    [revealPhoto],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const requestedPhoto = new URLSearchParams(window.location.search).get(
        "photo",
      );
      const requestedIndex = photos.findIndex(
        (photo) => photo.id === requestedPhoto,
      );

      if (requestedIndex >= 0) {
        revealPhoto(requestedIndex);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [photos, revealPhoto]);

  useEffect(() => {
    if (lightboxPhase !== "opening") return;

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setLightboxPhase("open");
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [lightboxPhase]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) return;

    const focusFrame = requestAnimationFrame(() =>
      enlargedPhotoRef.current?.focus(),
    );

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePhoto();
      } else if (event.key === "Tab") {
        const controls = Array.from(
          lightboxRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? [],
        );
        if (!controls.length) return;

        const firstControl = controls[0];
        const lastControl = controls.at(-1) ?? firstControl;
        const activeElement = document.activeElement;
        const focusIsOutside =
          !activeElement || !lightboxRef.current?.contains(activeElement);

        if (
          event.shiftKey &&
          (activeElement === firstControl || focusIsOutside)
        ) {
          event.preventDefault();
          lastControl.focus();
        } else if (
          !event.shiftKey &&
          (activeElement === lastControl || focusIsOutside)
        ) {
          event.preventDefault();
          firstControl.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      lastTriggerRef.current?.focus({ preventScroll: true });
    };
  }, [closePhoto, isOpen]);

  return (
    <section className="photo-gallery-root space-page">
      <SpaceHeader
        title="사진 공간"
        count={photos.length}
        countLabel={`사진 ${photos.length}장`}
      />

      <ol className="photo-gallery-grid" aria-label="촬영일 최신순 사진 목록">
        {photos.map((photo, index) => (
          <li
            key={photo.id}
            style={getPhotoLayoutStyle(photo)}
            data-orientation={
              photo.width > photo.height ? "landscape" : "portrait"
            }
          >
            <button
              className="photo-gallery-card"
              type="button"
              onClick={(event) => openPhoto(index, event)}
              onPointerEnter={() => preloadPhoto(photo)}
              onPointerDown={() => preloadPhoto(photo)}
              onFocus={() => preloadPhoto(photo)}
              aria-label={`${photo.displayDate}에 촬영한 ${index + 1}번째 사진 확대`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Generated local thumbnails are resized without cropping. */}
              <img
                src={photo.thumbnail}
                alt=""
                width={photo.width}
                height={photo.height}
                loading={index < 6 ? "eager" : "lazy"}
                decoding="async"
              />
            </button>
          </li>
        ))}
      </ol>

      {activePhoto && (
        <div
          className="photo-lightbox"
          ref={lightboxRef}
          data-state={lightboxPhase}
          role="dialog"
          aria-modal="true"
          aria-label="확대된 사진"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePhoto();
          }}
        >
          <button
            className="photo-lightbox-photo-button"
            type="button"
            ref={enlargedPhotoRef}
            onClick={closePhoto}
            aria-label="확대 사진을 닫고 갤러리로 돌아가기"
            style={
              {
                "--active-photo-ratio": activePhotoRatio,
                "--active-photo-height-bound-width":
                  `${activePhotoRatio * 80}vh`,
                "--active-photo-dynamic-height-bound-width":
                  `${activePhotoRatio * 80}dvh`,
              } as CSSProperties
            }
            data-orientation={
              activePhoto.width >= activePhoto.height
                ? "landscape"
                : "portrait"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Generated local display images are resized without cropping. */}
            <img
              className="photo-lightbox-image"
              key={activePhoto.id}
              src={activePhoto.src}
              alt={activePhoto.alt}
              width={activePhoto.width}
              height={activePhoto.height}
              decoding="async"
              data-orientation={
                activePhoto.width >= activePhoto.height
                  ? "landscape"
                  : "portrait"
              }
            />
          </button>
          <button
            className="photo-lightbox-close"
            type="button"
            onClick={closePhoto}
            aria-label="확대 사진 닫기"
            title="닫기"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
