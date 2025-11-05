import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
});

export default withPWA({
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.freebaj.net",
        pathname: "/images/**",
      },
      // {
      //   protocol: "https",
      //   hostname: "thumnailfreebajpull.b-cdn.net",
      //   pathname: "/**",
      // },
      {
        protocol: "https",
        hostname: "r2.freebaj.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s3-alpha-sig.figma.com",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3004",
        pathname: "/images/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3006",
        pathname: "/**",
      }
    ],
    dangerouslyAllowSVG: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: 10 * 1024 * 1024,
    },
  },
});
