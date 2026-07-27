import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { ArticleTableOfContents } from "@/app/components/ArticleTableOfContents";
import { MarkdownBody } from "@/app/components/MarkdownBody";
import { posts } from "@/app/content.generated";
import { extractMarkdownHeadings } from "@/app/markdown-headings";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((item) => item.slug === decodeURIComponent(slug));
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
  };
}

export default async function WritingDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const postIndex = posts.findIndex(
    (item) => item.slug === decodeURIComponent(slug),
  );
  const post = posts[postIndex];
  if (!post) notFound();
  const previousPost = posts[postIndex + 1] ?? null;
  const nextPost = posts[postIndex - 1] ?? null;
  const tableOfContents = extractMarkdownHeadings(post.body);

  return (
    <article className="simple-article section-shell">
      <Link href="/writing" className="back-link">
        <ArrowLeft size={15} />
        글 목록
      </Link>

      <header className="simple-article-header">
        <h1>{post.title}</h1>
        <p>
          <time dateTime={post.date}>{post.displayDate}</time>
        </p>
      </header>

      <ArticleTableOfContents headings={tableOfContents} />
      <MarkdownBody id="article-body" content={post.body} />

      <nav className="article-bottom-nav" aria-label="게시글 이동">
        {previousPost ? (
          <Link
            className="article-nav-tab article-nav-tab-previous"
            href={`/writing/${encodeURIComponent(previousPost.slug)}`}
            aria-label={`이전 글: ${previousPost.title}`}
            title={previousPost.title}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="article-nav-copy">
              <span className="article-nav-label">이전 글</span>
              <strong className="article-nav-title">
                {previousPost.title}
              </strong>
            </span>
          </Link>
        ) : (
          <span
            className="article-nav-tab article-nav-tab-previous is-disabled"
            aria-disabled="true"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>이전 글</span>
          </span>
        )}

        <Link className="article-nav-tab article-nav-tab-list" href="/writing">
          글 목록
        </Link>

        {nextPost ? (
          <Link
            className="article-nav-tab article-nav-tab-next"
            href={`/writing/${encodeURIComponent(nextPost.slug)}`}
            aria-label={`다음 글: ${nextPost.title}`}
            title={nextPost.title}
          >
            <span className="article-nav-copy">
              <span className="article-nav-label">다음 글</span>
              <strong className="article-nav-title">{nextPost.title}</strong>
            </span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <span
            className="article-nav-tab article-nav-tab-next is-disabled"
            aria-disabled="true"
          >
            <span>다음 글</span>
            <ArrowRight size={14} aria-hidden="true" />
          </span>
        )}
      </nav>
    </article>
  );
}
