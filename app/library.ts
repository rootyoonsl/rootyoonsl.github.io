import {
  books as sourceBooks,
  musics as sourceMusics,
} from "@/app/content.generated";
import { BOOKS } from "@/app/library-meta";
import { MUSIC_LYRICS } from "@/app/music-lyrics";

type CuratedBook = {
  title: string;
  author: string;
  href: string;
  cover: string;
};

type CuratedTrack = {
  title: string;
  artist: string;
  href: string;
  thumbnail: string;
  youtubeId: string;
  lyrics: string;
}

function youtubeIdFrom(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1);
    if (parsed.hostname.endsWith("youtube.com")) {
      return parsed.searchParams.get("v") ?? "";
    }
  } catch {
    return "";
  }
  return "";
}

export const CURATED_BOOKS: readonly CuratedBook[] = sourceBooks.map((item) => {
  const verified = BOOKS.find((book) => book.href === item.url);

  return {
    title: item.title,
    author: verified?.author ?? "기록 중",
    href: item.url,
    cover: verified?.cover ?? "/images/yoonsl.jpg",
  };
});

export const CURATED_TRACKS: readonly CuratedTrack[] = sourceMusics.map(
  (item) => {
    const youtubeId = youtubeIdFrom(item.url);

    return {
      title: item.title,
      artist: item.artist ?? "기록 중",
      href: item.url,
      thumbnail: youtubeId
        ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
        : "/images/yoonsl.jpg",
      youtubeId: youtubeId || item.url,
      lyrics:
        MUSIC_LYRICS[youtubeId as keyof typeof MUSIC_LYRICS]?.trim() ||
        "-",
    };
  },
);
