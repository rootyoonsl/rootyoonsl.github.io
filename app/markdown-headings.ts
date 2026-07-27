export type MarkdownHeading = Readonly<{
  id: string;
  level: number;
  text: string;
}>;

function cleanHeadingText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/gu, "$1")
    .replace(/`([^`]*)`/gu, "$1")
    .replace(/[*_~]/gu, "")
    .replace(/\\([\\`*{}[\]()#+\-.!_>])/gu, "$1")
    .trim();
}

export function markdownHeadingId(lineNumber: number): string {
  return `article-section-${lineNumber}`;
}

export function extractMarkdownHeadings(
  content: string,
): readonly MarkdownHeading[] {
  const lines = content.split(/\r?\n/u);
  const headings: MarkdownHeading[] = [];
  let activeFence: { character: string; length: number } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = /^[ \t]{0,3}(`{3,}|~{3,})/u.exec(line);

    if (fence) {
      const character = fence[1][0];
      const length = fence[1].length;
      if (!activeFence) {
        activeFence = { character, length };
      } else if (
        activeFence.character === character &&
        length >= activeFence.length
      ) {
        activeFence = null;
      }
      continue;
    }

    if (activeFence) continue;

    const atxHeading = /^[ \t]{0,3}(#{1,6})(?:[ \t]+|$)(.*)$/u.exec(line);
    if (atxHeading) {
      const text = cleanHeadingText(
        atxHeading[2].replace(/[ \t]+#+[ \t]*$/u, ""),
      );
      if (text) {
        const lineNumber = index + 1;
        headings.push({
          id: markdownHeadingId(lineNumber),
          level: atxHeading[1].length,
          text,
        });
      }
      continue;
    }

    const setextUnderline = /^[ \t]{0,3}(=+|-+)[ \t]*$/u.exec(
      lines[index + 1] ?? "",
    );
    const text = cleanHeadingText(line);
    if (text && setextUnderline) {
      const lineNumber = index + 1;
      headings.push({
        id: markdownHeadingId(lineNumber),
        level: setextUnderline[1][0] === "=" ? 1 : 2,
        text,
      });
      index += 1;
    }
  }

  return headings;
}
