/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  transpilePackages: ["@jobtracker/db", "@jobtracker/core"],
};

export default nextConfig;
