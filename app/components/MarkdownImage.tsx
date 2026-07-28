"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type MarkdownImageProps = {
  alt?: string;
  className?: string;
  src?: string;
  title?: string;
};

type LightboxPhase = "closed" | "opening" | "open" | "closing";

type ActiveImage = {
  alt: string;
  height: number;
  src: string;
  width: number;
};

const PHOTO_TRANSITION_MS = 680;
const MOBILE_PHOTO_TRANSITION_MS = 420;

function joinClassNames(
  ...classNames: Array<string | undefined | false>
): string {
  return classNames.filter(Boolean).join(" ");
}

export function MarkdownImage({
  alt = "",
  className,
  src,
  title,
}: MarkdownImageProps) {
  const [activeImage, setActiveImage] = useState<ActiveImage | null>(null);
  const [lightboxPhase, setLightboxPhase] =
    useState<LightboxPhase>("closed");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const enlargedImageRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpen = activeImage !== null;
  const activeImageRatio = activeImage
    ? activeImage.width / activeImage.height
    : 1;

  const closeImage = useCallback(() => {
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
      setActiveImage(null);
      setLightboxPhase("closed");
      closeTimerRef.current = null;
    }, delay);
  }, []);

  const openImage = useCallback(() => {
    const image = imageRef.current;
    if (!image || !src) return;

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    const width = image.naturalWidth || image.width || 1;
    const height = image.naturalHeight || image.height || 1;

    setActiveImage({
      alt,
      height,
      src: image.currentSrc || image.src || src,
      width,
    });
    setLightboxPhase("opening");
  }, [alt, src]);

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

    const trigger = triggerRef.current;
    const focusFrame = requestAnimationFrame(() =>
      enlargedImageRef.current?.focus(),
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeImage();
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
      trigger?.focus({ preventScroll: true });
    };
  }, [closeImage, isOpen]);

  const lightbox = activeImage ? (
    <div
      className="photo-lightbox article-image-lightbox"
      ref={lightboxRef}
      data-state={lightboxPhase}
      role="dialog"
      aria-modal="true"
      aria-label={
        activeImage.alt
          ? `${activeImage.alt} 확대 이미지`
          : "확대된 게시글 이미지"
      }
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeImage();
      }}
    >
      <button
        className="photo-lightbox-photo-button"
        type="button"
        ref={enlargedImageRef}
        onClick={closeImage}
        aria-label="확대 이미지를 닫고 게시글로 돌아가기"
        style={
          {
            "--active-photo-ratio": activeImageRatio,
            "--active-photo-height-bound-width":
              `${activeImageRatio * 80}vh`,
            "--active-photo-dynamic-height-bound-width":
              `${activeImageRatio * 80}dvh`,
          } as CSSProperties
        }
        data-orientation={
          activeImage.width >= activeImage.height ? "landscape" : "portrait"
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Markdown images have arbitrary sources and dimensions. */}
        <img
          className="photo-lightbox-image"
          src={activeImage.src}
          alt={activeImage.alt}
          width={activeImage.width}
          height={activeImage.height}
          decoding="async"
        />
      </button>
      <button
        className="photo-lightbox-close"
        type="button"
        onClick={closeImage}
        aria-label="확대 이미지 닫기"
        title="닫기"
      >
        <X size={19} aria-hidden="true" />
      </button>
    </div>
  ) : null;

  return (
    <>
      <button
        className="markdown-image-trigger"
        type="button"
        ref={triggerRef}
        onClick={openImage}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={alt ? `${alt} 확대` : "게시글 이미지 확대"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Markdown images have arbitrary sources and dimensions. */}
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          title={title}
          className={joinClassNames("markdown-image", className)}
          decoding="async"
          loading="lazy"
        />
      </button>
      {lightbox && createPortal(lightbox, document.body)}
    </>
  );
}
