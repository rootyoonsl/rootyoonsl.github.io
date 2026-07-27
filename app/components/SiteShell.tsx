"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Search, Sun, Sunset, X } from "lucide-react";
import {
  type ReactNode,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { InteractiveCover } from "@/app/components/InteractiveCover";
import { GITHUB_URL } from "@/app/library-meta";

type Theme = "sunset-light" | "sunset-dark" | "light" | "dark";
type RouteMotion = "settled" | "from-home" | "to-home" | "between-spaces";

const SearchDialog = lazy(() => import("@/app/components/SearchDialog"));

function GitHubMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}

const navigation = [
  { href: "/writing", label: "글 공간" },
  { href: "/books", label: "책 공간" },
  { href: "/music", label: "음악 공간" },
  { href: "/photos", label: "사진 공간" },
] as const;

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [theme, setTheme] = useState<Theme>("sunset-light");
  const [routeMotion, setRouteMotion] = useState<RouteMotion>("settled");
  const [headerVisible, setHeaderVisible] = useState(!isHome);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const themeRef = useRef<Theme>("sunset-light");
  const themeTransitionTimer = useRef<number | null>(null);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const root = document.documentElement;
      const sunsetEnabled = root.classList.contains("sunset");
      const darkEnabled = root.classList.contains("dark");
      const currentTheme: Theme = sunsetEnabled
        ? darkEnabled
          ? "sunset-dark"
          : "sunset-light"
        : darkEnabled
          ? "dark"
          : "light";
      themeRef.current = currentTheme;
      setTheme(currentTheme);
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileOpen(false);
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      if (themeTransitionTimer.current !== null) {
        window.clearTimeout(themeTransitionTimer.current);
      }
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const closeMenuOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        setMobileOpen(false);
      }
    };

    mobileQuery.addEventListener("change", closeMenuOnDesktop);
    return () => {
      mobileQuery.removeEventListener("change", closeMenuOnDesktop);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  useLayoutEffect(() => {
    const previousPathname = previousPathnameRef.current;

    if (previousPathname === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const settleFrame = window.requestAnimationFrame(() => {
        setRouteMotion("settled");
        setHeaderVisible(pathname !== "/");
      });
      return () => window.cancelAnimationFrame(settleFrame);
    }

    let settleTimer: number;

    if (previousPathname === "/" && pathname !== "/") {
      setHeaderVisible(true);
      setRouteMotion("from-home");
      settleTimer = window.setTimeout(() => setRouteMotion("settled"), 700);
    } else if (previousPathname !== "/" && pathname === "/") {
      setHeaderVisible(true);
      setRouteMotion("to-home");
      settleTimer = window.setTimeout(() => {
        setRouteMotion("settled");
        setHeaderVisible(false);
      }, 620);
    } else {
      setHeaderVisible(true);
      setRouteMotion("between-spaces");
      settleTimer = window.setTimeout(() => setRouteMotion("settled"), 420);
    }

    return () => window.clearTimeout(settleTimer);
  }, [pathname]);

  const runThemeTransition = (update: () => void) => {
    const root = document.documentElement;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      update();
      return;
    }

    if (themeTransitionTimer.current !== null) {
      window.clearTimeout(themeTransitionTimer.current);
    }

    root.classList.add("theme-transitioning");
    void root.offsetWidth;
    update();
    themeTransitionTimer.current = window.setTimeout(() => {
      root.classList.remove("theme-transitioning");
      themeTransitionTimer.current = null;
    }, 600);
  };

  const applyTheme = (selectedTheme: Theme) => {
    runThemeTransition(() => {
      const root = document.documentElement;
      themeRef.current = selectedTheme;
      root.classList.toggle(
        "sunset",
        selectedTheme === "sunset-light" ||
          selectedTheme === "sunset-dark",
      );
      root.classList.toggle(
        "dark",
        selectedTheme === "sunset-dark" || selectedTheme === "dark",
      );
      root.dataset.theme = selectedTheme;
      localStorage.setItem("yoonsl-theme-mode", selectedTheme);
      setTheme(selectedTheme);
    });
  };

  const toggleSunset = () => {
    const currentTheme = themeRef.current;
    const selectedTheme: Theme = currentTheme.startsWith("sunset")
      ? currentTheme === "sunset-dark"
        ? "dark"
        : "light"
      : currentTheme === "dark"
        ? "sunset-dark"
        : "sunset-light";

    applyTheme(selectedTheme);
  };

  const toggleColorMode = () => {
    const currentTheme = themeRef.current;
    const selectedTheme: Theme = currentTheme.endsWith("dark")
      ? currentTheme === "sunset-dark"
        ? "sunset-light"
        : "light"
      : currentTheme === "sunset-light"
        ? "sunset-dark"
        : "dark";

    applyTheme(selectedTheme);
  };

  const sunsetEnabled = theme.startsWith("sunset");
  const darkEnabled = theme.endsWith("dark");
  const activeNavigationIndex = Math.max(
    0,
    navigation.findIndex((item) => pathname.startsWith(item.href)),
  );
  const routeMotionClass =
    routeMotion === "settled" ? "" : `route-${routeMotion}`;

  return (
    <div
      className={`site-root ${isHome ? "is-home" : ""}`}
      data-theme={theme}
    >
      {!isHome && (
        <div className="sunset-theme-cover" aria-hidden="true">
          <InteractiveCover active={sunsetEnabled} />
        </div>
      )}
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      {headerVisible && (
        <header className={`site-header ${routeMotionClass}`}>
          <div className="header-inner">
            <Link className="wordmark" href="/" aria-label="Root Yoonsl 홈">
              <span className="wordmark-mark" aria-hidden="true" />
              <span className="wordmark-copy">
                <span>Root</span>
                <span>Yoonsl</span>
              </span>
            </Link>

            <button
              type="button"
              className={`mobile-nav-backdrop ${
                mobileOpen ? "is-open" : ""
              }`}
              onClick={() => setMobileOpen(false)}
              aria-label="사이드바 메뉴 닫기"
              tabIndex={mobileOpen ? 0 : -1}
            />

            <nav
              id="primary-navigation"
              className={`primary-nav ${mobileOpen ? "is-open" : ""}`}
              aria-label="주요 메뉴"
            >
              {navigation.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  className={pathname.startsWith(item.href) ? "active" : undefined}
                  aria-current={
                    pathname.startsWith(item.href) ? "page" : undefined
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <span
                className="primary-nav-indicator"
                data-active-index={activeNavigationIndex}
                aria-hidden="true"
              />
              <a
                className="mobile-github"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMobileOpen(false)}
              >
                GitHub
              </a>
            </nav>

            <div className="header-actions">
              <button
                type="button"
                className="header-action"
                onClick={() => {
                  setMobileOpen(false);
                  setSearchOpen(true);
                }}
                aria-label="검색 열기"
                title="검색 (⌘/Ctrl + K)"
              >
                <Search size={17} />
              </button>
              <button
                type="button"
                className="header-action appearance-toggle sunset-toggle"
                onClick={toggleSunset}
                aria-label={`노을 모드 ${sunsetEnabled ? "켜짐" : "꺼짐"}`}
                aria-pressed={sunsetEnabled}
                title={sunsetEnabled ? "노을 모드 끄기" : "노을 모드 켜기"}
              >
                <Sunset size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="header-action appearance-toggle color-toggle"
                onClick={toggleColorMode}
                aria-label={`${darkEnabled ? "다크" : "라이트"} 모드`}
                aria-pressed={darkEnabled}
                title={darkEnabled ? "라이트 모드로 전환" : "다크 모드로 전환"}
              >
                {darkEnabled ? (
                  <Moon size={16} aria-hidden="true" />
                ) : (
                  <Sun size={16} aria-hidden="true" />
                )}
              </button>
              <a
                className="header-action desktop-github"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub 열기"
                title="GitHub"
              >
                <GitHubMark />
              </a>
              <button
                type="button"
                className="header-action mobile-menu-button"
                onClick={() => setMobileOpen((value) => !value)}
                aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
                aria-expanded={mobileOpen}
                aria-controls="primary-navigation"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </header>
      )}

      <main
        id="main-content"
        key={pathname}
        className={`route-main ${
          isHome ? "route-main-home" : "route-main-space"
        } ${routeMotionClass}`}
      >
        {children}
      </main>
      {isHome && (
        <a
          className="home-github-link"
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub 열기"
          title="GitHub"
        >
          <GitHubMark />
        </a>
      )}
      {searchOpen && (
        <Suspense fallback={null}>
          <SearchDialog onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
