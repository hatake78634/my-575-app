'use client'

import Link from 'next/link'
import {
  usePathname,
  useRouter,
} from 'next/navigation'

type BottomNavProps = {
  currentUserId: string | null
}

export default function BottomNav({
  currentUserId,
}: BottomNavProps) {
  const router = useRouter()
  const pathname = usePathname()

  const requireLogin = (
    path: string
  ) => {
    if (!currentUserId) {
      alert(
        'この機能を使うにはログインが必要です！'
      )

      router.push('/auth')
      return
    }

    router.push(path)
  }

  const isActive = (
    path: string
  ) => {
    if (path === '/') {
      return pathname === '/'
    }

    return pathname.startsWith(
      path
    )
  }

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        backgroundColor: 'var(--nav-background)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '10px 0',
        zIndex: 90,
        boxShadow:
          '0 -4px 10px var(--shadow)',
      }}
    >
      {/* =====================
          ホーム
      ===================== */}

      <Link
        href="/"
        style={{
          ...navLinkStyle,

          color: isActive('/')
            ? 'var(--primary)'
            : 'var(--foreground-muted)',

          fontWeight: isActive('/')
            ? 'bold'
            : 'normal',
        }}
      >
        <span
          style={iconStyle}
        >
          🏠
        </span>

        <span>
          ホーム
        </span>
      </Link>

      {/* =====================
          探す
      ===================== */}

      <Link
        href="/find"
        style={{
          ...navLinkStyle,

          color: isActive(
            '/find'
          )
            ? 'var(--primary)'
            : 'var(--foreground-muted)',

          fontWeight: isActive(
            '/find'
          )
            ? 'bold'
            : 'normal',
        }}
      >
        <span
          style={iconStyle}
        >
          🔎
        </span>

        <span>
          探す
        </span>
      </Link>

      {/* =====================
          歌合
      ===================== */}

      <button
        type="button"
        onClick={() =>
          requireLogin(
            '/utaawase'
          )
        }
        style={navButtonStyle(
          isActive(
            '/utaawase'
          )
            ? 'var(--primary)'
            : 'var(--foreground-muted)'
        )}
      >
        <span
          style={iconStyle}
        >
          ⚔️
        </span>

        <span>
          歌合
        </span>
      </button>

      {/* =====================
          番付
      ===================== */}

      <Link
        href="/ranking"
        style={{
          ...navLinkStyle,

          color: isActive(
            '/ranking'
          )
            ? 'var(--primary)'
            : 'var(--foreground-muted)',

          fontWeight: isActive(
            '/ranking'
          )
            ? 'bold'
            : 'normal',
        }}
      >
        <span
          style={iconStyle}
        >
          🏆
        </span>

        <span>
          番付
        </span>
      </Link>

      {/* =====================
          歌人録
      ===================== */}

      <button
        type="button"
        onClick={() => {
          if (
            !currentUserId
          ) {
            alert(
              '歌人録を見るにはログインが必要です！'
            )

            router.push(
              '/auth'
            )

            return
          }

          router.push(
            `/user/${currentUserId}`
          )
        }}
        style={navButtonStyle(
          pathname.startsWith(
            '/user/'
          )
            ? 'var(--primary)'
            : 'var(--foreground-muted)'
        )}
      >
        <span
          style={iconStyle}
        >
          👤
        </span>

        <span>
          歌人録
        </span>
      </button>
    </nav>
  )
}

// =============================
// アイコン
// =============================

const iconStyle = {
  fontSize: '1.15rem',
}

// =============================
// Link用スタイル
// =============================

const navLinkStyle = {
  textDecoration: 'none',

  cursor: 'pointer',

  fontSize: '0.75rem',

  display: 'flex',

  flexDirection:
    'column' as const,

  alignItems: 'center',

  gap: '3px',

  minWidth: '55px',

  padding: '2px',
}

// =============================
// button用スタイル
// =============================

const navButtonStyle = (
  color: string
) => ({
  background: 'none',

  border: 'none',

  color,

  cursor: 'pointer',

  fontSize: '0.75rem',

  fontWeight:
    color === 'var(--primary)'
      ? 'bold'
      : 'normal',

  display: 'flex',

  flexDirection:
    'column' as const,

  alignItems: 'center',

  gap: '3px',

  minWidth: '55px',

  padding: '2px',
})
