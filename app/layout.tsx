import type { Metadata } from "next";
import { SiteShell } from "@/app/components/SiteShell";
import "./katex.generated.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Root Yoonsl",
    template: "%s — Root Yoonsl",
  },
  description: "글, 책, 음악, 사진을 모아둔 개인 블로그.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
  openGraph: {
    title: "Root Yoonsl",
    description: "글, 책, 음악, 사진을 모아둔 개인 블로그.",
    type: "website",
    locale: "ko_KR",
  },
};

const themeScript = `
  (() => {
    try {
      const savedTheme = localStorage.getItem("yoonsl-theme-mode");
      const theme =
        savedTheme === "sunset-light" ||
        savedTheme === "sunset-dark" ||
        savedTheme === "light" ||
        savedTheme === "dark"
          ? savedTheme
          : "sunset-light";
      const root = document.documentElement;
      root.classList.toggle(
        "sunset",
        theme === "sunset-light" || theme === "sunset-dark"
      );
      root.classList.toggle(
        "dark",
        theme === "sunset-dark" || theme === "dark"
      );
      root.dataset.theme = theme;
      localStorage.setItem("yoonsl-theme-mode", theme);
    } catch (_) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
