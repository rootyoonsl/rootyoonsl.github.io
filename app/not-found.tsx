import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="not-found section-shell">
      <span>404</span>
      <h1>페이지를 찾을 수 없습니다.</h1>
      <p>주소를 확인해주세요.</p>
      <Link href="/">
        <ArrowLeft size={17} />
        홈으로
      </Link>
    </div>
  );
}
