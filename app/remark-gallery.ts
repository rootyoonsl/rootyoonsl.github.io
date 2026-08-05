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

const gridOpeningPattern =
  /^:::gallery(?:\s+layout\s*=\s*(?:"grid"|'grid'|grid))?\s*$/u;

function isGalleryOpening(value: string | undefined): boolean {
  if (!value) return false;

  const marker = value.trim();
  if (gridOpeningPattern.test(marker)) return true;
  if (/^:::gallery\b/u.test(marker)) {
    throw new Error(
      "Only grid galleries are supported. Use :::gallery or :::gallery layout=\"grid\".",
    );
  }
  return false;
}

function isClosingMarker(node: MarkdownNode): boolean {
  return (
    node.type === "paragraph" &&
    node.children?.length === 1 &&
    node.children[0].type === "text" &&
    node.children[0].value?.trim() === ":::"
  );
}

function isParagraphMarker(node: MarkdownNode): boolean {
  if (
    node.type !== "paragraph" ||
    node.children?.length !== 1 ||
    node.children[0].type !== "text"
  ) {
    return false;
  }

  return isGalleryOpening(node.children[0].value);
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

function galleryNode(images: MarkdownNode[]): MarkdownNode {
  return {
    type: "paragraph",
    children: images,
    data: {
      hName: "div",
      hProperties: {
        className: [
          "markdown-gallery-source",
          "markdown-gallery-source--grid",
        ],
      },
    },
  };
}

function inlineGallery(node: MarkdownNode): MarkdownNode | null {
  if (node.type !== "paragraph" || !node.children?.length) return null;

  const first = node.children[0];
  const last = node.children.at(-1);
  const hasOpening =
    first.type === "text" && isGalleryOpening(first.value);

  if (!hasOpening || last?.type !== "text" || last.value?.trim() !== ":::") {
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
    ? galleryNode(images)
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

      if (!isParagraphMarker(tree.children[index])) continue;

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
        galleryNode(images),
      );
    }
  };
}
