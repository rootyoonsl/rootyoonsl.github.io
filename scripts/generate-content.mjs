import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import exifr from "exifr";
import sharp from "sharp";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = dirname(scriptPath);
const projectRoot = resolve(scriptDirectory, "..");
const galleryPipelineUpdatedAt = (await stat(scriptPath)).mtimeMs;
const postsDirectory = join(projectRoot, "content", "posts");
const booksFile = join(projectRoot, "content", "books", "Booklists.md");
const musicsFile = join(projectRoot, "content", "musics", "musics.md");
const musicLyricsFile = join(
  projectRoot,
  "content",
  "musics",
  "가사",
  "가사.md",
);
const galleryDirectory = join(projectRoot, "content", "gallery");
const generatedFile = join(projectRoot, "app", "content.generated.ts");
const generatedMusicLyricsFile = join(
  projectRoot,
  "app",
  "music-lyrics.ts",
);
const postImagesDirectory = join(projectRoot, "public", "post-images");
const sharedPostImagesDirectory = join(postsDirectory, "imgs");
const galleryImagesDirectory = join(projectRoot, "public", "gallery");
const homeBackgroundSource = join(projectRoot, "content", "노을배경.png");
const homeBackgroundDestination = join(
  projectRoot,
  "public",
  "images",
  "background.png",
);
const katexDistributionDirectory = join(
  projectRoot,
  "node_modules",
  "katex",
  "dist",
);
const katexFontsDestination = join(projectRoot, "public", "fonts");

const supportedFrontmatterKeys = new Set([
  "title",
  "date",
  "data",
  "time",
  "slug",
  "description",
]);

const copiedImages = new Map();
const galleryImageExtensions = new Set([".jpg", ".jpeg", ".png"]);
let sharedPostImageIndexPromise;

function stripLineEnding(line) {
  return line.replace(/\r?\n$/u, "");
}

function parseYamlScalar(rawValue) {
  const value = rawValue.trim();

  if (!value || value === "~" || value.toLowerCase() === "null") {
    return "";
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/gu, "'");
  }

  const commentIndex = value.search(/\s#/u);
  return (commentIndex === -1 ? value : value.slice(0, commentIndex)).trim();
}

function parseFrontmatterBlock(frontmatter) {
  const attributes = {};
  const lines = frontmatter.split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.trim() || line.trimStart().startsWith("#")) {
      continue;
    }

    const match = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/u.exec(line);
    if (!match) {
      continue;
    }

    const key = match[1].toLowerCase();
    if (!supportedFrontmatterKeys.has(key)) {
      continue;
    }

    const rawValue = match[2];
    if (/^[>|][-+]?\s*$/u.test(rawValue)) {
      const folded = rawValue.trimStart().startsWith(">");
      const blockLines = [];

      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1];
        if (nextLine && !/^[ \t]/u.test(nextLine)) {
          break;
        }

        index += 1;
        blockLines.push(nextLine.replace(/^[ \t]{1,2}/u, ""));
      }

      attributes[key] = folded
        ? blockLines.join(" ").replace(/\s+/gu, " ").trim()
        : blockLines.join("\n").trimEnd();
      continue;
    }

    attributes[key] = parseYamlScalar(rawValue);
  }

  return attributes;
}

function splitFrontmatter(source) {
  const lines = source.split(/(?<=\n)/u);
  const firstLine = stripLineEnding(lines[0] ?? "").replace(/^\uFEFF/u, "");

  if (firstLine.trim() !== "---") {
    return { attributes: {}, body: source };
  }

  let closingIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    const line = stripLineEnding(lines[index]).trim();
    if (line === "---" || line === "...") {
      closingIndex = index;
      break;
    }
  }

  if (closingIndex === -1) {
    throw new Error("Frontmatter is missing a closing delimiter.");
  }

  return {
    attributes: parseFrontmatterBlock(
      lines
        .slice(1, closingIndex)
        .map(stripLineEnding)
        .join("\n"),
    ),
    body: lines.slice(closingIndex + 1).join(""),
  };
}

function cleanTitle(line) {
  return line
    .replace(/^\uFEFF/u, "")
    .replace(/\u00A0/gu, " ")
    .trim()
    .replace(/^(?:#{1,6}\s+)+/u, "")
    .replace(/\s+#+$/u, "")
    .replace(/^(\*\*|__)(.+)\1$/u, "$2")
    .normalize("NFC");
}

function extractLevelOneTitle(body) {
  const linePattern = /.*(?:\r?\n|$)/gu;
  let activeFence = null;

  for (const match of body.matchAll(linePattern)) {
    if (!match[0]) {
      continue;
    }

    const line = stripLineEnding(match[0]);
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/u.exec(line);

    if (fenceMatch) {
      const fenceMarker = fenceMatch[1][0];
      activeFence = activeFence === fenceMarker ? null : fenceMarker;
      continue;
    }

    if (activeFence) {
      continue;
    }

    const headingMatch = /^\s{0,3}#(?!#)\s+(.+?)\s*#*\s*$/u.exec(line);
    if (!headingMatch) {
      continue;
    }

    const start = match.index;
    const end = start + match[0].length;
    return {
      title: cleanTitle(headingMatch[1]),
      body: `${body.slice(0, start)}${body.slice(end)}`,
    };
  }

  return null;
}

function isValidDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatDateParts(year, month, day) {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);

  if (!isValidDate(numericYear, numericMonth, numericDay)) {
    return null;
  }

  return [
    String(numericYear).padStart(4, "0"),
    String(numericMonth).padStart(2, "0"),
    String(numericDay).padStart(2, "0"),
  ].join("-");
}

function normalizeDate(value) {
  const input = String(value ?? "").trim();
  if (!input) {
    return null;
  }

  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?=$|[T\s])/u.exec(input);
  if (match) {
    return formatDateParts(match[1], match[2], match[3]);
  }

  match = /^(\d{4})(\d{2})(\d{2})$/u.exec(input);
  if (match) {
    return formatDateParts(match[1], match[2], match[3]);
  }

  match = /^(\d{2})(\d{2})(\d{2})$/u.exec(input);
  if (match) {
    return formatDateParts(`20${match[1]}`, match[2], match[3]);
  }

  return null;
}

function normalizeTime(value) {
  const input = String(value ?? "").trim();
  if (!input) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/u.exec(input);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  if (
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    return null;
  }

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function inferDateFromFolders(filePath) {
  let directory = dirname(filePath);

  while (directory.startsWith(postsDirectory)) {
    const folderName = directory.split(/[\\/]/u).at(-1)?.normalize("NFC") ?? "";
    const match = /\((\d{2})(\d{2})(\d{2})\)\s*$/u.exec(folderName);

    if (match) {
      return formatDateParts(`20${match[1]}`, match[2], match[3]);
    }

    if (directory === postsDirectory) {
      break;
    }
    directory = dirname(directory);
  }

  return null;
}

function createSlug(value) {
  const slug = String(value)
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("ko-KR")
    .replace(/['’]/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .normalize("NFC");

  if (!slug) {
    throw new Error(`Unable to create a slug from "${value}".`);
  }

  return slug;
}

function decodeLocalPath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isInsideDirectory(filePath, directory) {
  const relation = relative(directory, filePath);
  return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
}

function sharedPostImageKey(value) {
  return basename(value)
    .replace(/^이미지\s*[-:]\s*/u, "")
    .replace(/\s+/gu, "")
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR");
}

async function sharedPostImageIndex() {
  if (!sharedPostImageIndexPromise) {
    sharedPostImageIndexPromise = readdir(sharedPostImagesDirectory, {
      withFileTypes: true,
    })
      .then((entries) => {
        const index = new Map();

        for (const entry of entries) {
          if (!entry.isFile()) {
            continue;
          }

          const key = sharedPostImageKey(entry.name);
          if (index.has(key)) {
            throw new Error(
              `Shared post images have an ambiguous filename: ${entry.name}`,
            );
          }
          index.set(key, join(sharedPostImagesDirectory, entry.name));
        }

        return index;
      })
      .catch((error) => {
        if (error?.code === "ENOENT") {
          return new Map();
        }
        throw error;
      });
  }

  return sharedPostImageIndexPromise;
}

async function copyPostImage(sourceImage, slug) {
  const imageStats = await stat(sourceImage).catch(() => null);
  if (!imageStats?.isFile()) {
    throw new Error(`Referenced post image does not exist: ${sourceImage}`);
  }

  const filename = basename(sourceImage);
  const destinationDirectory = join(postImagesDirectory, slug);
  const destinationImage = join(destinationDirectory, filename);
  const previousSource = copiedImages.get(destinationImage);

  if (previousSource && previousSource !== sourceImage) {
    throw new Error(
      `Two images resolve to the same generated path: ${destinationImage}`,
    );
  }

  await mkdir(destinationDirectory, { recursive: true });
  await copyFile(sourceImage, destinationImage);
  copiedImages.set(destinationImage, sourceImage);

  return `/post-images/${slug}/${encodeURIComponent(filename)}`;
}

async function rewriteSharedPostImageShorthand(markdown, slug) {
  const shorthandPattern = /!\[([^\]\r\n]+)\](?!\s*(?:\(|\[))/gu;
  const matches = [...markdown.matchAll(shorthandPattern)];
  if (!matches.length) {
    return markdown;
  }

  const imageIndex = await sharedPostImageIndex();
  let rewritten = "";
  let cursor = 0;

  for (const match of matches) {
    const sourceImage = imageIndex.get(sharedPostImageKey(match[1]));
    if (!sourceImage) {
      continue;
    }

    const publicPath = await copyPostImage(sourceImage, slug);
    rewritten += markdown.slice(cursor, match.index);
    rewritten += `![${match[1]}](${publicPath})`;
    cursor = match.index + match[0].length;
  }

  rewritten += markdown.slice(cursor);
  return rewritten;
}

async function rewriteAndCopyPostImages(markdown, sourceFile, slug) {
  const imagePattern =
    /!\[[^\]]*\]\(\s*(?:<([^>\r\n]+)>|([^\s)\r\n]+))((?:\s+(?:"[^"\r\n]*"|'[^'\r\n]*'|\([^)\r\n]*\)))?)\s*\)/gu;
  const matches = [...markdown.matchAll(imagePattern)];

  if (!matches.length) {
    return markdown;
  }

  let rewritten = "";
  let cursor = 0;

  for (const match of matches) {
    const target = match[1] ?? match[2];
    const cleanTarget = decodeLocalPath(target.split(/[?#]/u, 1)[0])
      .replace(/\\/gu, "/")
      .replace(/^\.\//u, "");

    let imageRoot;
    let sourceImage;

    if (/^Attachments\//iu.test(cleanTarget)) {
      imageRoot = resolve(dirname(sourceFile), "Attachments");
      sourceImage = resolve(dirname(sourceFile), cleanTarget);
    } else if (/^imgs\//iu.test(cleanTarget)) {
      imageRoot = sharedPostImagesDirectory;
      sourceImage = resolve(postsDirectory, cleanTarget);
    } else {
      continue;
    }

    if (!isInsideDirectory(sourceImage, imageRoot)) {
      throw new Error(
        `Image path escapes its allowed directory: ${target} (${sourceFile})`,
      );
    }

    const publicPath = await copyPostImage(sourceImage, slug);
    const destinationStart = match[0].indexOf(target, match[0].indexOf("](") + 2);
    const replacement =
      destinationStart === -1
        ? match[0]
        : `${match[0].slice(0, destinationStart)}${publicPath}${match[0].slice(
            destinationStart + target.length,
          )}`;

    rewritten += markdown.slice(cursor, match.index);
    rewritten += replacement;
    cursor = match.index + match[0].length;
  }

  rewritten += markdown.slice(cursor);
  return rewritten;
}

function markdownToPlainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/~~~[\s\S]*?~~~/gu, " ")
    .replace(/!\[[^\]]*\]\([^)\r\n]*\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)\r\n]*\)/gu, "$1")
    .replace(/\${1,2}/gu, "")
    .replace(/\\(?:text|textbf|texttt|mathbf)\{([^{}]*)\}/gu, "$1")
    .replace(/\\(?:rightarrow|to)/gu, " → ")
    .replace(/\\(?:geq|leq)/gu, " ")
    .replace(/\\[A-Za-z]+/gu, " ")
    .replace(/[{}]/gu, " ")
    .replace(/<https?:\/\/[^>]+>/gu, " ")
    .replace(/<\/?[A-Za-z][^>]*>/gu, " ")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gmu, "")
    .replace(/(?:\*\*|__)(.*?)(?:\*\*|__)/gu, "$1")
    .replace(/(?:~~)(.*?)(?:~~)/gu, "$1")
    .replace(/[*_`]/gu, "")
    .replace(/\+\+/gu, "")
    .replace(/\\([\\`*{}[\]()#+\-.!_>])/gu, "$1")
    .replace(/https?:\/\/\S+/gu, " ")
    .replace(/\u00A0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .normalize("NFC");
}

function stripLegacyAttributeDirectives(markdown) {
  return markdown
    .replace(/^\s*>\s*\{:\s*\.[\w-]+\s*\}\s*$/gmu, "")
    .replace(/^\s*\{:\s*\.[\w-]+\s*\}\s*$/gmu, "");
}

function createSummary(plainText, maximumLength = 170) {
  if (plainText.length <= maximumLength) {
    return plainText;
  }

  const candidate = plainText.slice(0, maximumLength + 1);
  const lastSpace = candidate.lastIndexOf(" ");
  const end =
    lastSpace >= Math.floor(maximumLength * 0.65) ? lastSpace : maximumLength;
  return `${candidate.slice(0, end).trimEnd()}…`;
}

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) =>
    left.name
      .normalize("NFC")
      .localeCompare(right.name.normalize("NFC"), "ko"),
  );

  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(entryPath)));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      files.push(entryPath);
    }
  }

  return files;
}

async function createPost(filePath) {
  const source = await readFile(filePath, "utf8");
  if (!source.trim()) {
    return null;
  }

  const { attributes, body: bodyWithoutFrontmatter } = splitFrontmatter(source);

  let title;
  let body;

  if (attributes.title) {
    title = cleanTitle(String(attributes.title));
    body = bodyWithoutFrontmatter;
  } else {
    const extracted = extractLevelOneTitle(bodyWithoutFrontmatter);
    title =
      extracted?.title ??
      cleanTitle(basename(filePath, extname(filePath)));
    body = extracted?.body ?? bodyWithoutFrontmatter;
  }

  const standardDate = attributes.date
    ? normalizeDate(attributes.date)
    : null;
  const dataDate = attributes.data
    ? normalizeDate(attributes.data)
    : null;
  if (attributes.date && !standardDate) {
    throw new Error(
      `Invalid frontmatter date "${attributes.date}" in ${filePath}`,
    );
  }
  if (attributes.data && !dataDate) {
    throw new Error(
      `Invalid frontmatter Data "${attributes.data}" in ${filePath}`,
    );
  }
  if (standardDate && dataDate && standardDate !== dataDate) {
    throw new Error(
      `Conflicting date and Data values in ${filePath}`,
    );
  }

  const date = standardDate ?? dataDate ?? inferDateFromFolders(filePath);
  if (!date) {
    throw new Error(
      `Post date is missing. Add frontmatter date or a (YYMMDD) folder: ${filePath}`,
    );
  }

  const time = attributes.time
    ? normalizeTime(attributes.time)
    : "00:00:00";
  if (attributes.time && !time) {
    throw new Error(
      `Invalid frontmatter time "${attributes.time}" in ${filePath}`,
    );
  }

  const filenameStem = basename(filePath, extname(filePath)).normalize("NFC");
  const filenameSlug = /^\d{6,8}(?:[-_]\d+)?$/u.test(filenameStem)
    ? filenameStem
    : "";
  const slug = createSlug(attributes.slug || filenameSlug || title);
  const normalizedBody = stripLegacyAttributeDirectives(body);
  const bodyWithSharedImages = await rewriteSharedPostImageShorthand(
    normalizedBody,
    slug,
  );
  const rewrittenBody = await rewriteAndCopyPostImages(
    bodyWithSharedImages,
    filePath,
    slug,
  );
  const plainText = markdownToPlainText(rewrittenBody);
  const summary = createSummary(plainText);
  const description = attributes.description
    ? String(attributes.description).trim().normalize("NFC")
    : summary;

  return {
    slug,
    title,
    date,
    sortDateTime: `${date}T${time}`,
    displayDate: date.replace(/-/gu, ". "),
    description,
    plainText,
    body: rewrittenBody,
  };
}

function normalizeBookUrl(url) {
  return url.replace(
    /^http:\/\/product\.kyobobook\.co\.kr(?=\/)/u,
    "https://product.kyobobook.co.kr",
  );
}

function parseBooks(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const entries = [];
  const urls = new Set();
  const titles = new Set();
  let activeBook = null;

  const finishBook = () => {
    if (!activeBook) return;

    const missingFields = ["author", "url", "cover"].filter(
      (field) => !activeBook[field],
    );
    if (missingFields.length) {
      throw new Error(
        `Book "${activeBook.title}" is missing: ${missingFields.join(", ")}`,
      );
    }

    const url = normalizeBookUrl(activeBook.url);
    let parsedBookUrl;
    let parsedCoverUrl;
    try {
      parsedBookUrl = new URL(url);
      parsedCoverUrl = new URL(activeBook.cover);
    } catch {
      throw new Error(`Book "${activeBook.title}" has an invalid URL.`);
    }

    if (
      parsedBookUrl.protocol !== "https:" ||
      parsedBookUrl.hostname !== "product.kyobobook.co.kr"
    ) {
      throw new Error(
        `Book "${activeBook.title}" must use a Kyobo product URL.`,
      );
    }
    if (!/^https?:$/u.test(parsedCoverUrl.protocol)) {
      throw new Error(`Book "${activeBook.title}" has an invalid cover URL.`);
    }
    if (urls.has(url)) {
      throw new Error(`Duplicate book URL: ${url}`);
    }
    if (titles.has(activeBook.title)) {
      throw new Error(`Duplicate book title: ${activeBook.title}`);
    }

    urls.add(url);
    titles.add(activeBook.title);
    entries.push({
      title: activeBook.title,
      author: activeBook.author,
      url,
      cover: activeBook.cover,
    });
    activeBook = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeCuratedLine(lines[index]);
    if (!line || line === "# Booklists") {
      continue;
    }

    const headingMatch = /^##\s+(.+?)\s*#*$/u.exec(line);
    if (headingMatch) {
      finishBook();
      activeBook = { title: cleanTitle(headingMatch[1]) };
      continue;
    }

    if (!activeBook) {
      throw new Error(
        `Book metadata must follow a level-two title (line ${index + 1}).`,
      );
    }

    const fieldMatch = /^-\s*(저자|교보문고|표지)\s*:\s*(.+)$/u.exec(line);
    if (!fieldMatch) {
      throw new Error(
        `Invalid book metadata on line ${index + 1}: ${line}`,
      );
    }

    const field = {
      저자: "author",
      교보문고: "url",
      표지: "cover",
    }[fieldMatch[1]];
    if (activeBook[field]) {
      throw new Error(
        `Book "${activeBook.title}" repeats the ${fieldMatch[1]} field.`,
      );
    }
    activeBook[field] = fieldMatch[2].trim();
  }

  finishBook();
  return entries;
}

function normalizeCuratedLine(line) {
  return line
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/\u00A0/gu, " ")
    .trim()
    .normalize("NFC");
}

function parseMusicLinks(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const entries = [];
  const urls = new Set();
  let activeArtist = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeCuratedLine(lines[index]);
    const artistMatch = /^\[([^\]]+)\]$/u.exec(line);
    const artistHeadingMatch = /^#{1,6}\s+(.+?)\s*#*\s*$/u.exec(line);

    if (artistMatch) {
      activeArtist = artistMatch[1].trim();
      continue;
    }

    if (artistHeadingMatch) {
      let nextContentIndex = index + 1;
      while (
        nextContentIndex < lines.length &&
        !normalizeCuratedLine(lines[nextContentIndex])
      ) {
        nextContentIndex += 1;
      }

      const nextContent =
        nextContentIndex < lines.length
          ? normalizeCuratedLine(lines[nextContentIndex])
          : "";
      const startsMusicSection =
        /^\[[^\]]*\]\(https?:\/\/[^)\s]+\)\s*$/u.test(nextContent);

      activeArtist = startsMusicSection
        ? artistHeadingMatch[1].trim()
        : null;
      continue;
    }

    if (/^[—–-]+$/u.test(line)) {
      activeArtist = null;
      continue;
    }

    const linkMatch =
      /^\[[^\]]*\]\((https?:\/\/[^)\s]+)\)\s*$/u.exec(line);

    if (line && !linkMatch) {
      let nextContentIndex = index + 1;
      while (
        nextContentIndex < lines.length &&
        !normalizeCuratedLine(lines[nextContentIndex])
      ) {
        nextContentIndex += 1;
      }

      const nextContent =
        nextContentIndex < lines.length
          ? normalizeCuratedLine(lines[nextContentIndex])
          : "";

      if (/^\[[^\]]*\]\(https?:\/\/[^)\s]+\)\s*$/u.test(nextContent)) {
        activeArtist = line;
        continue;
      }
    }

    if (!linkMatch) {
      continue;
    }

    let titleIndex = index + 1;
    while (
      titleIndex < lines.length &&
      !normalizeCuratedLine(lines[titleIndex])
    ) {
      titleIndex += 1;
    }

    const titleLine =
      titleIndex < lines.length
        ? normalizeCuratedLine(lines[titleIndex])
        : "";
    if (
      !titleLine ||
      /^\[[^\]]*\]\(https?:\/\//u.test(titleLine) ||
      /^\[[^\]]+\]$/u.test(titleLine) ||
      /^[—–-]+$/u.test(titleLine) ||
      /^#{1,6}\s/u.test(titleLine)
    ) {
      throw new Error(
        `A music link on line ${index + 1} is missing its title: ${linkMatch[1]}`,
      );
    }

    let artist = activeArtist;
    let title = titleLine;

    if (!artist) {
      const divider = titleLine.indexOf(" - ");
      if (divider === -1) {
        throw new Error(
          `A music link outside an artist section must use "artist - title": ${linkMatch[1]}`,
        );
      }
      artist = titleLine.slice(0, divider).trim();
      title = titleLine.slice(divider + 3).trim();
    }

    if (!artist || !title) {
      throw new Error(`Invalid music entry: ${linkMatch[1]}`);
    }
    if (urls.has(linkMatch[1])) {
      throw new Error(`Duplicate music URL: ${linkMatch[1]}`);
    }

    urls.add(linkMatch[1]);
    entries.push({ title, artist, url: linkMatch[1] });
    index = titleIndex;
  }

  return entries;
}

function normalizeLyricsLine(line) {
  return line
    .replace(/^\uFEFF/u, "")
    .replace(/\u00A0/gu, " ")
    .replace(/[ \t]+$/u, "")
    .normalize("NFC");
}

function normalizeLyricsHeading(line) {
  return normalizeCuratedLine(line)
    .replace(/^(\*\*|__)(.+)\1$/u, "$2")
    .toLocaleLowerCase("en-US");
}

function youtubeIdFromMusicUrl(value) {
  const url = new URL(value);

  if (url.hostname === "youtu.be") {
    return url.pathname.slice(1);
  }
  if (url.hostname.endsWith("youtube.com")) {
    return url.searchParams.get("v") ?? "";
  }
  return "";
}

function parseMusicLyrics(markdown, musics) {
  const lines = markdown
    .replace(/[\u2028\u2029]/gu, "\n")
    .split(/\r?\n/u)
    .map(normalizeLyricsLine);
  const headingIndexes = Array.from({ length: musics.length }, () => -1);
  const missingTracks = [];
  let cursor = 0;

  for (let index = 0; index < musics.length; index += 1) {
    const expectedHeading = normalizeLyricsHeading(musics[index].title);
    let headingIndex = -1;

    for (let lineIndex = cursor; lineIndex < lines.length; lineIndex += 1) {
      const isStandaloneHeading =
        !lines[lineIndex - 1]?.trim() && !lines[lineIndex + 1]?.trim();

      if (
        isStandaloneHeading &&
        normalizeLyricsHeading(lines[lineIndex]) === expectedHeading
      ) {
        headingIndex = lineIndex;
        break;
      }
    }

    if (headingIndex === -1) {
      missingTracks.push(musics[index]);
      continue;
    }

    headingIndexes[index] = headingIndex;
    cursor = headingIndex + 1;
  }

  const lyricsByYoutubeId = {};
  const youtubeIds = new Set();

  for (let index = 0; index < musics.length; index += 1) {
    const youtubeId = youtubeIdFromMusicUrl(musics[index].url);
    if (!youtubeId) {
      throw new Error(`Invalid YouTube music URL: ${musics[index].url}`);
    }
    if (youtubeIds.has(youtubeId)) {
      throw new Error(`Duplicate YouTube music ID: ${youtubeId}`);
    }

    youtubeIds.add(youtubeId);
    const headingIndex = headingIndexes[index];
    const nextHeadingIndex = headingIndexes
      .slice(index + 1)
      .find((candidate) => candidate !== -1);
    const lyrics =
      headingIndex === -1
        ? "-"
        : lines
            .slice(
              headingIndex + 1,
              nextHeadingIndex === undefined ? lines.length : nextHeadingIndex,
            )
            .join("\n")
            .trim() || "-";

    lyricsByYoutubeId[youtubeId] = lyrics;
  }

  return { lyricsByYoutubeId, missingTracks };
}

function normalizeExifDate(value) {
  const input = String(value ?? "").trim();
  const match =
    /^(\d{4})[:/-](\d{2})[:/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/u.exec(
      input,
    );

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
}

function formatFileDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join("T");
}

async function generatedGalleryImageIsCurrent(sourceStats, destination) {
  const destinationStats = await stat(destination).catch(() => null);
  return Boolean(
    destinationStats?.isFile() &&
      destinationStats.mtimeMs >=
        Math.max(sourceStats.mtimeMs, galleryPipelineUpdatedAt),
  );
}

async function createGalleryPhoto(filename) {
  const source = join(galleryDirectory, filename);
  const sourceStats = await stat(source);
  const extension = extname(filename);
  const id = createSlug(basename(filename, extension));
  const fullFilename = `${id}.webp`;
  const thumbnailFilename = `${id}-thumb.webp`;
  const fullDestination = join(galleryImagesDirectory, fullFilename);
  const thumbnailDestination = join(
    galleryImagesDirectory,
    thumbnailFilename,
  );

  const exif =
    (await exifr
      .parse(source, {
        tiff: true,
        exif: true,
        gps: false,
        interop: false,
        ifd1: false,
        translateValues: false,
        reviveValues: false,
      })
      .catch(() => null)) ?? {};

  const exifDate = normalizeExifDate(
    exif.DateTimeOriginal ?? exif.CreateDate ?? exif.ModifyDate,
  );
  const takenAt = exifDate ?? formatFileDate(sourceStats.mtime);

  await mkdir(galleryImagesDirectory, { recursive: true });

  if (
    !(await generatedGalleryImageIsCurrent(sourceStats, fullDestination))
  ) {
    await sharp(source)
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88, effort: 4 })
      .toFile(fullDestination);
  }

  if (
    !(await generatedGalleryImageIsCurrent(sourceStats, thumbnailDestination))
  ) {
    await sharp(source)
      .rotate()
      .resize({
        width: 960,
        height: 960,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toFile(thumbnailDestination);
  }

  const generatedMetadata = await sharp(fullDestination).metadata();
  const dateLabel = takenAt
    .slice(0, 10)
    .replace(/^(\d{4})-(\d{2})-(\d{2})$/u, "$1. $2. $3");

  return {
    id,
    filename: filename.normalize("NFC"),
    src: `/gallery/${fullFilename}`,
    thumbnail: `/gallery/${thumbnailFilename}`,
    width: generatedMetadata.width ?? 1,
    height: generatedMetadata.height ?? 1,
    takenAt,
    displayDate: dateLabel,
    alt: `${dateLabel}에 촬영한 사진`,
  };
}

async function collectGalleryPhotos() {
  const entries = await readdir(galleryDirectory, { withFileTypes: true });
  const filenames = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        galleryImageExtensions.has(extname(entry.name).toLowerCase()),
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "ko"));
  const photos = [];

  for (const filename of filenames) {
    photos.push(await createGalleryPhoto(filename));
  }

  return photos.sort(
    (left, right) =>
      right.takenAt.localeCompare(left.takenAt) ||
      left.filename.localeCompare(right.filename, "ko"),
  );
}

async function prepareKaTeXAssets() {
  const fontEntries = await readdir(
    join(katexDistributionDirectory, "fonts"),
    { withFileTypes: true },
  );
  const woff2Fonts = fontEntries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".woff2"),
  );

  await mkdir(katexFontsDestination, { recursive: true });
  await Promise.all(
    woff2Fonts.map((entry) =>
      copyFile(
        join(katexDistributionDirectory, "fonts", entry.name),
        join(katexFontsDestination, entry.name),
      ),
    ),
  );
}

function serializeForTypeScript(value) {
  return JSON.stringify(value, null, 2)
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");
}

function createGeneratedModule(posts, books, musics, photos) {
  return `/* This file is generated by scripts/generate-content.mjs. */
/* Do not edit it directly. */

type GeneratedPost = {
  slug: string;
  title: string;
  date: string;
  displayDate: string;
  description: string;
  plainText: string;
  body: string;
};

type CuratedBook = {
  title: string;
  author: string;
  url: string;
  cover: string;
};

type CuratedMusicLink = {
  title: string;
  url: string;
  artist: string;
};

export type GeneratedPhoto = {
  id: string;
  filename: string;
  src: string;
  thumbnail: string;
  width: number;
  height: number;
  takenAt: string;
  displayDate: string;
  alt: string;
};

export const posts: GeneratedPost[] = ${serializeForTypeScript(posts)};

export const books: CuratedBook[] = ${serializeForTypeScript(books)};

export const musics: CuratedMusicLink[] = ${serializeForTypeScript(musics)};

export const photos: GeneratedPhoto[] = ${serializeForTypeScript(photos)};
`;
}

function createGeneratedMusicLyricsModule(lyricsByYoutubeId) {
  return `/* This file is generated by scripts/generate-content.mjs. */
/* Edit content/musics/가사/가사.md instead of this file. */

export const MUSIC_LYRICS = Object.freeze(${serializeForTypeScript(
    lyricsByYoutubeId,
  )} as const);
`;
}

async function main() {
  await Promise.all([
    rm(postImagesDirectory, { recursive: true, force: true }),
    rm(galleryImagesDirectory, { recursive: true, force: true }),
    rm(katexFontsDestination, { recursive: true, force: true }),
  ]);

  const postFiles = await collectMarkdownFiles(postsDirectory);
  const posts = [];
  const slugs = new Set();

  for (const postFile of postFiles) {
    const post = await createPost(postFile);
    if (!post) {
      continue;
    }

    if (slugs.has(post.slug)) {
      throw new Error(`Duplicate post slug: ${post.slug}`);
    }

    slugs.add(post.slug);
    posts.push(post);
  }

  posts.sort(
    (left, right) =>
      right.sortDateTime.localeCompare(left.sortDateTime) ||
      left.title.localeCompare(right.title, "ko"),
  );
  posts.forEach((post) => {
    delete post.sortDateTime;
  });

  const [booksMarkdown, musicsMarkdown, musicLyricsMarkdown, photos] =
    await Promise.all([
      readFile(booksFile, "utf8"),
      readFile(musicsFile, "utf8"),
      readFile(musicLyricsFile, "utf8"),
      collectGalleryPhotos(),
    ]);
  const books = parseBooks(booksMarkdown);
  const musics = parseMusicLinks(musicsMarkdown);
  const { lyricsByYoutubeId, missingTracks } = parseMusicLyrics(
    musicLyricsMarkdown,
    musics,
  );
  await mkdir(dirname(generatedFile), { recursive: true });
  await mkdir(dirname(homeBackgroundDestination), { recursive: true });
  await Promise.all([
    copyFile(homeBackgroundSource, homeBackgroundDestination),
    prepareKaTeXAssets(),
  ]);
  await writeFile(
    generatedFile,
    createGeneratedModule(posts, books, musics, photos),
    "utf8",
  );
  await writeFile(
    generatedMusicLyricsFile,
    createGeneratedMusicLyricsModule(lyricsByYoutubeId),
    "utf8",
  );

  console.log(
    `Generated ${posts.length} posts, ${books.length} books, ${musics.length} music entries, and ${photos.length} photos.`,
  );
  console.log(
    `Prepared ${Object.values(lyricsByYoutubeId).filter((lyrics) => lyrics !== "-").length} lyrics and ${Object.values(lyricsByYoutubeId).filter((lyrics) => lyrics === "-").length} placeholders.`,
  );
  if (missingTracks.length > 0) {
    console.log(
      `No lyrics section found for: ${missingTracks
        .map((track) => `${track.artist} - ${track.title}`)
        .join(", ")}`,
    );
  }
  console.log(`Copied ${copiedImages.size} post images.`);
  console.log("Prepared the gallery, home background, and math fonts.");
  console.log(
    `Wrote ${relative(projectRoot, generatedFile)} and ${relative(
      projectRoot,
      generatedMusicLyricsFile,
    )}.`,
  );
}

await main();
