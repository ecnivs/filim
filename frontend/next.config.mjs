/** @type {import('next').NextConfig} */
const nextConfig = {
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
                destination: "http://localhost:8000/api/:path*"
            }
        ];
    }
};

export default nextConfig;

