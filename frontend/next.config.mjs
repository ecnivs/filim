/** @type {import('next').NextConfig} */
const nextConfig = {

    experimental: {
        proxyTimeout: 180_000
    },
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "s4.anilist.co"
            },
            {
                protocol: "https",
                hostname: "api.allanime.day"
            },
            {
                protocol: "https",
                hostname: "cdn.myanimelist.net"
            }
        ]
    },
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: "http://127.0.0.1:8000/api/:path*"
            }
        ];
    }
};

export default nextConfig;

