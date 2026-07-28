import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
import { musics, posts } from "../app/content.generated.ts";
import { extractMarkdownHeadings } from "../app/markdown-headings.ts";
import { MUSIC_LYRICS } from "../app/music-lyrics.ts";
import {
  resolveDeploymentId,
  STATIC_RSC_DIRECTORY,
} from "../build/deployment-id.js";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  let requestUrl = new URL(path, "http://localhost");

  for (let redirectCount = 0; redirectCount < 3; redirectCount += 1) {
    const response = await worker.fetch(
      new Request(requestUrl, {
        headers: { accept: "text/html" },
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );

    if (![301, 302, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }
    requestUrl = new URL(location, requestUrl);
  }

  throw new Error(`Too many redirects while rendering ${path}`);
}

test("server-renders the finished personal blog", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Root/);
  assert.match(html, /Yoonsl/);
  assert.match(html, /home-interactive-cover/);
  assert.match(html, /글 공간/);
  assert.match(html, /책 공간/);
  assert.match(html, /음악 공간/);
  assert.match(html, /사진 공간/);
  assert.doesNotMatch(html, /IT 공간/);
  assert.doesNotMatch(
    html,
    /오래 바라본 것들을|최근의 기록|둘러보기|Seoul/i,
  );
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders each collection", async () => {
  for (const path of ["/writing", "/books", "/music", "/photos"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
  }
});

test("the GitHub Pages client keeps static RSC navigation", async () => {
  const deploymentId = resolveDeploymentId();
  const versionedRscPrefix = `/${STATIC_RSC_DIRECTORY}/${deploymentId}`;
  const assetsDirectory = fileURLToPath(
    new URL("../dist/client/assets/", import.meta.url),
  );
  const clientScripts = (
    await Promise.all(
      (await readdir(assetsDirectory))
        .filter((filename) => filename.endsWith(".js"))
        .map((filename) =>
          readFile(new URL(`../dist/client/assets/${filename}`, import.meta.url), "utf8"),
        ),
    )
  ).join("\n");

  assert.match(clientScripts, /application\/octet-stream/u);
  assert.ok(
    clientScripts.includes(versionedRscPrefix),
    `client bundle does not use ${versionedRscPrefix}`,
  );

  for (const payload of [
    "index.rsc",
    "writing.rsc",
    "books.rsc",
    "music.rsc",
    "photos.rsc",
  ]) {
    const contents = await readFile(
      new URL(`../dist/client/${payload}`, import.meta.url),
    );
    assert.ok(contents.byteLength > 0, payload);

    const versionedContents = await readFile(
      new URL(
        `../dist/client/${STATIC_RSC_DIRECTORY}/${deploymentId}/${payload}`,
        import.meta.url,
      ),
    );
    assert.deepEqual(
      versionedContents,
      contents,
      `${payload} differs from its deployment-specific copy`,
    );
  }
});

test("the GitHub Pages artifact contains every generated bundle asset", async () => {
  const clientRoot = new URL("../dist/client/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL(".vite/manifest.json", clientRoot), "utf8"),
  );
  const generatedAssets = new Set([
    "favicon.png",
    "images/background.png",
  ]);

  for (const [entryName, entry] of Object.entries(manifest)) {
    assert.equal(typeof entry.file, "string", `${entryName} has no output file`);
    generatedAssets.add(entry.file);

    for (const asset of [...(entry.css ?? []), ...(entry.assets ?? [])]) {
      generatedAssets.add(asset);
    }

    for (const importedEntry of [
      ...(entry.imports ?? []),
      ...(entry.dynamicImports ?? []),
    ]) {
      assert.ok(
        Object.hasOwn(manifest, importedEntry),
        `${entryName} references missing manifest entry ${importedEntry}`,
      );
    }
  }

  await Promise.all(
    [...generatedAssets].map(async (asset) => {
      const contents = await readFile(new URL(asset, clientRoot));
      assert.ok(contents.byteLength > 0, `${asset} is empty`);
    }),
  );
});

test("music source supports plain artist headings and the complete update", () => {
  assert.equal(musics.length, 80);
  assert.equal(Object.keys(MUSIC_LYRICS).length, musics.length);
  assert.equal(
    Object.values(MUSIC_LYRICS).filter((lyrics) => lyrics !== "-").length,
    79,
  );
  assert.match(MUSIC_LYRICS.dQXcbK92ENE, /Lately 날으는 성을 본 적이 있니/u);
  assert.match(MUSIC_LYRICS.lMtnkxdY2kY, /This cold, steel spine/u);
  assert.match(MUSIC_LYRICS.KkbzSzAUBKU, /사라질까 겁이 나지만/u);
  assert.match(
    MUSIC_LYRICS.MkrAZi7GMpI,
    /아픔을 잊고서 내뱉은 그 서투른 말/u,
  );
  assert.match(
    MUSIC_LYRICS.iJYYqKi5J6c,
    /꿈을 꾸고 있나 봐[\s\S]*If you, if you are there beside me/u,
  );
  assert.equal(MUSIC_LYRICS["6S7bIDeWbdw"], "-");
  for (const track of musics) {
    const parsedUrl = new URL(track.url);
    const youtubeId =
      parsedUrl.hostname === "youtu.be"
        ? parsedUrl.pathname.slice(1)
        : parsedUrl.searchParams.get("v");

    assert.ok(youtubeId, track.title);
    assert.equal(
      typeof MUSIC_LYRICS[youtubeId],
      "string",
      `${track.artist} - ${track.title}`,
    );
  }
  assert.ok(
    musics.some(
      (track) =>
        track.artist === "김세정" &&
        track.title === "항해" &&
        track.url.includes("YicdhLdRcmo"),
    ),
  );
  assert.ok(
    musics.some(
      (track) =>
        track.artist === "KAMIKITA KEN" &&
        track.title === "DIARY" &&
        track.url.includes("MkrAZi7GMpI"),
    ),
  );
  assert.ok(
    musics.some(
      (track) => track.artist === "이승윤" && track.title === "역성",
    ),
  );
});

test("the updated AI reflection keeps its clean title and new ending", () => {
  const post = posts.find((item) => item.title === "AI 시대의 고찰");

  assert.ok(post);
  assert.match(
    post.body,
    /이 순간을 ‘나의 기억’으로 남길 수 있는 건 결국 나 자신뿐이다\./u,
  );
  assert.doesNotMatch(post.title, /\*\*/u);
});

test("flat posts use Data and Time metadata and copy shared post images", async () => {
  const blogPost = posts.find((post) => post.title === "블로그 생성일지");
  const childrenPost = posts.find(
    (post) => post.title === "AI와 함께 살아갈 아이들",
  );
  const retrospectivePost = posts.find(
    (post) => post.title === "2학년 1학기 (2021) - 회고록 및 강의 후기",
  );
  assert.ok(blogPost);
  assert.ok(childrenPost);
  assert.ok(retrospectivePost);
  assert.equal(posts[0], blogPost);
  assert.equal(posts.at(-1), retrospectivePost);
  assert.equal(blogPost.slug, "260727");
  assert.equal(blogPost.date, "2026-07-27");
  assert.equal(childrenPost.date, "2026-02-06");
  assert.equal(retrospectivePost.slug, "220113");
  assert.equal(retrospectivePost.date, "2022-01-13");
  assert.match(retrospectivePost.body, /### C프로그래밍 \(1학년 지교\)/u);
  assert.match(retrospectivePost.body, /### 전공기초프로젝트1 \(2학년 전선\)/u);
  assert.match(
    decodeURIComponent(blogPost.body),
    /\/post-images\/260727\/[^)\s]*노을배경\.png/u,
  );
  assert.match(
    blogPost.body,
    /\/post-images\/260727\/IMG_4797\.JPG/u,
  );
  assert.doesNotMatch(blogPost.body, /^(?:Data|Time):/gmu);

  const html = await (
    await render(`/writing/${encodeURIComponent(blogPost.slug)}`)
  ).text();
  assert.match(html, /블로그 생성일지/u);
  assert.match(html, /IMG_4797\.JPG/u);
  assert.match(html, /%EB%85%B8%EC%9D%84%EB%B0%B0%EA%B2%BD\.png/u);

  const retrospectiveHtml = await (
    await render(`/writing/${retrospectivePost.slug}`)
  ).text();
  assert.match(
    retrospectiveHtml,
    /2학년 1학기 \(2021\) - 회고록 및 강의 후기/u,
  );
  assert.match(retrospectiveHtml, /C프로그래밍 \(1학년 지교\)/u);
  assert.match(retrospectiveHtml, /전공기초프로젝트1 \(2학년 전선\)/u);
});

test("collection views keep only the compact controls and metadata", async () => {
  const writingHtml = await (await render("/writing")).text();
  assert.match(writingHtml, /글 공간/);
  assert.match(writingHtml, /space-header/);
  assert.doesNotMatch(writingHtml, /writing-table-head/);
  assert.match(writingHtml, /compact-writing-summary/);
  assert.match(writingHtml, /compact-writing-thumbnail/);
  assert.match(writingHtml, /compact-writing-thumbnail-placeholder/);
  assert.doesNotMatch(writingHtml, /compact-writing-placeholder-number/);
  assert.doesNotMatch(writingHtml, /--writing-row-image/u);
  assert.doesNotMatch(writingHtml, /\/images\/thumbnail\.jpg/);
  assert.match(writingHtml, /writing-pagination/);
  assert.match(writingHtml, /aria-current="page"[^>]*>1<\/button>/);
  assert.match(writingHtml, /writing-page-size-select/);
  assert.match(writingHtml, /5개씩 보기/);
  assert.match(writingHtml, /10개씩 보기/);
  assert.match(writingHtml, /20개씩 보기/);
  assert.doesNotMatch(writingHtml, /분 읽기/);
  const writingNumbers = Array.from(
    writingHtml.matchAll(
      /class="compact-writing-number"[^>]*>(\d+)<\/span>/gu,
    ),
    (match) => Number(match[1]),
  );
  assert.deepEqual(
    writingNumbers,
    Array.from(
      { length: Math.min(posts.length, 5) },
      (_, index) => posts.length - index,
    ),
    "글 번호는 현재 글 수부터 내림차순이어야 합니다.",
  );

  const booksHtml = await (await render("/books")).text();
  assert.match(booksHtml, /책 공간/);
  assert.match(booksHtml, /space-header/);
  assert.match(booksHtml, /data-columns="4"/);
  assert.match(booksHtml, /book-library-card/);
  assert.match(booksHtml, /class="filter-menu-trigger"/u);
  assert.match(booksHtml, /aria-label="저자 필터: 전체"/u);
  assert.match(booksHtml, /전체 책 \d+권/);
  assert.match(booksHtml, /해변의 카프카 1/);
  assert.match(booksHtml, /도시와 그 불확실한 벽/);
  assert.match(booksHtml, /세계의 끝과 하드보일드 원더랜드 1/);
  assert.match(booksHtml, /용의자 X의 헌신/);
  assert.match(booksHtml, /지구 끝의 온실/);
  assert.match(booksHtml, /두 번째 지능/);
  assert.match(booksHtml, /지적 대화를 위한 넓고 얕은 지식 1/);
  assert.match(booksHtml, /미드나잇 라이브러리/);
  assert.match(booksHtml, /재지마인드\(여름방학 에디션\)/);
  assert.match(booksHtml, /뇌 과학의 모든 역사/);
  assert.match(booksHtml, /키키·프랭키/);
  assert.match(booksHtml, /매튜 콥/);
  assert.match(booksHtml, /goods\/126795598\/XL/);
  assert.match(booksHtml, /goods\/103950272\/XL/);
  assert.match(booksHtml, /goods\/45353675\/XL/);
  assert.match(booksHtml, /goods\/174200856\/XL/);
  assert.doesNotMatch(booksHtml, /교보문고<\/span>/);
  assert.doesNotMatch(booksHtml, /book-library-cover[^>]+yoonsl\.jpg/);
  assert.doesNotMatch(booksHtml, /책등, 휠 또는 방향키로 이동/);

  const musicHtml = await (await render("/music")).text();
  assert.match(musicHtml, /음악 공간/);
  assert.match(musicHtml, /space-header/);
  assert.match(musicHtml, /space-count/);
  assert.match(musicHtml, /class="filter-menu-trigger"/u);
  assert.match(musicHtml, /aria-label="아티스트 필터: 전체"/u);
  assert.match(musicHtml, /playlist-cd-player/);
  assert.match(musicHtml, /playlist-cd-disc/);
  assert.match(musicHtml, /playlist-cd-stage-empty/);
  assert.doesNotMatch(musicHtml, /playlist-cd-anchor/);
  assert.match(musicHtml, /playlist-lyrics/);
  assert.match(musicHtml, /음악을 골라주세요/u);
  assert.doesNotMatch(musicHtml, /class="playlist-lyrics-title"/u);
  assert.match(musicHtml, /data-empty="true"/u);
  assert.match(musicHtml, /class="playlist-lyrics"[^>]*role="region"[^>]*tabindex="0"/u);
  assert.doesNotMatch(musicHtml, /Lately 날으는 성을 본 적이 있니/u);
  assert.doesNotMatch(musicHtml, /playlist-cd-link/);
  assert.doesNotMatch(musicHtml, /playlist-cd-index/);
  assert.doesNotMatch(musicHtml, />TRACK \d+</);
  assert.doesNotMatch(musicHtml, />듣기<\/span>/);
  assert.match(musicHtml, /전체 음악 \d+곡/);
  assert.match(musicHtml, /하현상/);
  assert.match(musicHtml, /Nell/);
  assert.match(musicHtml, /<th scope="col">YouTube<\/th>/u);
  assert.doesNotMatch(musicHtml, /YouTube 썸네일/u);
  assert.match(musicHtml, /class="playlist-browser-track-number"/u);
  assert.match(musicHtml, /class="playlist-browser-artist"/u);
  assert.equal(
    musicHtml.match(/class="playlist-browser-row(?: playlist-browser-row-active)?"/gu)
      ?.length,
    10,
  );
  assert.deepEqual(
    Array.from(
      musicHtml.matchAll(
        /<td aria-label="(\d+)번"><span class="playlist-browser-track-number"[^>]*>(\d{2})<\/span><\/td>/gu,
      ),
      (match) => Number(match[2]),
    ),
    Array.from({ length: 10 }, (_, index) => index + 1),
  );
  assert.equal(
    musicHtml.match(/class="playlist-browser-thumbnail-link"/gu)?.length,
    10,
  );
  assert.equal(
    musicHtml.match(
      /class="playlist-page-button playlist-page-number"/gu,
    )?.length,
    Math.min(5, Math.ceil(musics.length / 10)),
  );
  assert.doesNotMatch(musicHtml, /playlist-page-jump/u);
  assert.match(
    musicHtml,
    /class="playlist-page-button playlist-page-number"[^>]*aria-current="page"[^>]*>1<\/button>/u,
  );
  assert.doesNotMatch(musicHtml, /곡을 누르거나 방향키·휠로 골라보세요/);

  const photosHtml = await (await render("/photos")).text();
  assert.match(photosHtml, /사진 공간/);
  assert.match(photosHtml, /space-header/);
  assert.match(photosHtml, /aria-label="사진 \d+장"/);
  assert.match(photosHtml, /photo-gallery-grid/);
  assert.match(photosHtml, /photo-gallery-card/);
  assert.doesNotMatch(photosHtml, /content\/gallery/);
  const newestPhotoIndex = photosHtml.indexOf(
    "/gallery/dscf8838-thumb.webp",
  );
  const newPhotoIndex = photosHtml.indexOf(
    "/gallery/dscf7976-thumb.webp",
  );
  const oldestPhotoIndex = photosHtml.indexOf(
    "/gallery/img-7896-thumb.webp",
  );
  assert.notEqual(newestPhotoIndex, -1);
  assert.notEqual(newPhotoIndex, -1);
  assert.notEqual(oldestPhotoIndex, -1);
  assert.ok(
    newestPhotoIndex < newPhotoIndex && newPhotoIndex < oldestPhotoIndex,
    "사진은 EXIF 촬영일 최신순으로 표시되어야 합니다.",
  );
});

test("book and music filters share a polished scalable menu", async () => {
  const [filterMenu, bookShelf, playlist, css] = await Promise.all([
    readFile(
      fileURLToPath(
        new URL("../app/components/FilterMenu.tsx", import.meta.url),
      ),
      "utf8",
    ),
    readFile(
      fileURLToPath(
        new URL("../app/components/BookShelf.tsx", import.meta.url),
      ),
      "utf8",
    ),
    readFile(
      fileURLToPath(
        new URL("../app/components/Playlist.tsx", import.meta.url),
      ),
      "utf8",
    ),
    readFile(
      fileURLToPath(new URL("../app/globals.css", import.meta.url)),
      "utf8",
    ),
  ]);

  assert.match(bookShelf, /<FilterMenu[\s\S]*?label="저자"/u);
  assert.match(playlist, /<FilterMenu[\s\S]*?label="아티스트"/u);
  assert.match(filterMenu, /aria-haspopup="listbox"/u);
  assert.match(filterMenu, /role="listbox"/u);
  assert.match(filterMenu, /role="option"/u);
  assert.match(filterMenu, /option\.count/u);
  assert.doesNotMatch(filterMenu, /filter-menu-option-mark/u);
  assert.doesNotMatch(css, /\.filter-menu-option-mark/u);
  assert.match(
    css,
    /\.filter-menu-option\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto;[^}]*gap:\s*10px;[^}]*font-size:\s*14px/u,
  );
  assert.match(filterMenu, /event\.key === "ArrowDown"/u);
  assert.match(filterMenu, /event\.key === "Escape"/u);
  assert.match(
    css,
    /:root\s*\{[^}]*--filter-menu-background:\s*#ffffff;/u,
  );
  assert.match(
    css,
    /html\.dark\s*\{[^}]*--filter-menu-background:\s*#1a1a1a;/u,
  );
  assert.match(
    css,
    /html\.sunset\s*\{[^}]*--filter-menu-background:\s*#fff9f6;/u,
  );
  assert.match(
    css,
    /html\.sunset\.dark\s*\{[^}]*--filter-menu-background:\s*#110d15;/u,
  );
  assert.match(
    css,
    /\.filter-menu-popover\s*\{[^}]*width:\s*min\(400px,\s*calc\(100vw - 32px\)\);[^}]*padding:\s*13px;[^}]*border-radius:\s*17px;[^}]*background:\s*var\(--filter-menu-background\);[^}]*backdrop-filter:\s*none;[^}]*-webkit-backdrop-filter:\s*none/u,
  );
  assert.match(
    css,
    /\.filter-menu-options\s*\{[^}]*max-height:\s*min\(380px,\s*56svh\);[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u,
  );
  assert.match(
    css,
    /\.filter-menu-trigger\s*\{[^}]*height:\s*36px;[^}]*background:\s*var\(--filter-menu-background\);[^}]*font-size:\s*14px/u,
  );
  assert.match(
    css,
    /\.filter-menu-option\s*\{[^}]*min-height:\s*42px;/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.space-filter\s*\{[^}]*width:\s*min\(220px,\s*58vw\);[^}]*\}[\s\S]*?\.filter-menu-popover\s*\{[^}]*width:\s*min\(368px,\s*calc\(100vw - 24px\)\)/u,
  );
  assert.match(
    css,
    /@media \(max-width: 430px\)[\s\S]*?\.filter-menu-options\s*\{[\s\S]*?grid-template-columns:\s*1fr/u,
  );
});

test("server-renders a statically addressable post with its original body", async () => {
  const post = posts[0];
  assert.ok(post);
  const response = await render(
    `/writing/${encodeURIComponent(post.slug)}`,
  );
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.ok(html.includes(post.title));
  assert.ok(html.includes(post.displayDate));
  assert.match(html, /article-bottom-nav/);
  assert.match(html, /이전 글/);
  assert.match(html, /다음 글/);
  assert.match(html, /글 목록/);
  assert.match(html, /article-nav-title/);
  if (posts[1]) {
    assert.ok(html.includes(posts[1].title));
  }
  const headings = extractMarkdownHeadings(post.body);
  if (headings.length === 0) {
    assert.doesNotMatch(html, /article-toc/);
  } else {
    assert.match(html, /article-toc/);
  }
  assert.doesNotMatch(html, /Table of Contents/);
  assert.doesNotMatch(html, />본문<\/a>/);
  assert.match(html, /id="article-body"/);
});

test("table of contents follows real markdown headings and ignores code fences", () => {
  const headings = extractMarkdownHeadings(`본문

## 첫 번째 *제목*

\`\`\`md
# 코드 안 제목
\`\`\`

두 번째 제목
------------
`);

  assert.deepEqual(headings, [
    {
      id: "article-section-3",
      level: 2,
      text: "첫 번째 제목",
    },
    {
      id: "article-section-9",
      level: 2,
      text: "두 번째 제목",
    },
  ]);
});

test("articles use the restored serif stack on a quiet paper surface", async () => {
  const [
    css,
    markdownComponent,
    tocComponent,
    headingUtility,
    katexCss,
  ] =
    await Promise.all([
      readFile(
        fileURLToPath(new URL("../app/globals.css", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("../app/components/MarkdownBody.tsx", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL(
            "../app/components/ArticleTableOfContents.tsx",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("../app/markdown-headings.ts", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("../app/katex.generated.css", import.meta.url),
        ),
        "utf8",
      ),
    ]);

  assert.match(
    css,
    /\.simple-article\s*\{[\s\S]*?width:\s*min\([\s\S]*?clamp\(750px,\s*37\.6vw,\s*780px\),[\s\S]*?calc\(100% - 40px\)/u,
  );
  assert.match(
    css,
    /--serif:\s*"Iowan Old Style",\s*"Noto Serif KR",\s*"Nanum Myeongjo"/u,
  );
  assert.match(
    css,
    /--sans:\s*"Iowan Old Style",\s*"Noto Serif KR",\s*"Nanum Myeongjo"/u,
  );
  assert.doesNotMatch(
    css,
    /Sandoll GothicNeo1|SandollGothicNeo1Unicode|Apple SD Gothic Neo|Noto Sans KR/u,
  );
  assert.match(css, /--article-serif:\s*var\(--serif\)/u);
  assert.doesNotMatch(css, /Yoonsl Maru Buri/u);
  assert.match(
    css,
    /\.markdown-body\s*\{[\s\S]*?padding:[\s\S]*?clamp\(26px,\s*1\.5vw,\s*31px\)[\s\S]*?clamp\(28px,\s*1\.62vw,\s*34px\)[\s\S]*?clamp\(32px,\s*1\.85vw,\s*38px\);[\s\S]*?border:\s*0;[\s\S]*?background-color:\s*var\(--article-paper\);[\s\S]*?radial-gradient\([\s\S]*?font-family:\s*var\(--article-serif\);[\s\S]*?font-size:\s*clamp\(15px,\s*0\.868vw,\s*18px\);[\s\S]*?letter-spacing:\s*-0\.01em/u,
  );
  assert.match(
    css,
    /--article-paper:\s*#f6f2e7;[\s\S]*?html\.dark\s*\{[\s\S]*?--article-paper:\s*#25221d;[\s\S]*?--article-paper-highlight:[\s\S]*?--article-paper-shade:/u,
  );
  assert.match(
    css,
    /\.markdown-paragraph\s*\{[\s\S]*?margin:\s*0 0 1\.75em;[\s\S]*?text-align:\s*justify;[\s\S]*?text-align-last:\s*left;[\s\S]*?text-justify:\s*inter-character/u,
  );
  assert.match(
    css,
    /\.markdown-image-trigger\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?margin:\s*24px auto/u,
  );
  assert.match(
    css,
    /\.markdown-image\s*\{[\s\S]*?width:\s*auto;[\s\S]*?max-width:\s*100%;[\s\S]*?height:\s*auto;[\s\S]*?margin:\s*0/u,
  );
  assert.match(
    markdownComponent,
    /remarkPlugins=\{\[remarkGfm,\s*remarkMath\]\}/u,
  );
  assert.match(
    markdownComponent,
    /rehypePlugins=\{\[\[rehypeKatex,\s*\{\s*strict:\s*false\s*\}\]\]\}/u,
  );
  assert.match(katexCss, /url\(\/fonts\/KaTeX_Main-Regular\.woff2\)/u);
  assert.match(
    css,
    /\.markdown-body \.katex-display\s*\{[\s\S]*?overflow-x:\s*auto/u,
  );
  assert.match(
    css,
    /\.markdown-body \.katex \.msupsub \.sizing\s*\{[\s\S]*?font-size:\s*0\.6em/u,
  );
  assert.match(markdownComponent, /id=\{headingAnchor\(node\)\}/u);
  assert.match(tocComponent, /requestAnimationFrame/u);
  assert.match(tocComponent, /getBoundingClientRect\(\)\.top <= 106/u);
  assert.match(tocComponent, /aria-current=/u);
  assert.match(tocComponent, /event\.preventDefault\(\)/u);
  assert.match(
    tocComponent,
    /window\.history\.pushState\(window\.history\.state,\s*"",\s*nextHash\)/u,
  );
  assert.match(
    tocComponent,
    /target\.scrollIntoView\(\{[\s\S]*?prefers-reduced-motion:\s*reduce[\s\S]*?block:\s*"start"/u,
  );
  assert.match(
    tocComponent,
    /const COMPACT_TOC_QUERY = "\(max-width: 1200px\)"/u,
  );
  assert.match(tocComponent, /useSyncExternalStore/u);
  assert.match(
    tocComponent,
    /if \(isCompactLayout \|\| headings\.length === 0\) return/u,
  );
  assert.match(
    tocComponent,
    /if \(headings\.length === 0 \|\| isCompactLayout\) return null/u,
  );
  assert.doesNotMatch(tocComponent, /Table of Contents/u);
  assert.doesNotMatch(tocComponent, />\s*본문\s*</u);
  assert.match(headingUtility, /activeFence/u);
  assert.match(headingUtility, /setextUnderline/u);

  for (const className of [
    "markdown-heading--1",
    "markdown-heading--2",
    "markdown-heading--3",
    "markdown-heading--4",
    "markdown-heading--5",
    "markdown-heading--6",
    "markdown-blockquote",
    "markdown-list--unordered",
    "markdown-list--ordered",
    "markdown-deleted",
    "markdown-preformatted",
    "markdown-code",
    "markdown-table",
    "markdown-task-checkbox",
  ]) {
    assert.match(markdownComponent, new RegExp(`"${className}"`, "u"));
  }

  assert.match(css, /\.markdown-list--unordered\s*\{[\s\S]*?list-style-type:\s*disc/u);
  assert.match(css, /\.markdown-list--ordered\s*\{[\s\S]*?list-style-type:\s*decimal/u);
  assert.match(
    css,
    /\.markdown-heading\s*\{[^}]*margin:\s*2\.65em 0 1\.05em;[^}]*line-height:\s*1\.55;[^}]*scroll-margin-top:\s*calc\(var\(--site-header-height\) \+ 20px\)/u,
  );
  assert.match(css, /\.markdown-heading--6\s*\{[\s\S]*?font-size:\s*0\.92em/u);
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.markdown-heading\s*\{[^}]*margin-top:\s*2\.45em;[^}]*margin-bottom:\s*0\.95em;[^}]*line-height:\s*1\.5/u,
  );
  assert.match(css, /\.markdown-task-checkbox\s*\{[\s\S]*?accent-color:\s*var\(--accent-strong\)/u);
  assert.match(
    css,
    /\.markdown-preformatted \.markdown-code\s*\{[\s\S]*?font-size:\s*inherit/u,
  );
  assert.match(css, /\.markdown-table\s*\{[\s\S]*?font-size:\s*0\.95em/u);
  assert.match(
    css,
    /\.article-toc\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*calc\(var\(--site-header-height\) \+ 30px\);[\s\S]*?left:\s*calc\(50% \+ clamp\(401px,\s*20\.3vw,\s*416px\)\)/u,
  );
  assert.match(
    css,
    /\.article-toc-item a\[aria-current="location"\]\s*\{[\s\S]*?color:\s*var\(--accent-strong\);[\s\S]*?font-weight:\s*650/u,
  );
  assert.match(
    css,
    /html\.sunset:not\(\.dark\) \.article-toc\s*\{[\s\S]*?border-left-color:\s*rgba\(104,\s*58,\s*57,\s*0\.42\);[\s\S]*?color:\s*#5f4144/u,
  );
  assert.match(
    css,
    /html\.sunset:not\(\.dark\) \.article-toc-item a\s*\{[\s\S]*?color:\s*#65494b/u,
  );
  assert.match(
    css,
    /html\.sunset:not\(\.dark\)[\s\S]*?\.article-toc-item[\s\S]*?a\[aria-current="location"\]\s*\{[\s\S]*?color:\s*#8b3f36/u,
  );
  assert.match(
    css,
    /@media \(max-width: 1200px\)\s*\{[\s\S]*?\.article-toc\s*\{[^}]*display:\s*none;[^}]*\}/u,
  );
});

test("gallery thumbnails keep both portrait and landscape photos uncropped", async () => {
  for (const name of [
    "dscf8838",
    "dscf7976",
    "dscf6673",
    "img-9738",
    "img-7896",
  ]) {
    const fullPath = fileURLToPath(
      new URL(`../public/gallery/${name}.webp`, import.meta.url),
    );
    const thumbnailPath = fileURLToPath(
      new URL(`../public/gallery/${name}-thumb.webp`, import.meta.url),
    );
    const [full, thumbnail] = await Promise.all([
      sharp(fullPath).metadata(),
      sharp(thumbnailPath).metadata(),
    ]);
    const fullRatio = full.width / full.height;
    const thumbnailRatio = thumbnail.width / thumbnail.height;

    assert.ok(
      Math.abs(fullRatio - thumbnailRatio) < 0.002,
      `${name} 썸네일은 원본 비율을 유지해야 합니다.`,
    );
  }
});

test("home is one fixed, non-scrolling pixel scene", async () => {
  const [response, css, homeScene] = await Promise.all([
    render("/"),
    readFile(
      fileURLToPath(new URL("../app/globals.css", import.meta.url)),
      "utf8",
    ),
    readFile(
      fileURLToPath(
        new URL("../app/components/HomeScrollScene.tsx", import.meta.url),
      ),
      "utf8",
    ),
  ]);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.doesNotMatch(html, /home-search-trigger/u);
  assert.match(html, /class="home-github-link"/u);
  assert.match(html, /href="https:\/\/github\.com\/rootyoonsl"/u);
  assert.match(
    css,
    /\.home-scroll-scene\s*\{[\s\S]*?height:\s*100svh;[\s\S]*?\.home-minimal\s*\{[\s\S]*?height:\s*100svh;[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*center;[\s\S]*?gap:\s*36px/u,
  );
  assert.match(
    css,
    /\.home-logo\s*\{[\s\S]*?position:\s*relative/u,
  );
  assert.match(
    css,
    /\.home-navigation\s*\{[\s\S]*?position:\s*relative;[\s\S]*?gap:\s*8px/u,
  );
  assert.match(
    css,
    /\.home-minimal::after\s*\{[\s\S]*?rgba\(20,\s*16,\s*30,\s*0\.24\)[\s\S]*?rgba\(15,\s*13,\s*26,\s*0\.4\)/u,
  );
  assert.match(
    css,
    /\.home-interactive-cover\s*\{[\s\S]*?filter:\s*brightness\(1\);/u,
  );
  assert.doesNotMatch(
    `${css}\n${homeScene}`,
    /home-cover-brightness|ResizeObserver|addEventListener\("scroll"|will-change:\s*filter/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.home-minimal\s*\{[\s\S]*?gap:\s*34px[\s\S]*?\.home-navigation\s*\{[\s\S]*?grid-template-columns:\s*1fr/u,
  );
  assert.match(
    css,
    /\.home-github-link\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?right:\s*24px;[\s\S]*?bottom:\s*24px/u,
  );
  assert.match(
    css,
    /html:has\(\.site-root\.is-home\)\s*\{[\s\S]*?overflow-y:\s*hidden;[\s\S]*?background-color:\s*#211829;[\s\S]*?\}/u,
  );
  assert.doesNotMatch(
    css,
    /(?:html:has\(\.site-root\.is-home\)|\.site-root\.is-home)\s*\{[^}]*background-image:/u,
  );
  assert.doesNotMatch(css, /\.home-search-trigger|\.home-utilities/u);
});

test("space menu links transition immediately with directional motion", async () => {
  const [css, shell, homeScene] = await Promise.all([
    readFile(
      fileURLToPath(new URL("../app/globals.css", import.meta.url)),
      "utf8",
    ),
    readFile(
      fileURLToPath(
        new URL("../app/components/SiteShell.tsx", import.meta.url),
      ),
      "utf8",
    ),
    readFile(
      fileURLToPath(
        new URL("../app/components/HomeScrollScene.tsx", import.meta.url),
      ),
      "utf8",
    ),
  ]);

  assert.match(shell, /<Link className="wordmark" href="\/"/u);
  assert.match(shell, /navigation\.map[\s\S]*?<Link/u);
  assert.match(
    shell,
    /previousPathname === "\/" && pathname !== "\/"[\s\S]*?setRouteMotion\("from-home"\)[\s\S]*?previousPathname !== "\/" && pathname === "\/"[\s\S]*?setRouteMotion\("to-home"\)[\s\S]*?setRouteMotion\("between-spaces"\)/u,
  );
  assert.match(homeScene, /<Link href="\/writing">글 공간<\/Link>/u);
  assert.doesNotMatch(`${shell}\n${homeScene}`, /SmoothRouteLink|router\.push/u);
  assert.match(
    css,
    /\.site-header\.route-from-home\s*\{[\s\S]*?route-header-enter 520ms/u,
  );
  assert.match(
    css,
    /\.site-header\.route-to-home\s*\{[\s\S]*?route-header-leave 520ms/u,
  );
  assert.match(
    css,
    /\.route-main-space\.route-from-home\s*\{[\s\S]*?route-space-light-in 680ms[\s\S]*?@keyframes route-space-light-in\s*\{[\s\S]*?brightness\(0\.56\)[\s\S]*?brightness\(1\)/u,
  );
  assert.match(
    shell,
    /className="primary-nav-indicator"[\s\S]*?data-active-index=\{activeNavigationIndex\}/u,
  );
  assert.match(
    css,
    /\.primary-nav-indicator\s*\{[\s\S]*?transition:[\s\S]*?transform 420ms cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/u,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.site-header\.route-from-home,[\s\S]*?animation:\s*none !important/u,
  );
  assert.match(
    shell,
    /prefers-reduced-motion:\s*reduce[\s\S]*?setRouteMotion\("settled"\)[\s\S]*?setHeaderVisible\(pathname !== "\/"\)/u,
  );
});

test("appearance uses separate sunset and light-dark controls", async () => {
  const [css, shell, layout, cover] = await Promise.all([
    readFile(
      fileURLToPath(new URL("../app/globals.css", import.meta.url)),
      "utf8",
    ),
    readFile(
      fileURLToPath(
        new URL("../app/components/SiteShell.tsx", import.meta.url),
      ),
      "utf8",
    ),
    readFile(
      fileURLToPath(new URL("../app/layout.tsx", import.meta.url)),
      "utf8",
    ),
    readFile(
      fileURLToPath(
        new URL("../app/components/InteractiveCover.tsx", import.meta.url),
      ),
      "utf8",
    ),
  ]);

  assert.match(
    shell,
    /type Theme = "sunset-light" \| "sunset-dark" \| "light" \| "dark"/u,
  );
  assert.match(shell, /useState<Theme>\("sunset-light"\)/u);
  assert.match(shell, /useRef<Theme>\("sunset-light"\)/u);
  assert.match(shell, /const toggleSunset = \(\) =>/u);
  assert.match(shell, /const toggleColorMode = \(\) =>/u);
  assert.match(shell, /const applyTheme = \(selectedTheme: Theme\) =>/u);
  assert.match(shell, /themeRef\.current = selectedTheme/u);
  assert.doesNotMatch(shell, /nextTheme|startViewTransition/u);
  assert.match(shell, /prefers-reduced-motion:\s*reduce/u);
  assert.match(shell, /classList\.add\("theme-transitioning"\)/u);
  assert.match(shell, /void root\.offsetWidth/u);
  assert.match(shell, /classList\.remove\("theme-transitioning"\)/u);
  assert.match(shell, /localStorage\.setItem\("yoonsl-theme-mode"/u);
  assert.match(
    shell,
    /className="header-action appearance-toggle sunset-toggle"/u,
  );
  assert.match(
    shell,
    /className="header-action appearance-toggle color-toggle"/u,
  );
  assert.match(shell, /aria-pressed=\{sunsetEnabled\}/u);
  assert.match(shell, /aria-pressed=\{darkEnabled\}/u);
  assert.match(
    shell,
    /aria-label=\{`노을 모드 \$\{sunsetEnabled \? "켜짐" : "꺼짐"\}`\}/u,
  );
  assert.match(shell, /<Sunset size=\{16\}/u);
  assert.match(shell, /<Sun size=\{16\}/u);
  assert.match(shell, /<Moon size=\{16\}/u);
  assert.match(shell, /!isHome && \([\s\S]*?<InteractiveCover/u);
  assert.match(layout, /localStorage\.getItem\("yoonsl-theme-mode"\)/u);
  assert.match(layout, /localStorage\.setItem\("yoonsl-theme-mode", theme\)/u);
  assert.doesNotMatch(
    `${layout}\n${shell}`,
    /yoonsl-theme-schema|yoonsl-sunset|yoonsl-color-mode|themeSchema/u,
  );
  assert.match(
    layout,
    /classList\.toggle\([\s\S]*?"sunset",[\s\S]*?theme === "sunset-light" \|\| theme === "sunset-dark"[\s\S]*?\)/u,
  );
  assert.match(
    layout,
    /classList\.toggle\([\s\S]*?"dark",[\s\S]*?theme === "sunset-dark" \|\| theme === "dark"[\s\S]*?\)/u,
  );
  assert.match(
    css,
    /html\.sunset\s*\{[\s\S]*?color-scheme:\s*light;[\s\S]*?--background:\s*rgba\(255,\s*250,\s*247,\s*0\.86\);[\s\S]*?--foreground:\s*#3d2d30/u,
  );
  assert.match(
    css,
    /html\.sunset\.dark\s*\{[\s\S]*?color-scheme:\s*dark;[\s\S]*?--background:\s*rgba\(18,\s*14,\s*22,\s*0\.86\);[\s\S]*?--foreground:\s*#fff7f4/u,
  );
  assert.match(
    css,
    /\.sunset-theme-cover\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?pointer-events:\s*none/u,
  );
  assert.doesNotMatch(css, /::view-transition-(?:old|new)/u);
  assert.match(
    css,
    /html\.theme-transitioning body,[\s\S]*?transition-duration:\s*560ms !important/u,
  );
  assert.match(
    css,
    /html\.theme-transitioning\s*\{[\s\S]*?background-color 560ms[\s\S]*?color 560ms/u,
  );
  assert.match(
    css,
    /html:not\(\.sunset\) \.sunset-theme-cover\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?visibility:\s*hidden/u,
  );
  assert.match(
    css,
    /\.sunset-theme-cover::after\s*\{[\s\S]*?background-color:\s*rgba\(255,\s*244,\s*238,\s*0\.5\)[\s\S]*?html\.sunset\.dark \.sunset-theme-cover::after\s*\{[\s\S]*?background-color:\s*rgba\(12,\s*10,\s*18,\s*0\.58\)/u,
  );
  assert.match(
    css,
    /\.appearance-toggle\s*\{[\s\S]*?color:\s*var\(--faint\);[\s\S]*?background-color 250ms ease,[\s\S]*?color 250ms ease/u,
  );
  assert.match(
    css,
    /\.header-action\[aria-pressed="true"\]\s*\{[\s\S]*?color:\s*var\(--accent-strong\);[\s\S]*?background:\s*var\(--accent-soft\)/u,
  );
  assert.doesNotMatch(css, /\.appearance-switch/u);
  assert.match(
    css,
    /html\.theme-transitioning:not\(\.sunset\) \.sunset-theme-cover\s*\{[\s\S]*?transition-delay:[\s\S]*?560ms !important/u,
  );
  assert.match(
    css,
    /html\.sunset \.playlist-browser-table th\s*\{[\s\S]*?background:\s*#fff5f0[\s\S]*?html\.sunset\.dark \.playlist-browser-table th\s*\{[\s\S]*?background:\s*#241b22/u,
  );
  assert.match(
    css,
    /html\.sunset:not\(\.dark\)[\s\S]*?\.site-root:has\(\.playlist-browser\)[\s\S]*?\.sunset-theme-cover::after\s*\{[\s\S]*?background-color:\s*rgba\(255,\s*244,\s*238,\s*0\.44\)/u,
  );
  assert.match(
    css,
    /html\.sunset:not\(\.dark\) \.playlist-browser-table-wrap\s*\{[\s\S]*?background:\s*rgba\(255,\s*250,\s*247,\s*0\.74\)/u,
  );
  assert.match(
    css,
    /\.home-interactive-cover\s*\{[\s\S]*?background:\s*#211829 url\("\/images\/background\.png"\) center \/ cover no-repeat/u,
  );
  assert.match(
    cover,
    /const staticCoverQuery = window\.matchMedia\([\s\S]*?max-width:\s*760px[\s\S]*?pointer:\s*coarse/u,
  );
  assert.match(
    cover,
    /if \(staticCoverQuery\.matches\) \{\s*return;\s*\}/u,
  );
  assert.match(shell, /<InteractiveCover active=\{sunsetEnabled\}/u);
  assert.match(cover, /window\.addEventListener\("pointermove"/u);
  assert.match(cover, /const cloudStart/u);
  assert.match(cover, /const waterStart/u);
});

test("gallery lightbox keeps viewport sizing and a smooth closing phase", async () => {
  const css = await readFile(
    fileURLToPath(new URL("../app/globals.css", import.meta.url)),
    "utf8",
  );
  const component = await readFile(
    fileURLToPath(
      new URL("../app/components/PhotoGallery.tsx", import.meta.url),
    ),
    "utf8",
  );

  assert.match(
    css,
    /\.photo-lightbox-photo-button\[data-orientation="portrait"\][\s\S]*?80dvh/u,
  );
  assert.match(
    css,
    /\.photo-lightbox\s*\{[\s\S]*?--photo-lightbox-y-gap:\s*max\([\s\S]*?inset:\s*var\(--site-header-height\) 0 0;[\s\S]*?padding:[\s\S]*?var\(--photo-lightbox-y-gap\)[\s\S]*?place-items:\s*center/u,
  );
  assert.match(
    css,
    /\.photo-lightbox-photo-button\[data-orientation="landscape"\][\s\S]*?80dvw/u,
  );
  assert.match(
    css,
    /\.photo-lightbox-photo-button\[data-orientation="landscape"\][\s\S]*?max-height:\s*min\([\s\S]*?80dvh,[\s\S]*?100dvh - var\(--site-header-height\) - var\(--photo-lightbox-y-gap\)/u,
  );
  assert.match(css, /\.photo-lightbox-image[\s\S]*?object-fit:\s*contain/u);
  assert.match(css, /\.photo-lightbox-close[\s\S]*?border-radius:\s*50%/u);
  assert.match(
    css,
    /\.photo-gallery-card\s*\{[\s\S]*?transform:\s*scale\(1\);[\s\S]*?transform 420ms cubic-bezier/u,
  );
  assert.match(
    css,
    /\.photo-gallery-card:hover,[\s\S]*?\.photo-gallery-card:focus-visible\s*\{[\s\S]*?transform:\s*scale\(1\.018\)/u,
  );
  assert.match(component, /className="photo-lightbox-close"/u);
  assert.match(
    component,
    /const MOBILE_PHOTO_TRANSITION_MS = 420;[\s\S]*?max-width: 760px[\s\S]*?MOBILE_PHOTO_TRANSITION_MS/u,
  );
  assert.doesNotMatch(
    component,
    /document\.body\.style\.overflow/u,
    "사진 확대 중에도 본문 스크롤바를 유지해야 합니다.",
  );
  assert.ok(
    component.indexOf('setLightboxPhase("closing")') <
      component.indexOf("setActiveIndex(null)"),
    "사진은 닫힘 전환을 시작한 뒤 갤러리로 돌아가야 합니다.",
  );
});

test("article images open in the gallery-style lightbox", async () => {
  const css = await readFile(
    fileURLToPath(new URL("../app/globals.css", import.meta.url)),
    "utf8",
  );
  const markdownBody = await readFile(
    fileURLToPath(
      new URL("../app/components/MarkdownBody.tsx", import.meta.url),
    ),
    "utf8",
  );
  const component = await readFile(
    fileURLToPath(
      new URL("../app/components/MarkdownImage.tsx", import.meta.url),
    ),
    "utf8",
  );

  assert.match(
    markdownBody,
    /import \{ MarkdownImage \} from "@\/app\/components\/MarkdownImage"/u,
  );
  assert.match(markdownBody, /img:[\s\S]*?<MarkdownImage/u);
  assert.match(component, /^"use client";/u);
  assert.match(component, /createPortal\(lightbox, document\.body\)/u);
  assert.match(component, /className="markdown-image-trigger"/u);
  assert.match(component, /aria-haspopup="dialog"/u);
  assert.match(component, /className="photo-lightbox article-image-lightbox"/u);
  assert.match(component, /className="photo-lightbox-photo-button"/u);
  assert.match(component, /className="photo-lightbox-close"/u);
  assert.match(component, /event\.key === "Escape"/u);
  assert.match(component, /event\.key === "Tab"/u);
  assert.match(component, /naturalWidth[\s\S]*?naturalHeight/u);
  assert.match(
    component,
    /const MOBILE_PHOTO_TRANSITION_MS = 420;[\s\S]*?max-width: 760px[\s\S]*?MOBILE_PHOTO_TRANSITION_MS/u,
  );
  assert.doesNotMatch(
    component,
    /document\.body\.style\.overflow/u,
    "게시글 이미지를 확대해도 본문 스크롤바를 유지해야 합니다.",
  );
  assert.ok(
    component.indexOf('setLightboxPhase("closing")') <
      component.indexOf("setActiveImage(null)"),
    "게시글 이미지는 닫힘 전환을 시작한 뒤 본문으로 돌아가야 합니다.",
  );
  assert.match(
    css,
    /\.markdown-image-trigger\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?cursor:\s*zoom-in/u,
  );
  assert.match(
    css,
    /\.markdown-image\s*\{[\s\S]*?max-height:\s*760px;[\s\S]*?object-fit:\s*contain/u,
  );

  const response = await render("/writing/260727");
  assert.equal(response.status, 200);
  const html = await response.text();
  const imageTriggers =
    html.match(
      /<button[^>]*class="markdown-image-trigger"[^>]*aria-haspopup="dialog"[^>]*>/gu,
    ) ?? [];
  assert.equal(imageTriggers.length, 6);
});

test("music selection ignores wheel input and the album art fills the CD", async () => {
  const css = await readFile(
    fileURLToPath(new URL("../app/globals.css", import.meta.url)),
    "utf8",
  );
  const component = await readFile(
    fileURLToPath(
      new URL("../app/components/Playlist.tsx", import.meta.url),
    ),
    "utf8",
  );

  assert.doesNotMatch(component, /onWheel|handleWheel|WheelEvent/u);
  assert.match(component, /const \[selectedId,\s*setSelectedId\] = useState\(""\)/u);
  assert.match(
    component,
    /selectedId && selectedIndex >= 0 \? visibleTracks\[selectedIndex\] : null/u,
  );
  assert.match(
    component,
    /className="playlist-cd-stage playlist-cd-anchor"[\s\S]*?href=\{selectedTrack\.href\}/u,
  );
  assert.ok(
    component.indexOf('className="playlist-cd-stage playlist-cd-anchor"') <
      component.indexOf('className="playlist-lyrics"'),
    "CD는 위, 가사집은 아래 순서로 표시되어야 합니다.",
  );
  assert.doesNotMatch(component, /playlist-cd-(?:copy|title|artist)/u);
  assert.match(
    component,
    /className="playlist-cd-stage playlist-cd-stage-empty"[\s\S]*?className="playlist-cd-disc playlist-cd-disc-empty"[\s\S]*?className="playlist-lyrics"[\s\S]*?!selectedTrack \|\| selectedTrack\.lyrics === "-" \|\| undefined[\s\S]*?className="playlist-lyrics-prompt">음악을 골라주세요<\/p>/u,
  );
  assert.match(
    component,
    /className="playlist-cd-player"[\s\S]*?data-has-selection=\{selectedTrack \? "true" : "false"\}/u,
  );
  assert.match(
    component,
    /selectedTrack \? \([\s\S]*?className="playlist-cd-stage playlist-cd-anchor"[\s\S]*?\) : \([\s\S]*?className="playlist-cd-stage playlist-cd-stage-empty"/u,
  );
  assert.match(
    component,
    /isSelected \|\| \(!pageHasSelectedTrack && index === 0\)[\s\S]*?\? 0[\s\S]*?: -1/u,
  );
  const selectArtistSource = component.slice(
    component.indexOf("const selectArtist"),
    component.indexOf("const selectPage"),
  );
  const selectPageSource = component.slice(
    component.indexOf("const selectPage"),
    component.indexOf("const handleKeyDown"),
  );
  assert.doesNotMatch(selectArtistSource, /setSelectedId/u);
  assert.doesNotMatch(selectPageSource, /setSelectedId/u);
  assert.match(
    component,
    /const pageHasSelectedTrack = pageTracks\.some\([\s\S]*?track\.youtubeId === selectedTrackId/u,
  );
  assert.match(
    component,
    /onPointerDown=\{startLyricsDrag\}[\s\S]*?onPointerMove=\{moveLyricsDrag\}[\s\S]*?onPointerUp=\{stopLyricsDrag\}[\s\S]*?onPointerCancel=\{stopLyricsDrag\}/u,
  );
  assert.match(
    component,
    /startScrollTop:\s*lyrics\.scrollTop[\s\S]*?scrollTop\s*=[\s\S]*?drag\.startScrollTop - \(event\.clientY - drag\.startY\)/u,
  );
  assert.doesNotMatch(component, /className="playlist-cd-link"/u);
  assert.doesNotMatch(component, /className="playlist-cd-index"/u);
  assert.doesNotMatch(component, /<span>듣기<\/span>/u);
  assert.match(component, /const TRACKS_PER_PAGE = 10/u);
  assert.match(component, /const PAGE_GROUP_SIZE = 5/u);
  assert.match(component, /aria-label="이전 5페이지"/u);
  assert.match(component, /aria-label="다음 5페이지"/u);
  assert.doesNotMatch(component, /playlist-page-jump/u);
  assert.match(
    component,
    /visibleTracks\.slice\(pageStart, pageStart \+ TRACKS_PER_PAGE\)/u,
  );
  assert.match(component, /\{pageTracks\.map\(\(track, index\) =>/u);
  assert.match(
    component,
    /const selectTrackFromRow = useCallback\([\s\S]*?target\.closest\("\.playlist-browser-thumbnail-link"\)[\s\S]*?selectTrackAtIndex\(index\)/u,
  );
  assert.match(
    component,
    /<tr[\s\S]*?onClick=\{\(event\) =>[\s\S]*?selectTrackFromRow\(event, trackIndex\)/u,
  );
  assert.match(
    component,
    /const prepareTrackTitlePan = useCallback\([\s\S]*?title\.scrollWidth - button\.clientWidth[\s\S]*?button\.dataset\.overflowing = "true"[\s\S]*?--track-title-shift[\s\S]*?--track-title-duration/u,
  );
  assert.match(
    component,
    /onPointerEnter=\{\(event\) =>[\s\S]*?prepareTrackTitlePan\(event\.currentTarget\)[\s\S]*?className="playlist-browser-track-title-text"/u,
  );
  assert.doesNotMatch(
    component,
    /<a\s+className="playlist-browser-thumbnail-link"[^>]*\bonClick=/u,
  );
  assert.match(
    component,
    /className="playlist-browser-thumbnail-link"[\s\S]*?className="playlist-browser-thumbnail"/u,
  );
  assert.match(
    component,
    /className="playlist-pagination"[\s\S]*?aria-label="플레이리스트 페이지"/u,
  );
  assert.match(
    component,
    /className="playlist-browser-table-scroll"[\s\S]*?style=\{\{ touchAction: "pan-y pinch-zoom" \}\}[\s\S]*?onPointerDown=\{startPageSwipe\}[\s\S]*?onPointerUp=\{finishPageSwipe\}[\s\S]*?onPointerCancel=\{cancelPageSwipe\}[\s\S]*?onClickCapture=\{suppressClickAfterPageSwipe\}/u,
  );
  assert.match(
    component,
    /const PAGE_SWIPE_MIN_DISTANCE = 48;[\s\S]*?horizontalDistance < PAGE_SWIPE_MIN_DISTANCE[\s\S]*?horizontalDistance <= verticalDistance \* PAGE_SWIPE_DIRECTION_RATIO[\s\S]*?const nextPage = currentPage \+ \(deltaX > 0 \? 1 : -1\);[\s\S]*?selectPage\(nextPage\)/u,
  );
  assert.match(
    component,
    /event\.pointerType !== "touch" && event\.pointerType !== "pen"[\s\S]*?window\.matchMedia\("\(max-width: 760px\)"\)\.matches[\s\S]*?suppressSwipeClickUntilRef\.current = window\.performance\.now\(\) \+ 400[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\)/u,
  );
  assert.match(
    css,
    /\.playlist-cd-label\s*\{[\s\S]*?inset:\s*0;[\s\S]*?border-radius:\s*inherit;/u,
  );
  assert.match(css, /\.playlist-cd-label img[\s\S]*?object-fit:\s*cover/u);
  assert.match(
    css,
    /\.playlist-browser-main\s*\{[\s\S]*?grid-template-columns:\s*minmax\(300px,\s*360px\) minmax\(0,\s*1fr\)/u,
  );
  assert.match(
    css,
    /\.playlist-cd-player\s*\{[\s\S]*?padding:\s*18px 18px 0;[\s\S]*?border:\s*0;[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*1;[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\);[\s\S]*?align-content:\s*start;[\s\S]*?background:\s*transparent/u,
  );
  assert.match(
    css,
    /\.playlist-cd-stage\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?place-items:\s*start center/u,
  );
  assert.match(
    css,
    /\.playlist-cd-stage-empty\s*\{[\s\S]*?pointer-events:\s*none/u,
  );
  assert.match(
    css,
    /\.playlist-lyrics\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*6px;[\s\S]*?overflow-y:\s*auto;[\s\S]*?scrollbar-width:\s*none;[\s\S]*?background-color:\s*var\(--article-paper\);[\s\S]*?color:\s*var\(--article-foreground\);[\s\S]*?cursor:\s*grab;[\s\S]*?font-family:\s*var\(--article-serif\);[\s\S]*?font-size:\s*15px;[\s\S]*?line-height:\s*1\.68/u,
  );
  assert.match(
    css,
    /\.playlist-lyrics::-webkit-scrollbar\s*\{[\s\S]*?display:\s*none/u,
  );
  assert.match(
    css,
    /\.playlist-lyrics\[data-dragging="true"\]\s*\{[\s\S]*?cursor:\s*grabbing;[\s\S]*?user-select:\s*none/u,
  );
  assert.match(
    css,
    /\.playlist-lyrics-prompt\s*\{[\s\S]*?color:\s*var\(--muted\);[\s\S]*?font-size:\s*14px/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table-wrap\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table-wrap\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*12px/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table th,[\s\S]*?\.playlist-browser-table td\s*\{[\s\S]*?border:\s*0/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table tbody td\s*\{[\s\S]*?border-bottom:\s*1px solid[\s\S]*?var\(--line\) 62%/u,
  );
  assert.match(
    css,
    /\.playlist-browser-row:last-child td\s*\{[\s\S]*?border-bottom:\s*0/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table th:first-child,[\s\S]*?\.playlist-browser-table td:first-child\s*\{[\s\S]*?width:\s*58px/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table th:nth-child\(3\),[\s\S]*?\.playlist-browser-table td:nth-child\(3\)\s*\{[\s\S]*?width:\s*clamp\(88px,\s*14vw,\s*180px\)/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table th:nth-child\(2\),[\s\S]*?\.playlist-browser-table td:nth-child\(2\)\s*\{[\s\S]*?width:\s*auto/u,
  );
  assert.match(
    css,
    /\.playlist-browser-row-active td\s*\{[\s\S]*?var\(--accent\) 18%[\s\S]*?var\(--surface\)/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table-scroll\s*\{[\s\S]*?overflow:\s*hidden/u,
  );
  assert.match(
    css,
    /\.playlist-browser-row:not\(\.playlist-browser-row-active\):hover td,[\s\S]*?\.playlist-browser-row:not\(\.playlist-browser-row-active\):focus-within td\s*\{[\s\S]*?var\(--surface-hover\) 86%/u,
  );
  assert.match(
    css,
    /\.playlist-browser-row:hover \.playlist-browser-track-number,[\s\S]*?\.playlist-browser-row:focus-within \.playlist-browser-track-number\s*\{[\s\S]*?transform:\s*scale\(1\.22\)/u,
  );
  assert.match(
    css,
    /\.playlist-browser-row:hover \.playlist-browser-track-button,[\s\S]*?\.playlist-browser-row:focus-within \.playlist-browser-artist\s*\{[\s\S]*?transform:\s*scale\(1\.035\)/u,
  );
  assert.match(
    css,
    /\.playlist-browser-track-button,[\s\S]*?\.playlist-browser-artist\s*\{[\s\S]*?font-family:\s*var\(--article-serif\);[\s\S]*?letter-spacing:\s*-0\.012em/u,
  );
  assert.match(
    css,
    /@keyframes playlist-track-title-pan[\s\S]*?translateX\(var\(--track-title-shift\)\)[\s\S]*?\.playlist-browser-track-button\[data-overflowing="true"\]:hover[\s\S]*?var\(--track-title-duration,\s*6s\)[\s\S]*?infinite alternate/u,
  );
  assert.match(
    css,
    /\.playlist-browser-row:not\(\.playlist-browser-row-active\):hover td:first-child,[\s\S]*?\.playlist-browser-row:not\(\.playlist-browser-row-active\):focus-within[\s\S]*?td:first-child\s*\{[\s\S]*?var\(--foreground\) 24%/u,
  );
  assert.doesNotMatch(
    css,
    /\.playlist-browser-row[^{]*\{[^}]*translateX/u,
  );
  assert.match(
    css,
    /\.playlist-browser-row td:not\(:last-child\)\s*\{[\s\S]*?cursor:\s*pointer/u,
  );
  assert.match(
    css,
    /\.playlist-cd-anchor\s*\{[\s\S]*?transition:\s*transform 320ms cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/u,
  );
  assert.match(
    css,
    /\.playlist-cd-anchor:hover,[\s\S]*?\.playlist-cd-anchor:focus-visible\s*\{[\s\S]*?transform:\s*scale\(1\.015\)/u,
  );
  assert.match(
    css,
    /\.playlist-cd-disc\s*\{[\s\S]*?transform:\s*rotate\(0deg\);[\s\S]*?will-change:\s*transform/u,
  );
  assert.match(
    css,
    /\.filter-menu-label\s*\{[\s\S]*?white-space:\s*nowrap/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.playlist-browser\s*\{[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*visible;[\s\S]*?\.playlist-browser-main\s*\{[\s\S]*?grid-template-columns:\s*1fr;[\s\S]*?grid-template-rows:\s*auto auto;[\s\S]*?\.playlist-cd-player\s*\{[\s\S]*?grid-row:\s*2;[\s\S]*?display:\s*none;[\s\S]*?\.playlist-cd-player\[data-has-selection="true"\]\s*\{[\s\S]*?display:\s*block;[\s\S]*?\.playlist-cd-stage\s*\{[\s\S]*?display:\s*none;[\s\S]*?\.playlist-lyrics\s*\{[\s\S]*?height:\s*min\(58svh,\s*520px\);[\s\S]*?min-height:\s*280px/u,
  );
  assert.match(
    component,
    /duration:\s*12000,[\s\S]*?easing:\s*"linear",[\s\S]*?iterations:\s*Infinity/u,
  );
  assert.match(
    component,
    /stopDiscRotation[\s\S]*?transform:\s*"rotate\(0deg\)"[\s\S]*?duration:\s*1400,[\s\S]*?fill:\s*"forwards"/u,
  );
  assert.match(
    component,
    /onPointerEnter=\{startDiscRotation\}[\s\S]*?onPointerLeave=\{stopDiscRotation\}[\s\S]*?onFocus=\{startDiscRotation\}[\s\S]*?onBlur=\{stopDiscRotation\}/u,
  );
  assert.match(
    css,
    /\.playlist-browser-thumbnail-link\s*\{[\s\S]*?width:\s*clamp\(72px,\s*10\.7svh,\s*104px\);[\s\S]*?aspect-ratio:\s*16 \/ 9/u,
  );
  assert.match(
    css,
    /\.playlist-browser\s*\{[\s\S]*?padding:\s*24px 0 36px/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table td\s*\{[^}]*height:\s*calc\(\s*\(100svh - var\(--site-header-height\) - 213px\) \/ 10\s*\)/u,
  );
  assert.match(
    css,
    /@media \(max-height:\s*700px\) and \(min-width:\s*761px\)[\s\S]*?\.playlist-browser-table td\s*\{[^}]*height:\s*calc\(\s*\(100svh - var\(--site-header-height\) - 205px\) \/ 10\s*\)/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table\s*\{[^}]*font-size:\s*clamp\(15px,\s*0\.868vw,\s*18px\)/u,
  );
  assert.doesNotMatch(css, /\.playlist-cd-(?:copy|title|artist)\s*\{/u);
  assert.doesNotMatch(css, /width:\s*calc\(100% - 378px\)/u);
  assert.match(
    css,
    /@media \(max-width: 430px\)[\s\S]*?\.playlist-browser-table th:nth-child\(3\),[\s\S]*?\.playlist-browser-table td:nth-child\(3\)\s*\{[\s\S]*?width:\s*74px/u,
  );
});

test("site numerals use the literary serif and both pagers share five-page groups", async () => {
  const [css, writingList, playlist] = await Promise.all([
    readFile(
      fileURLToPath(new URL("../app/globals.css", import.meta.url)),
      "utf8",
    ),
    readFile(
      fileURLToPath(
        new URL("../app/components/WritingList.tsx", import.meta.url),
      ),
      "utf8",
    ),
    readFile(
      fileURLToPath(
        new URL("../app/components/Playlist.tsx", import.meta.url),
      ),
      "utf8",
    ),
  ]);

  assert.match(
    css,
    /\.space-count\s*\{[\s\S]*?font-family:\s*var\(--article-sans\)[\s\S]*?font-variant-numeric:\s*normal/u,
  );
  assert.doesNotMatch(css, /Yoonsl Numerals/u);
  assert.match(css, /--sans:\s*"Iowan Old Style"/u);
  assert.match(css, /--serif:\s*"Iowan Old Style"/u);
  assert.match(
    css,
    /--logo-font:\s*"JetBrains Mono"[\s\S]*?\.wordmark-copy\s*\{[\s\S]*?font-family:\s*var\(--logo-font\)/u,
  );
  assert.match(
    css,
    /\.compact-writing-number\s*\{[\s\S]*?font-family:\s*var\(--article-serif\);[\s\S]*?font-size:\s*clamp\(15px,\s*0\.868vw,\s*18px\)[\s\S]*?font-variant-numeric:\s*normal/u,
  );
  assert.match(
    css,
    /\.writing-page-button\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*50%;[\s\S]*?font-family:\s*var\(--article-serif\)/u,
  );
  assert.match(
    css,
    /\.playlist-page-button\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*50%;[\s\S]*?font-family:\s*var\(--article-serif\)/u,
  );
  assert.match(
    css,
    /html\.sunset:not\(\.dark\) \.writing-pagination\s*\{[\s\S]*?background:\s*rgba\(255,\s*249,\s*246,\s*0\.78\);[\s\S]*?backdrop-filter:\s*blur\(10px\)/u,
  );
  assert.match(
    css,
    /html\.sunset:not\(\.dark\) \.playlist-pagination\s*\{[\s\S]*?background:\s*rgba\(255,\s*249,\s*246,\s*0\.72\);[\s\S]*?backdrop-filter:\s*blur\(10px\)/u,
  );
  assert.match(
    css,
    /html\.sunset:not\(\.dark\) \.writing-page-button\[aria-current="page"\],[\s\S]*?html\.sunset:not\(\.dark\) \.playlist-page-button\[aria-current="page"\]\s*\{[\s\S]*?background:\s*rgba\(96,\s*67,\s*70,\s*0\.9\);[\s\S]*?color:\s*#fffaf7/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table th:first-child,[\s\S]*?\.playlist-browser-table td:first-child\s*\{[\s\S]*?font-family:\s*var\(--article-serif\);[\s\S]*?font-variant-numeric:\s*normal/u,
  );
  assert.match(writingList, /const PAGE_GROUP_SIZE = 5/u);
  assert.doesNotMatch(writingList, /--writing-row-image/u);
  assert.match(writingList, /aria-label="이전 5페이지"/u);
  assert.match(writingList, /aria-label="다음 5페이지"/u);
  assert.doesNotMatch(writingList, /writing-page-jump/u);
  assert.match(playlist, /const PAGE_GROUP_SIZE = 5/u);
  assert.match(
    css,
    /\.compact-writing-list\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*12px;[\s\S]*?background:\s*var\(--background\)/u,
  );
  assert.match(
    css,
    /\.compact-writing-row\s*\{[\s\S]*?border:\s*0;[\s\S]*?transition:[\s\S]*?background-color 260ms ease,[\s\S]*?transform 320ms/u,
  );
  assert.match(
    css,
    /\.compact-writing-row\s*\{[\s\S]*?border-bottom:\s*1px solid[\s\S]*?var\(--line\) 62%/u,
  );
  assert.match(
    css,
    /\.compact-writing-row:last-child\s*\{[\s\S]*?border-bottom:\s*0/u,
  );
  assert.match(
    css,
    /\.compact-writing-row:hover,[\s\S]*?\.compact-writing-row:focus-visible\s*\{[\s\S]*?var\(--surface-hover\) 86%[\s\S]*?translateX\(4px\)/u,
  );
  assert.match(
    css,
    /\.compact-writing-row:hover \.compact-writing-number,[\s\S]*?\.compact-writing-row:focus-visible \.compact-writing-number\s*\{[\s\S]*?color:\s*var\(--foreground\);[\s\S]*?transform:\s*scale\(1\.22\)/u,
  );
  assert.match(
    css,
    /\.compact-writing-row:hover \.compact-writing-copy,[\s\S]*?\.compact-writing-row:focus-visible \.compact-writing-copy\s*\{[\s\S]*?transform:\s*scale\(1\.025\)/u,
  );
  assert.match(
    css,
    /\.compact-writing-thumbnail-placeholder\s*\{[\s\S]*?linear-gradient\([\s\S]*?backdrop-filter:\s*blur\(16px\) saturate\(1\.08\)[\s\S]*?transform 520ms/u,
  );
  assert.match(
    css,
    /\.compact-writing-row:hover \.compact-writing-thumbnail-placeholder,[\s\S]*?transform:\s*scale\(1\.025\)/u,
  );
  assert.doesNotMatch(
    css,
    /\.compact-writing-thumbnail-placeholder::(?:before|after)/u,
  );
  assert.doesNotMatch(css, /\.compact-writing-placeholder-number/u);
  assert.match(
    writingList,
    /post\.thumbnail\s*\?\s*\([\s\S]*?<img[\s\S]*?\)\s*:\s*null/u,
  );
  assert.match(
    css,
    /\.compact-writing-copy\s*\{[\s\S]*?padding-right:\s*10px/u,
  );
  assert.doesNotMatch(
    css,
    /\.compact-writing-row:hover \.compact-writing-number\s*\{[\s\S]*?(?:background|border|border-radius):/u,
  );
  assert.doesNotMatch(css, /\.compact-writing-row::before/u);
  assert.doesNotMatch(css, /--writing-row-image/u);
});

test("all four spaces and the header share one content width", async () => {
  const css = await readFile(
    fileURLToPath(new URL("../app/globals.css", import.meta.url)),
    "utf8",
  );

  assert.match(
    css,
    /:root\s*\{[^}]*--site-header-height:\s*66px;/u,
  );
  assert.match(
    css,
    /\.site-header\s*\{[^}]*height:\s*var\(--site-header-height\);/u,
  );
  assert.match(
    css,
    /\.primary-nav\s*\{[^}]*--nav-item-width:\s*clamp\(64px,\s*3\.7vw,\s*76\.8px\);[^}]*--nav-item-gap:\s*clamp\(14px,\s*0\.81vw,\s*16\.8px\);/u,
  );
  assert.match(
    css,
    /\.primary-nav > a\s*\{[^}]*font-family:\s*var\(--article-serif\);[^}]*font-size:\s*clamp\(14px,\s*0\.81vw,\s*16\.8px\);/u,
  );
  assert.match(
    css,
    /\.header-inner,[\s\S]*?\.writing-page\.section-shell,[\s\S]*?\.book-library-root,[\s\S]*?\.playlist-browser,[\s\S]*?\.photo-gallery-root\s*\{[\s\S]*?width:\s*min\([\s\S]*?clamp\(1120px,\s*64\.8vw,\s*1344px\),[\s\S]*?calc\(100% - 40px\)/u,
  );
  assert.match(css, /\.space-page\s*\{[\s\S]*?padding-top:\s*32px/u);
  assert.match(
    css,
    /\.space-header\s*\{[\s\S]*?height:\s*45px[\s\S]*?padding-bottom:\s*8px[\s\S]*?border-bottom:\s*1px solid var\(--line-strong\)/u,
  );
  assert.match(
    css,
    /html\s*\{[\s\S]*?scrollbar-gutter:\s*auto;[\s\S]*?scrollbar-width:\s*none;[\s\S]*?-ms-overflow-style:\s*none/u,
  );
  assert.match(
    css,
    /\.header-actions\s*\{[\s\S]*?width:\s*148px;[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*calc\(\(var\(--site-header-height\) - 34px\) \/ 2\);[\s\S]*?right:\s*max\([\s\S]*?20px,[\s\S]*?calc\(\(100% - clamp\(1120px,\s*64\.8vw,\s*1344px\)\) \/ 2\)[\s\S]*?\)/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.header-actions\s*\{[\s\S]*?right:\s*12px/u,
  );
  assert.match(
    css,
    /html:has\(\.site-root\.is-home\)\s*\{[\s\S]*?overflow-y:\s*hidden;[\s\S]*?background-color:\s*#211829/u,
  );
  assert.match(
    css,
    /\.site-root\.is-home\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100svh;[\s\S]*?min-height:\s*100svh;[\s\S]*?overflow:\s*hidden;[\s\S]*?background:\s*transparent/u,
  );
  assert.match(
    css,
    /html::-webkit-scrollbar,[\s\S]*?body::-webkit-scrollbar,[\s\S]*?\.site-root::-webkit-scrollbar,[\s\S]*?\.site-root \*::-webkit-scrollbar\s*\{[\s\S]*?width:\s*0 !important;[\s\S]*?height:\s*0 !important;[\s\S]*?display:\s*none !important;[\s\S]*?background:\s*transparent !important/u,
  );
  assert.match(
    css,
    /\.search-results\s*\{[\s\S]*?overflow-y:\s*auto/u,
    "스크롤바를 숨겨도 검색 결과 스크롤은 유지해야 합니다.",
  );
});

test("core text remains readable at desktop and compact widths", async () => {
  const css = await readFile(
    fileURLToPath(new URL("../app/globals.css", import.meta.url)),
    "utf8",
  );

  assert.match(
    css,
    /\.compact-writing-date\s*\{[^}]*font-size:\s*clamp\(12px,\s*0\.695vw,\s*14\.4px\)/u,
  );
  assert.match(
    css,
    /\.compact-writing-summary\s*\{[^}]*font-size:\s*clamp\(14px,\s*0\.81vw,\s*16\.8px\)/u,
  );
  assert.match(
    css,
    /\.book-library-card-title\s*\{[^}]*font-size:\s*clamp\(15px,\s*0\.868vw,\s*18px\)/u,
  );
  assert.match(
    css,
    /\.book-library-card-author\s*\{[^}]*font-size:\s*clamp\(13px,\s*0\.752vw,\s*15\.6px\)/u,
  );
  assert.match(
    css,
    /\.playlist-browser-table\s*\{[^}]*font-size:\s*clamp\(15px,\s*0\.868vw,\s*18px\)/u,
  );
  assert.match(css, /\.space-count\s*\{[^}]*font-size:\s*13px/u);
  assert.match(css, /\.filter-menu-label\s*\{[^}]*font-size:\s*13px/u);
  assert.match(css, /\.filter-menu-trigger\s*\{[^}]*font-size:\s*14px/u);
  assert.match(css, /\.filter-menu-option\s*\{[^}]*font-size:\s*14px/u);
  assert.match(
    css,
    /\.markdown-body\s*\{[^}]*font-size:\s*clamp\(15px,\s*0\.868vw,\s*18px\)/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.compact-writing-date\s*\{[^}]*font-size:\s*12px;[\s\S]*?\.markdown-body\s*\{[^}]*font-size:\s*15px;[\s\S]*?\.playlist-browser-table\s*\{[^}]*font-size:\s*14px;[\s\S]*?\.filter-menu\s*\{[^}]*grid-template-columns:\s*54px minmax\(0,\s*1fr\);[\s\S]*?\.filter-menu-label\s*\{[^}]*font-size:\s*13px;/u,
  );
  assert.match(
    css,
    /@media \(max-width: 520px\)[\s\S]*?\.compact-writing-copy strong\s*\{[^}]*font-size:\s*15px;[\s\S]*?\.compact-writing-summary\s*\{[^}]*font-size:\s*13px;[\s\S]*?\.book-library-card-title\s*\{[^}]*font-size:\s*15px;[\s\S]*?\.book-library-card-author\s*\{[^}]*font-size:\s*13px;/u,
  );
});

test("the header wordmark includes the rounded sunset mark", async () => {
  const [response, css] = await Promise.all([
    render("/writing"),
    readFile(
      fileURLToPath(new URL("../app/globals.css", import.meta.url)),
      "utf8",
    ),
  ]);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /class="wordmark-mark"/u);
  assert.match(
    css,
    /\.wordmark-mark\s*\{[\s\S]*?width:\s*clamp\(28px,\s*1\.62vw,\s*33\.6px\);[\s\S]*?border-radius:\s*8px;[\s\S]*?url\("\/images\/background\.png"\)/u,
  );
});

test("mobile navigation is an opaque sidebar and every space menu uses the literary face", async () => {
  const [css, shell] = await Promise.all([
    readFile(
      fileURLToPath(new URL("../app/globals.css", import.meta.url)),
      "utf8",
    ),
    readFile(
      fileURLToPath(
        new URL("../app/components/SiteShell.tsx", import.meta.url),
      ),
      "utf8",
    ),
  ]);

  assert.match(
    css,
    /:root\s*\{[\s\S]*?--mobile-nav-background:\s*#ffffff/u,
  );
  assert.match(
    css,
    /html\.dark\s*\{[\s\S]*?--mobile-nav-background:\s*#1a1a1a/u,
  );
  assert.match(
    css,
    /html\.sunset\s*\{[\s\S]*?--mobile-nav-background:\s*#fff9f6/u,
  );
  assert.match(
    css,
    /html\.sunset\.dark\s*\{[\s\S]*?--mobile-nav-background:\s*#110d15/u,
  );
  assert.match(
    css,
    /\.primary-nav > a\s*\{[\s\S]*?font-family:\s*var\(--article-serif\)/u,
  );
  assert.match(
    css,
    /\.primary-nav > a\s*\{[\s\S]*?font-weight:\s*600;[\s\S]*?white-space:\s*nowrap;[\s\S]*?transition:\s*color 180ms ease/u,
  );
  assert.match(
    css,
    /\.primary-nav > a:not\(:first-child\)::before\s*\{[\s\S]*?width:\s*1px;[\s\S]*?height:\s*14px;[\s\S]*?background:\s*var\(--line-strong\);[\s\S]*?opacity:\s*0\.72/u,
  );
  assert.doesNotMatch(
    css,
    /\.primary-nav > a(?:\.active|:hover)\s*\{[^}]*background:/u,
  );
  assert.match(
    css,
    /\.home-navigation a\s*\{[\s\S]*?font-family:\s*var\(--article-serif\)/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.primary-nav\s*\{[\s\S]*?background:\s*var\(--mobile-nav-background\);[\s\S]*?backdrop-filter:\s*none;[\s\S]*?-webkit-backdrop-filter:\s*none/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.primary-nav\s*\{[\s\S]*?width:\s*min\(300px, 84vw\);[\s\S]*?height:\s*calc\(100dvh - var\(--site-header-height\)\);[\s\S]*?top:\s*var\(--site-header-height\);[\s\S]*?right:\s*0;[\s\S]*?left:\s*auto;[\s\S]*?transform:\s*translateX\(100%\)/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.primary-nav\.is-open\s*\{[\s\S]*?visibility:\s*visible;[\s\S]*?pointer-events:\s*auto;[\s\S]*?transform:\s*translateX\(0\)/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.mobile-nav-backdrop\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*var\(--site-header-height\) 0 0;[\s\S]*?opacity:\s*0;[\s\S]*?visibility:\s*hidden/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.mobile-nav-backdrop\.is-open\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?visibility:\s*visible;[\s\S]*?pointer-events:\s*auto/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.primary-nav > a:not\(:first-child\)::before\s*\{[\s\S]*?display:\s*none/u,
  );
  assert.match(shell, /className=\{`mobile-nav-backdrop \$\{/u);
  assert.match(
    shell,
    /document\.body\.style\.overflow = "hidden";[\s\S]*?document\.body\.style\.overflow = previousOverflow/u,
  );
  assert.match(
    shell,
    /window\.matchMedia\("\(max-width: 760px\)"\)[\s\S]*?setMobileOpen\(false\)/u,
  );
});

test("quiet interaction polish keeps navigation and media responsive", async () => {
  const [css, shell, searchDialog, books, playlist, gallery] =
    await Promise.all([
      readFile(
        fileURLToPath(new URL("../app/globals.css", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("../app/components/SiteShell.tsx", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("../app/components/SearchDialog.tsx", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("../app/components/BookShelf.tsx", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("../app/components/Playlist.tsx", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("../app/components/PhotoGallery.tsx", import.meta.url),
        ),
        "utf8",
      ),
    ]);

  assert.match(shell, /aria-current=\{/u);
  assert.match(
    shell,
    /lazy\(\(\) => import\("@\/app\/components\/SearchDialog"\)\)/u,
  );
  assert.match(searchDialog, /onKeyDown=\{trapFocus\}/u);
  assert.match(searchDialog, /previousFocus\.focus\(\)/u);
  assert.match(books, /title=\{book\.title\}/u);
  assert.match(
    css,
    /\.book-library-card-title\s*\{[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap/u,
  );
  assert.match(
    css,
    /\.book-library-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[\s\S]*?gap:\s*64px 36px/u,
  );
  assert.match(
    css,
    /\.book-library-cover-wrap\s*\{[\s\S]*?transform:\s*scale\(1\);[\s\S]*?transform 420ms cubic-bezier/u,
  );
  assert.match(
    css,
    /\.book-library-card:hover \.book-library-cover-wrap,[\s\S]*?\.book-library-card:focus-visible \.book-library-cover-wrap\s*\{[\s\S]*?transform:\s*scale\(1\.018\)/u,
  );
  assert.match(
    css,
    /\.book-library-card-copy\s*\{[\s\S]*?background:\s*var\(--book-meta-surface\)[\s\S]*?gap:\s*2px/u,
  );
  assert.match(
    css,
    /\.book-library-card-title\s*\{[\s\S]*?min-height:\s*0/u,
  );
  assert.match(
    css,
    /\.book-library-card-title,[\s\S]*?\.book-library-card-author\s*\{[\s\S]*?font-family:\s*var\(--article-serif\)/u,
  );
  assert.match(
    css,
    /@media \(max-width: 520px\)[\s\S]*?\.article-bottom-nav\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(0,\s*1fr\)/u,
  );
  assert.match(
    css,
    /\.article-bottom-nav\s*\{[\s\S]*?padding:\s*0;[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?backdrop-filter:\s*none/u,
  );
  assert.match(
    css,
    /\.article-nav-tab\s*\{[\s\S]*?background:\s*color-mix\(in srgb,\s*var\(--surface\) 94%,\s*var\(--background\)\);[\s\S]*?opacity:\s*0\.96/u,
  );
  assert.match(
    css,
    /a\.article-nav-tab:hover,[\s\S]*?a\.article-nav-tab:focus-visible\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?transform:\s*translateY\(-2px\)/u,
  );
  assert.match(
    css,
    /\.article-nav-tab-list\s*\{[\s\S]*?background:\s*color-mix\(in srgb,\s*var\(--surface\) 88%,\s*var\(--accent\)\)/u,
  );
  assert.match(
    playlist,
    /tabIndex=\{[\s\S]*?isSelected \|\| \(!pageHasSelectedTrack && index === 0\)[\s\S]*?\? 0[\s\S]*?: -1[\s\S]*?\}/u,
  );
  assert.match(playlist, /prefetchedThumbnailRefs/u);
  assert.match(gallery, /onPointerEnter=\{\(\) => preloadPhoto\(photo\)\}/u);
  assert.match(
    gallery,
    /aria-label=\{`\$\{photo\.displayDate\}에 촬영한/u,
  );
});
