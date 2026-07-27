import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveDeploymentId,
  STATIC_RSC_DIRECTORY,
} from "../build/deployment-id.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const clientRoot = join(projectRoot, "dist", "client");
const deploymentId = resolveDeploymentId();
const versionedRoot = join(
  clientRoot,
  STATIC_RSC_DIRECTORY,
  deploymentId,
);

async function findCanonicalRscFiles(directory) {
  const files = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      directory === clientRoot &&
      entry.name === STATIC_RSC_DIRECTORY
    ) {
      continue;
    }

    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findCanonicalRscFiles(absolutePath)));
    } else if (entry.isFile() && entry.name.endsWith(".rsc")) {
      files.push(absolutePath);
    }
  }

  return files;
}

const canonicalFiles = await findCanonicalRscFiles(clientRoot);

await Promise.all(
  canonicalFiles.map(async (sourcePath) => {
    const destinationPath = join(
      versionedRoot,
      relative(clientRoot, sourcePath),
    );
    await mkdir(dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }),
);

console.log(
  `Prepared ${canonicalFiles.length} versioned RSC files for ${deploymentId}.`,
);
