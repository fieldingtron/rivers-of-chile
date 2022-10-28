/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

//module.exports = nextConfig

module.exports = {
  reactStrictMode: true,
  env: {
    API_URL: process.env.API_URL,
  },
  images: {
    deviceSizes: [320, 420, 768, 1024, 1200],
    loader: 'default',
    domains: process.env.DOMAIN_URLS.split(','),
  },
}
