'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

type BottomNavProps = {
  currentUserId: string | null
}

export default function BottomNav({
  currentUserId,
}: BottomNavProps) {
  const router = useRouter()

  const requireLogin = (path: string) => {
    if (!currentUserId) {
      alert('この機能を使うにはログインが必要です！')
      router.push('/auth')
      return
    }

    router.push(path)
  }

  const comingSoon = (name: string) => {
    alert(`${name}は現在開発中です！`)
  }

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        backgroundColor: '#1a1a1a',
        borderTop: '1px solid #2a2a2a',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '10px 0',
        zIndex: 90,
        boxShadow: '0 -4px 10px rgba(0,0,0,0.3)',
      }}
    >
      {/* ホーム */}
      <Link
        href="/"
        style={{
          ...navLinkStyle,
          color: '#ffda79',
          fontWeight: 'bold',
        }}
      >
        <span style={iconStyle}>🏠</span>
        <span>ホーム</span>
      </Link>

      {/* 探す */}
      <Link
        href="/find"
        style={{
          ...navLinkStyle,
          color: '#aaa',
        }}
      >
        <span style={iconStyle}>🔎</span>
        <span>探す</span>
      </Link>

      {/* 歌合 */}
      <button
        type="button"
        onClick={() => requireLogin('/utaawase')}
        style={navButtonStyle('#aaa')}
      >
        <span style={iconStyle}>⚔️</span>
        <span>歌合</span>
      </button>

      {/* 番付 */}
      <button
        type="button"
        onClick={() => comingSoon('番付')}
        style={navButtonStyle('#aaa')}
      >
        <span style={iconStyle}>🏆</span>
        <span>番付</span>
      </button>

      {/* 歌人録 */}
      <button
        type="button"
        onClick={() => {
          if (!currentUserId) {
            alert('歌人録を見るにはログインが必要です！')
            router.push('/auth')
            return
          }

          router.push(`/user/${currentUserId}`)
        }}
        style={navButtonStyle('#aaa')}
      >
        <span style={iconStyle}>👤</span>
        <span>歌人録</span>
      </button>
    </nav>
  )
}

const iconStyle = {
  fontSize: '1.15rem',
}

const navLinkStyle = {
  textDecoration: 'none',
  cursor: 'pointer',
  fontSize: '0.75rem',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: '3px',
  minWidth: '55px',
  padding: '2px',
}

const navButtonStyle = (color: string) => ({
  background: 'none',
  border: 'none',
  color,
  cursor: 'pointer',
  fontSize: '0.75rem',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: '3px',
  minWidth: '55px',
  padding: '2px',
})