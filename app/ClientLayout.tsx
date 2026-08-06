'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      // refresh server components / data when auth state changes
      router.refresh()
    })

    return () => {
      // unsubscribe listener
      authListener?.subscription?.unsubscribe?.()
    }
  }, [router])

  const isAuthPage = pathname.startsWith('/auth')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: isAuthPage ? '0' : '70px' }}>
      <div style={{ flex: 1 }}>
        {children}
      </div>

      {!isAuthPage && (
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '65px',
          backgroundColor: '#181818',
          borderTop: '1px solid #2a2a2a',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 1000,
          boxShadow: '0 -4px 10px rgba(0,0,0,0.5)'
        }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'none',
              border: 'none',
              color: pathname === '/' ? '#ffda79' : '#888',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontWeight: pathname === '/' ? 'bold' : 'normal'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>📜</span>
            新着
          </button>

          <button
            onClick={() => router.push('/following')}
            style={{
              background: 'none',
              border: 'none',
              color: pathname === '/following' ? '#ffda79' : '#888',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontWeight: pathname === '/following' ? 'bold' : 'normal'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>👥</span>
            フォロー中
          </button>

          <button
            onClick={() => router.push('/utagoe')}
            style={{
              background: 'none',
              border: 'none',
              color: pathname === '/utagoe' ? '#ffda79' : '#888',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontWeight: pathname === '/utagoe' ? 'bold' : 'normal'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>⚔️</span>
            歌合
          </button>

          <button
            onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser()
              if (user) {
                router.push(`/user/${user.id}`)
              } else {
                router.push('/auth')
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: pathname.startsWith('/user') ? '#ffda79' : '#888',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontWeight: pathname.startsWith('/user') ? 'bold' : 'normal'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>👤</span>
            プロフィール
          </button>
        </nav>
      )}
    </div>
  )
}