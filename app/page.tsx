import type { Metadata } from "next";
import { HomeScrollScene } from "@/app/components/HomeScrollScene";

export const metadata: Metadata = {
  title: "홈",
};

export default function Home() {
  return <HomeScrollScene />;
}
