import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  webpack(config, { isServer }) {
    if (isServer) {
      // Never bundle @vladmandic/human on the server — it's browser-only
      const externals = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [...externals, '@vladmandic/human'];
    } else {
      // For the browser bundle: force the ESM browser build (not human.node.js)
      config.resolve.alias['@vladmandic/human'] = path.resolve(
        './node_modules/@vladmandic/human/dist/human.esm.js'
      );
    }
    return config;
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: unsafe-inline/eval needed for Next.js dev
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' blob:", // blob: needed for @vladmandic/human WASM fetch
              "worker-src 'self' blob:",  // WASM web worker support
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // Permissions Policy (formerly Feature Policy)
          {
            key: 'Permissions-Policy',
            value: [
              'camera=(self)', // Required for face recognition
              'microphone=()',
              'geolocation=()',
              'payment=()',
              'usb=()',
            ].join(', '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;