'use client'

import {
  useEffect,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Avatar from './Avatar'
import { useEquippedAvatarFrame } from './ThemeProvider'

type HeaderProps = {
  userId: string | null
  userName: string | null
  userAvatar: string | null
}

export default function Header({
  userId,
  userName,
  userAvatar,
}: HeaderProps) {
  const router = useRouter()
  const equippedAvatarFrame = useEquippedAvatarFrame()

  const [unreadState, setUnreadState] =
    useState<{
      userId: string
      count: number
    } | null>(null)

  const unreadCount =
    unreadState?.userId === userId
      ? unreadState.count
      : 0

  useEffect(() => {
    if (!userId) {
      return
    }

    let cancelled = false

    const loadUnreadCount = async () => {
      const { data, error } =
        await supabase.rpc(
          'get_my_unread_notification_count'
        )

      if (error) {
        console.error(
          '未読通知数取得エラー:',
          error
        )
        return
      }

      if (!cancelled) {
        const count =
          typeof data === 'number'
            ? data
            : Number(data ?? 0)

        setUnreadState({
          userId,
          count: Number.isFinite(count)
            ? count
            : 0,
        })
      }
    }

    void loadUnreadCount()

    const interval =
      window.setInterval(
        () => {
          void loadUnreadCount()
        },
        15000
      )

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [userId])

  const handleLogout = async () => {
    const { error } =
      await supabase.auth.signOut()

    if (error) {
      console.error(
        'ログアウトエラー:',
        error
      )
      alert(
        'ログアウトに失敗しました'
      )
      return
    }

    window.location.href = '/'
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          'space-between',
        paddingBottom: '15px',
        marginBottom: '5px',
      }}
    >
      <div
        onClick={() => router.push('/')}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px',
        }}
      >
        <span
          style={{
            fontSize: '1.6rem',
            fontWeight: 'bold',
            letterSpacing: '2px',
          }}
        >
          詞花
        </span>

        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--foreground-muted)',
            letterSpacing: '2px',
          }}
        >
          ShiKa
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            alert(
              '検索機能は現在開発中です！'
            )
          }}
          aria-label="検索"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--foreground)',
            fontSize: '1.4rem',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          🔍
        </button>

        {userId && userName ? (
          <>
            <button
              type="button"
              onClick={() =>
                router.push(
                  '/notifications'
                )
              }
              aria-label={
                unreadCount > 0
                  ? `通知 ${unreadCount}件未読`
                  : '通知'
              }
              style={{
                position: 'relative',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'center',
                background: 'none',
                border: 'none',
                color: 'var(--foreground)',
                fontSize: '1.35rem',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              🔔

              {unreadCount > 0 && (
                <span
                  style={{
                    position:
                      'absolute',
                    top: '-2px',
                    right: '-5px',
                    minWidth: '17px',
                    height: '17px',
                    padding: '0 4px',
                    display: 'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    borderRadius:
                      '999px',
                    backgroundColor:
                      'var(--danger)',
                    color: 'var(--foreground)',
                    fontSize:
                      '0.6rem',
                    fontWeight:
                      'bold',
                    lineHeight: 1,
                    boxSizing:
                      'border-box',
                    border:
                      '2px solid var(--nav-background)',
                  }}
                >
                  {unreadCount > 99
                    ? '99+'
                    : unreadCount}
                </span>
              )}
            </button>

            {userAvatar ? (
              <Avatar
                src={userAvatar}
                name={userName}
                size={38}
                frame={equippedAvatarFrame}
                onClick={() =>
                  router.push(
                    `/user/${userId}`
                  )
                }
                style={{
                  cursor: 'pointer',
                  border:
                    '1px solid var(--border)',
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/user/${userId}`
                  )
                }
                aria-label="歌人録"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border:
                    '1px solid var(--border)',
                  backgroundColor:
                  'var(--surface)',
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                👤
              </button>
            )}

            <details
              style={{
                position: 'relative',
              }}
            >
              <summary
                style={{
                  listStyle: 'none',
                  cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                  fontSize: '1.3rem',
                  padding: '3px',
                }}
              >
                ⋮
              </summary>

              <div
                style={{
                  position:
                    'absolute',
                  top: '35px',
                  right: 0,
                  width: '150px',
                  backgroundColor:
                    'var(--surface-elevated)',
                  border:
                    '1px solid var(--border)',
                  borderRadius:
                    '10px',
                  padding: '8px',
                  boxShadow:
                    '0 6px 20px var(--shadow)',
                  zIndex: 300,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      '/profile'
                    )
                  }
                  style={
                    menuButtonStyle
                  }
                >
                  ⚙️ 設定
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    ...menuButtonStyle,
                    color:
                      'var(--danger)',
                  }}
                >
                  ↪ ログアウト
                </button>
              </div>
            </details>
          </>
        ) : (
          <button
            type="button"
            onClick={() =>
              router.push('/auth')
            }
            style={{
              backgroundColor:
                'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              padding:
                '8px 15px',
              borderRadius:
                '20px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize:
                '0.85rem',
            }}
          >
            ログイン
          </button>
        )}
      </div>
    </header>
  )
}

const menuButtonStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left' as const,
  background: 'none',
  border: 'none',
  color: 'var(--foreground)',
  padding: '10px',
  borderRadius: '7px',
  cursor: 'pointer',
  fontSize: '0.85rem',
}
