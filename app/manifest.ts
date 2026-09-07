import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '575／詩花',
    short_name: '詩花',
    description: '俳句と返歌、歌合を楽しむ和風SNS',
    start_url: '/',
    display: 'standalone',
    background_color: '#140d08',
    theme_color: '#140d08',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  }
}
