import type { NextConfig } from "next";
import { resolveDeploymentId } from "./build/deployment-id.js";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  generateBuildId: async () => resolveDeploymentId(),
};

export default nextConfig;
