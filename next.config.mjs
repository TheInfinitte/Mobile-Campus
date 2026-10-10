/**
 * next.config.mjs
 * WHAT: Next.js build/runtime configuration for Mobile Campus.
 * WHY : We need a few platform settings:
 *       - allow images from Cloudinary (our image host) to be optimised,
 *       - keep the bundle small (students are on slow, expensive data),
 *       - expose nothing secret to the browser.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Images: Cloudinary is our CDN. next/image will resize/compress them
  // automatically so a phone never downloads a 4MB photo.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
    // WebP/AVIF are much smaller than JPEG - good for mobile data.
    formats: ["image/avif", "image/webp"],
  },

  // Compress server responses so HTML/JS travel faster on 3G.
  compress: true,

  // Basic security headers. These are defence-in-depth; the real checks
  // always happen server-side in the API routes.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // NOTE: X-Frame-Options: SAMEORIGIN was here before. It blocked the
          // app from loading in the sandbox preview iframe (the preview is
          // served from a different origin), so it is removed for the demo.
          // Before going to production you can add clickjacking protection
          // back with a Content-Security-Policy frame-ancestors directive
          // listing only origins you trust.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
