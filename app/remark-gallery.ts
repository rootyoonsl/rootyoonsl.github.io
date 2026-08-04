type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
};

type MarkdownRoot = MarkdownNode & {
  children: MarkdownNode[];
};

type GalleryLayout = "grid" | "slider";

const galleryOpeningPattern =
  /^:::gallery\s+layout\s*=\s*(?:"(grid|slider)"|'(grid|slider)'|(grid|slider))\s*$/u;

function galleryLayout(value: string | undefined): GalleryLayout | null {
  if (!value) return null;

  const match = value.trim().match(galleryOpeningPattern);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? null) as
    | GalleryLayout
    | null;
}

function isClosingMarker(node: MarkdownNode): boolean {
  return (
    node.type === "paragraph" &&
    node.children?.length === 1 &&
    node.children[0].type === "text" &&
    node.children[0].value?.trim() === ":::"
  );
}

function paragraphMarker(node: MarkdownNode): GalleryLayout | null {
  if (
    node.type !== "paragraph" ||
    node.children?.length !== 1 ||
    node.children[0].type !== "text"
  ) {
    return null;
  }

  return galleryLayout(node.children[0].value);
}

function galleryImages(node: MarkdownNode): MarkdownNode[] | null {
  if (node.type === "image") return [node];
  if (node.type !== "paragraph" || !node.children?.length) return null;

  const images = node.children.filter((child) => child.type === "image");
  const hasOnlyImagesAndWhitespace = node.children.every(
    (child) =>
      child.type === "image" ||
      (child.type === "text" && !child.value?.trim()),
  );

  return hasOnlyImagesAndWhitespace && images.length ? images : null;
}

function galleryNode(
  layout: GalleryLayout,
  images: MarkdownNode[],
): MarkdownNode {
  return {
    type: "paragraph",
    children: images,
    data: {
      hName: "div",
      hProperties: {
        className: [
          "markdown-gallery-source",
          `markdown-gallery-source--${layout}`,
        ],
      },
    },
  };
}

function inlineGallery(node: MarkdownNode): MarkdownNode | null {
  if (node.type !== "paragraph" || !node.children?.length) return null;

  const first = node.children[0];
  const last = node.children.at(-1);
  const layout = first.type === "text" ? galleryLayout(first.value) : null;

  if (!layout || last?.type !== "text" || last.value?.trim() !== ":::") {
    return null;
  }

  const middle = node.children.slice(1, -1);
  const images = middle.filter((child) => child.type === "image");
  const hasOnlyImagesAndWhitespace = middle.every(
    (child) =>
      child.type === "image" ||
      (child.type === "text" && !child.value?.trim()),
  );

  return hasOnlyImagesAndWhitespace && images.length
    ? galleryNode(layout, images)
    : null;
}

export function remarkGalleryDirectives() {
  return (tree: MarkdownRoot) => {
    for (let index = 0; index < tree.children.length; index += 1) {
      const inline = inlineGallery(tree.children[index]);
      if (inline) {
        tree.children.splice(index, 1, inline);
        continue;
      }

      const layout = paragraphMarker(tree.children[index]);
      if (!layout) continue;

      const images: MarkdownNode[] = [];
      let closingIndex = index + 1;
      let valid = false;

      for (; closingIndex < tree.children.length; closingIndex += 1) {
        const child = tree.children[closingIndex];
        if (isClosingMarker(child)) {
          valid = images.length > 0;
          break;
        }

        const childImages = galleryImages(child);
        if (!childImages) break;
        images.push(...childImages);
      }

      if (!valid) continue;

      tree.children.splice(
        index,
        closingIndex - index + 1,
        galleryNode(layout, images),
      );
    }
  };
}
