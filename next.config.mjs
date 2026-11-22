/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // The piano samples (lib/pianoSamples.ts) never change in place: a
        // new set goes in a new folder (v2…), so browsers keep them a year.
        source: "/sounds/piano/v1/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
