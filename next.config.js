const fs = require('fs')
const path = require('path')

const domainUrls = (process.env.DOMAIN_URLS || '')
  .split(',')
  .map((domain) => domain.trim())
  .filter(Boolean)

const defaultApiUrl = 'https://wp.riversofchile.com/graphql'
const imageDomains = domainUrls.length ? domainUrls : ['wp.riversofchile.com']

let generatedRedirects = []
try {
  generatedRedirects = JSON.parse(fs.readFileSync(path.join(__dirname, 'scripts', 'redirects.json'), 'utf8'))
} catch (err) {
  console.warn('Could not load redirects.json', err.message)
}

module.exports = {
  reactStrictMode: true,
  env: {
    API_URL: process.env.API_URL || defaultApiUrl,
  },
  images: {
    deviceSizes: [320, 420, 768, 1024, 1200],
    loader: 'default',
    domains: imageDomains,
  },
  async redirects() {
    return generatedRedirects
  },
}
