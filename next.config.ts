import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['node:sqlite'],
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  turbopack: { root: process.cwd() },
};
export default config;
