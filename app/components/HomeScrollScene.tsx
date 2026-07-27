import Link from "next/link";
import { InteractiveCover } from "@/app/components/InteractiveCover";

export function HomeScrollScene() {
  return (
    <section className="home-scroll-scene">
      <div className="home-minimal">
        <InteractiveCover />
        <h1 className="home-logo" aria-label="Root Yoonsl">
          <span>Root</span>
          <span>Yoonsl</span>
        </h1>
        <nav className="home-navigation" aria-label="공간 선택">
          <Link href="/writing">글 공간</Link>
          <Link href="/books">책 공간</Link>
          <Link href="/music">음악 공간</Link>
          <Link href="/photos">사진 공간</Link>
        </nav>
      </div>
    </section>
  );
}
