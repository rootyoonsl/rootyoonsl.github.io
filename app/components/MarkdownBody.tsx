import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { MarkdownGallery } from "@/app/components/MarkdownGallery";
import { MarkdownImage } from "@/app/components/MarkdownImage";
import { markdownHeadingId } from "@/app/markdown-headings";
import { remarkGalleryDirectives } from "@/app/remark-gallery";

type MarkdownBodyProps = {
  content: string;
  className?: string;
  id?: string;
};

function joinClassNames(
  ...classNames: Array<string | undefined | false>
): string {
  return classNames.filter(Boolean).join(" ");
}

function isExternalWebLink(href: string | undefined): boolean {
  return Boolean(href && /^(?:https?:)?\/\//i.test(href));
}

function withoutMarkdownNode<T extends { node?: unknown }>(
  props: T,
): Omit<T, "node"> {
  const { node, ...domProps } = props;
  void node;
  return domProps;
}

function headingAnchor(
  node:
    | {
        position?: {
          start?: {
            line?: number;
          };
        };
      }
    | undefined,
): string | undefined {
  const lineNumber = node?.position?.start?.line;
  return lineNumber ? markdownHeadingId(lineNumber) : undefined;
}

const markdownComponents: Components = {
  h1: (props) => {
    const { node, className, ...domProps } = props;
    return (
      <h1
        {...domProps}
        id={headingAnchor(node)}
        className={joinClassNames(
          "markdown-heading",
          "markdown-heading--1",
          className,
        )}
      />
    );
  },
  h2: (props) => {
    const { node, className, ...domProps } = props;
    return (
      <h2
        {...domProps}
        id={headingAnchor(node)}
        className={joinClassNames(
          "markdown-heading",
          "markdown-heading--2",
          className,
        )}
      />
    );
  },
  h3: (props) => {
    const { node, className, ...domProps } = props;
    return (
      <h3
        {...domProps}
        id={headingAnchor(node)}
        className={joinClassNames(
          "markdown-heading",
          "markdown-heading--3",
          className,
        )}
      />
    );
  },
  h4: (props) => {
    const { node, className, ...domProps } = props;
    return (
      <h4
        {...domProps}
        id={headingAnchor(node)}
        className={joinClassNames(
          "markdown-heading",
          "markdown-heading--4",
          className,
        )}
      />
    );
  },
  h5: (props) => {
    const { node, className, ...domProps } = props;
    return (
      <h5
        {...domProps}
        id={headingAnchor(node)}
        className={joinClassNames(
          "markdown-heading",
          "markdown-heading--5",
          className,
        )}
      />
    );
  },
  h6: (props) => {
    const { node, className, ...domProps } = props;
    return (
      <h6
        {...domProps}
        id={headingAnchor(node)}
        className={joinClassNames(
          "markdown-heading",
          "markdown-heading--6",
          className,
        )}
      />
    );
  },
  p: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <p
        {...domProps}
        className={joinClassNames("markdown-paragraph", className)}
      />
    );
  },
  div: (props) => {
    const { className, children, ...domProps } = withoutMarkdownNode(props);
    const classNames = className?.split(/\s+/u) ?? [];
    const layout = classNames.includes("markdown-gallery-source--slider")
      ? "slider"
      : classNames.includes("markdown-gallery-source--grid")
        ? "grid"
        : null;

    if (layout) {
      return <MarkdownGallery layout={layout}>{children}</MarkdownGallery>;
    }

    return (
      <div {...domProps} className={className}>
        {children}
      </div>
    );
  },
  a: (props) => {
    const { href, className, ...domProps } = withoutMarkdownNode(props);
    const external = isExternalWebLink(href);

    return (
      <a
        {...domProps}
        className={joinClassNames(
          "markdown-link",
          external && "markdown-link--external",
          className,
        )}
        href={href}
        rel={external ? "noopener noreferrer" : undefined}
        target={external ? "_blank" : undefined}
      />
    );
  },
  img: (props) => {
    const { alt, className, src, title } = withoutMarkdownNode(props);
    return (
      <MarkdownImage
        alt={alt ?? ""}
        className={className}
        src={src}
        title={title}
      />
    );
  },
  blockquote: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <blockquote
        {...domProps}
        className={joinClassNames("markdown-blockquote", className)}
      />
    );
  },
  ul: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <ul
        {...domProps}
        className={joinClassNames(
          "markdown-list",
          "markdown-list--unordered",
          className,
        )}
      />
    );
  },
  ol: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <ol
        {...domProps}
        className={joinClassNames(
          "markdown-list",
          "markdown-list--ordered",
          className,
        )}
      />
    );
  },
  li: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <li
        {...domProps}
        className={joinClassNames("markdown-list-item", className)}
      />
    );
  },
  strong: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <strong
        {...domProps}
        className={joinClassNames("markdown-strong", className)}
      />
    );
  },
  em: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <em
        {...domProps}
        className={joinClassNames("markdown-emphasis", className)}
      />
    );
  },
  del: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <del
        {...domProps}
        className={joinClassNames("markdown-deleted", className)}
      />
    );
  },
  hr: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <hr
        {...domProps}
        className={joinClassNames("markdown-divider", className)}
      />
    );
  },
  pre: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <pre
        {...domProps}
        className={joinClassNames("markdown-preformatted", className)}
      />
    );
  },
  code: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <code
        {...domProps}
        className={joinClassNames("markdown-code", className)}
      />
    );
  },
  table: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <div
        aria-label="표"
        className="markdown-table-wrap"
        role="region"
        tabIndex={0}
      >
        <table
          {...domProps}
          className={joinClassNames("markdown-table", className)}
        />
      </div>
    );
  },
  thead: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <thead
        {...domProps}
        className={joinClassNames("markdown-table-head", className)}
      />
    );
  },
  tbody: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <tbody
        {...domProps}
        className={joinClassNames("markdown-table-body", className)}
      />
    );
  },
  tr: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <tr
        {...domProps}
        className={joinClassNames("markdown-table-row", className)}
      />
    );
  },
  th: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <th
        {...domProps}
        className={joinClassNames("markdown-table-heading", className)}
      />
    );
  },
  td: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <td
        {...domProps}
        className={joinClassNames("markdown-table-cell", className)}
      />
    );
  },
  input: (props) => {
    const { className, ...domProps } = withoutMarkdownNode(props);
    return (
      <input
        {...domProps}
        className={joinClassNames("markdown-task-checkbox", className)}
        disabled
      />
    );
  },
};

export function MarkdownBody({
  content,
  className,
  id,
}: MarkdownBodyProps) {
  return (
    <div id={id} className={joinClassNames("markdown-body", className)}>
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={[[rehypeKatex, { strict: false }]]}
        remarkPlugins={[remarkGfm, remarkMath, remarkGalleryDirectives]}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
