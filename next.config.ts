/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'stickershop.line-scdn.net', // โดเมนที่เก็บสติกเกอร์ของ LINE
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;