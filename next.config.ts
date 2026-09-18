import { fileURLToPath } from 'node:url'
import withBundleAnalyzer from '@next/bundle-analyzer'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['192.168.100.4'],
  turbopack: {
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
}

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
})(nextConfig)
