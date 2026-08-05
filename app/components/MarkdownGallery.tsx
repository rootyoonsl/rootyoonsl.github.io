import { Children, type ReactNode } from "react";

type MarkdownGalleryProps = {
  children: ReactNode;
};

export function MarkdownGallery({ children }: MarkdownGalleryProps) {
  const images = Children.toArray(children);
  if (!images.length) return null;

  return (
    <section
      className="markdown-gallery markdown-gallery--grid"
      aria-label={`${images.length}장의 사진`}
    >
      {images.map((image, index) => (
        <div className="markdown-gallery-grid-item" key={index}>
          {image}
        </div>
      ))}
    </section>
  );
}
