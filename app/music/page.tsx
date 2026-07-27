import type { Metadata } from "next";
import { Playlist } from "@/app/components/Playlist";

export const metadata: Metadata = {
  title: "음악 공간",
  description: "음악 목록.",
};

export default function MusicPage() {
  return <Playlist />;
}
