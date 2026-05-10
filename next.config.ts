import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@openreel/core': path.resolve(__dirname, 'vendor/openreel/core/index.ts'),
      '@openreel/core/media': path.resolve(__dirname, 'vendor/openreel/core/media/index.ts'),
      '@openreel/core/storage/schema-types': path.resolve(
        __dirname,
        'vendor/openreel/core/storage/schema-types.ts',
      ),
      '@openreel/ui': path.resolve(__dirname, 'vendor/openreel/ui/index.ts'),
      '@openreel/ui/lib/utils': path.resolve(__dirname, 'vendor/openreel/ui/lib/utils.ts'),
      '@openreel/ui/components/toggle': path.resolve(__dirname, 'vendor/openreel/ui/components/toggle.tsx'),
      '@openreel/image-core': path.resolve(__dirname, 'vendor/openreel/image-core/index.ts'),
    }
    config.module.rules.push({
      test: /\.wgsl$/i,
      type: 'asset/source',
    })
    return config
  },
}

export default nextConfig
