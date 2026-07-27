export const STATIC_RSC_DIRECTORY = "rsc-data";

/**
 * Keep the browser bundle, exported RSC copies, and Vinext build metadata on
 * one deployment identifier. GitHub Actions always provides GITHUB_SHA; local
 * production builds use a stable fallback.
 */
export function resolveDeploymentId(environment = process.env) {
  const rawId =
    environment.YOONSL_DEPLOYMENT_ID ??
    environment.GITHUB_SHA ??
    "local";
  const safeId = rawId
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return safeId || "local";
}
