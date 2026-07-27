import type { Metadata } from "next";
import { SpaceHeader } from "@/app/components/SpaceHeader";
import { WritingList } from "@/app/components/WritingList";
import { posts } from "@/app/content.generated";

function getPostThumbnail(body: string) {
  return /!\[[^\]]*\]\((\/post-images\/[^)\s]+)\)/u.exec(body)?.[1] ?? null;
}

export const metadata: Metadata = {
  title: "글 공간",
  description: "윤슬의 글 목록.",
};

export default function WritingPage() {
  return (
    <div className="content-page writing-page section-shell space-page">
      <SpaceHeader
        title="글 공간"
        count={posts.length}
        countLabel={`전체 글 ${posts.length}개`}
      />

      <WritingList
        posts={posts.map((post) => ({
          slug: post.slug,
          title: post.title,
          date: post.date,
          displayDate: post.displayDate,
          summary: post.description,
          thumbnail: getPostThumbnail(post.body),
        }))}
      />
    </div>
  );
}
