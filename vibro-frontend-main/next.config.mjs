// next.config.mjs
import withPWA from 'next-pwa'

let userConfig = {}
try {
  const imported = await import('./v0-user-next.config.js') // must be .js
  userConfig = imported.default || imported
} catch (e) {
  // Ignore error if file doesn't exist or fails to load
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: "standalone",
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
}

// Merge userConfig into nextConfig
mergeConfig(nextConfig, userConfig)

function mergeConfig(baseConfig, customConfig) {
  if (!customConfig) return

  for (const key in customConfig) {
    if (
      typeof baseConfig[key] === 'object' &&
      !Array.isArray(baseConfig[key])
    ) {
      baseConfig[key] = {
        ...baseConfig[key],
        ...customConfig[key],
      }
    } else {
      baseConfig[key] = customConfig[key]
    }
  }
}

// console.log(" process.env.NODE_ENV  ::",  process.env.NODE_ENV )
// ✅ Export with PWA disabled in development
export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)
