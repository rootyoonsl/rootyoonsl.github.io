import type { Plugin } from "vite";
import {
  resolveDeploymentId,
  STATIC_RSC_DIRECTORY,
} from "./deployment-id.js";

const VINEXT_BROWSER_ENTRY =
  "/vinext/dist/server/app-browser-entry.js";
const VINEXT_RSC_URL_HELPER =
  "/vinext/dist/server/app-rsc-cache-busting.js";

const INITIAL_CONTENT_TYPE_CHECK =
  'if (!contentType.startsWith("text/x-component"))';
const STATIC_INITIAL_CONTENT_TYPE_CHECK =
  'if (!isStaticRscResponse(rscResponse))';
const NAVIGATION_CONTENT_TYPE_CHECK =
  'const isRscResponse = (navResponse.headers.get("content-type") ?? "").startsWith("text/x-component");';
const STATIC_NAVIGATION_CONTENT_TYPE_CHECK =
  'const isRscResponse = isStaticRscResponse(navResponse, navResponseUrl ?? navResponse.url, rscUrl);';
const RSC_CONTENT_TYPE_HELPER = `function isStaticRscResponse(response, responseUrl = response.url, requestedUrl = response.url) {
\tconst contentType = response.headers.get("content-type") ?? "";
\tif (contentType.startsWith("text/x-component")) return true;
\tif (!contentType.startsWith("application/octet-stream")) return false;
\ttry {
\t\tconst expected = new URL(requestedUrl, window.location.origin);
\t\tconst actual = new URL(responseUrl || requestedUrl, window.location.origin);
\t\treturn expected.origin === window.location.origin && actual.origin === window.location.origin && expected.pathname.endsWith(".rsc") && actual.pathname.endsWith(".rsc");
\t} catch {
\t\treturn false;
\t}
}
`;

const RSC_PATH_RETURN =
  'return `${pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname}.rsc${query}`;';
const HARD_NAV_RESPONSE_CHECK = "if (responseUrl) {";

function staticRscPathReturn(deploymentId: string) {
  return `const normalizedPathname = pathname === "/" ? "/index" : pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
\treturn \`/${STATIC_RSC_DIRECTORY}/${deploymentId}\${normalizedPathname}.rsc\${query}\`;`;
}

function staticHardNavResponseCheck(deploymentId: string) {
  const versionedPrefix = `/${STATIC_RSC_DIRECTORY}/${deploymentId}/`;

  return `if (responseUrl && !new URL(responseUrl, window.location.origin).pathname.startsWith("${versionedPrefix}")) {`;
}

function normalizeModuleId(id: string) {
  return id.split("?", 1)[0].replaceAll("\\", "/");
}

function requireReplacement(
  source: string,
  search: string,
  replacement: string,
  label: string,
) {
  if (!source.includes(search)) {
    throw new Error(
      `[github-pages-static-compat] Vinext changed its ${label}. ` +
        "Review the GitHub Pages compatibility patch before deploying.",
    );
  }

  return source.replace(search, replacement);
}

/**
 * GitHub Pages serves generated `.rsc` files as application/octet-stream and
 * Vinext 0.0.50 otherwise falls back to a full document navigation. Pages also
 * exports the home payload as `/index.rsc`, while Vinext requests `/.rsc`.
 * Stable RSC paths are cached for ten minutes even when their query changes,
 * so every deployment receives a commit-specific pathname as well.
 *
 * Patch only the browser build: the local/server RSC pipeline keeps its native
 * content type and path handling.
 */
export function githubPagesStaticCompatibility(): Plugin {
  const deploymentId = resolveDeploymentId();

  return {
    name: "github-pages-static-compatibility",
    apply: "build",
    enforce: "pre",
    applyToEnvironment(environment) {
      return environment.name === "client";
    },
    transform(source, id) {
      const moduleId = normalizeModuleId(id);

      if (moduleId.endsWith(VINEXT_BROWSER_ENTRY)) {
        let patched = requireReplacement(
          source,
          "async function readInitialRscStream()",
          `${RSC_CONTENT_TYPE_HELPER}async function readInitialRscStream()`,
          "browser RSC bootstrap",
        );
        patched = requireReplacement(
          patched,
          INITIAL_CONTENT_TYPE_CHECK,
          STATIC_INITIAL_CONTENT_TYPE_CHECK,
          "initial RSC content-type check",
        );
        patched = requireReplacement(
          patched,
          NAVIGATION_CONTENT_TYPE_CHECK,
          STATIC_NAVIGATION_CONTENT_TYPE_CHECK,
          "navigation RSC content-type check",
        );
        patched = requireReplacement(
          patched,
          HARD_NAV_RESPONSE_CHECK,
          staticHardNavResponseCheck(deploymentId),
          "versioned RSC hard-navigation fallback",
        );

        return { code: patched, map: null };
      }

      if (moduleId.endsWith(VINEXT_RSC_URL_HELPER)) {
        return {
          code: requireReplacement(
            source,
            RSC_PATH_RETURN,
            staticRscPathReturn(deploymentId),
            "versioned RSC request path",
          ),
          map: null,
        };
      }

      return null;
    },
  };
}
