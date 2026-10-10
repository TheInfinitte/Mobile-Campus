/**
 * postcss.config.js
 * WHAT: Tells the build tool (PostCSS) to run Tailwind and add browser
 *       prefixes automatically.
 * WHY : Next.js needs this file to turn our Tailwind classes into real CSS.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
