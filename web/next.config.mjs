import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  transpilePackages: ["@jobtracker/db", "@jobtracker/core"],
};

export default nextConfig;
