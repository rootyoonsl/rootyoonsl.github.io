import type { Metadata } from "next";
import { BookShelf } from "@/app/components/BookShelf";

export const metadata: Metadata = {
  title: "책 공간",
  description: "책 목록.",
};

export default function BooksPage() {
  return <BookShelf />;
}
