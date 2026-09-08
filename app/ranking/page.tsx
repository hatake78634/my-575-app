'use client'

import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '../../lib/supabase'
import BottomNav from '../components/BottomNav'
import { useAuth } from '../hooks/useAuth'

// =============================
// 型
// =============================

type RankingProfile = {
  id: string
  username: string | null
  avatar_url: string | null
  rating: number | null
}

type RankingLoadResult = {
  requestId: number
  targetUserId: string | null
  status: 'success' | 'error'
  profiles: RankingProfile[]
}

type RankInfo = {
  name: string
  min: number
  nextMin: number | null
}

// =============================
// レート → 位
// =============================

function getRankInfo(
  rating: number
): RankInfo {
  if (rating < 1100) {
    return {
      name: '初花',
      min: 1000,
      nextMin: 1100,
    }
  }

  if (rating < 1250) {
    return {
      name: '若葉',
      min: 1100,
      nextMin: 1250,
    }
  }

  if (rating < 1450) {
    return {
      name: '詠士',
      min: 1250,
      nextMin: 1450,
    }
  }

  if (rating < 1700) {
    return {
      name: '詠匠',
      min: 1450,
      nextMin: 1700,
    }
  }

  if (rating < 2000) {
    return {
      name: '歌豪',
      min: 1700,
      nextMin: 2000,
    }
  }

  return {
    name: '歌聖',
    min: 2000,
    nextMin: null,
  }
}

// =============================
// 位ごとの記号
// =============================

function getRankSymbol(
  rank: string
) {
  if (rank === '初花') {
    return '🌸'
  }

  if (rank === '若葉') {
    return '🌿'
  }

  if (rank === '詠士') {
    return '🖌️'
  }

  if (rank === '詠匠') {
    return '📜'
  }

  if (rank === '歌豪') {
    return '🔥'
  }

  return '✨'
}

// =============================
// ページ
// =============================

export default function RankingPage() {
  const router = useRouter()

  const {
    userId,
    loading: authLoading,
  } = useAuth()

  const [
    profiles,
    setProfiles,
  ] = useState<RankingProfile[]>([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const rankingRequestIdRef =
    useRef(0)

  const [
    loadedRankingUserId,
    setLoadedRankingUserId,
  ] = useState<
    string | null | undefined
  >(undefined)

  const rankingLoading =
    loading ||
    loadedRankingUserId !== userId

  // =============================
  // 番付取得
  // =============================

  const loadRanking = useCallback(async (
    targetUserId: string | null
  ): Promise<RankingLoadResult> => {
    const requestId =
      ++rankingRequestIdRef.current

    try {
      const {
        data,
        error,
      } = await supabase
        .from('profiles_3')
        .select(
          'id, username, avatar_url, rating'
        )
        .order(
          'rating',
          {
            ascending: false,
          }
        )

      if (error) {
        console.error(
          '番付取得エラー:',
          error
        )

        return {
          requestId,
          targetUserId,
          status: 'error',
          profiles: [],
        }
      }

      const list =
        (data ?? []).map(
          (profile) => ({
            ...profile,

            rating:
              typeof profile.rating ===
              'number'
                ? profile.rating
                : 1000,
          })
        ) as RankingProfile[]

      return {
        requestId,
        targetUserId,
        status: 'success',
        profiles: list,
      }
    } catch (error) {
      console.error(
        '番付取得処理エラー:',
        error
      )
      return {
        requestId,
        targetUserId,
        status: 'error',
        profiles: [],
      }
    }
  }, [])

  const applyRankingResult =
    useCallback((
      result: RankingLoadResult
    ) => {
      if (
        result.requestId !==
        rankingRequestIdRef.current
      ) {
        return
      }

      if (result.status === 'success') {
        setProfiles(result.profiles)
      } else {
        setProfiles([])
      }

      setLoadedRankingUserId(
        result.targetUserId
      )
      setLoading(false)
    }, [])

  // =============================
  // 初回取得
  // =============================

  useEffect(() => {
    if (authLoading) {
      return
    }

    void loadRanking(
      userId
    ).then((result) => {
      applyRankingResult(result)
    })
  }, [
    applyRankingResult,
    authLoading,
    loadRanking,
    userId,
  ])

  // =============================
  // 自分
  // =============================

  const myProfile =
    useMemo(() => {
      if (!userId) {
        return null
      }

      return (
        profiles.find(
          (profile) =>
            String(profile.id) ===
            String(userId)
        ) ?? null
      )
    }, [
      profiles,
      userId,
    ])

  // =============================
  // 自分の順位
  // =============================

  const myPosition =
    useMemo(() => {
      if (!userId) {
        return null
      }

      const index =
        profiles.findIndex(
          (profile) =>
            String(profile.id) ===
            String(userId)
        )

      if (index === -1) {
        return null
      }

      return index + 1
    }, [
      profiles,
      userId,
    ])

  // =============================
  // ローディング
  // =============================

  if (
    rankingLoading ||
    authLoading
  ) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--page-background)',
          color: 'var(--foreground-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        番付を開いています...
      </div>
    )
  }

  // =============================
  // 表示
  // =============================

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--page-background)',
        color: 'var(--foreground)',
        paddingBottom: '100px',
      }}
    >
      <main
        style={{
          width: '100%',
          maxWidth: '600px',
          margin: '0 auto',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        {/* =====================
            タイトル
        ===================== */}

        <div
          style={{
            marginBottom: '24px',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '1.5rem',
              marginBottom: '7px',
            }}
          >
            🏆 番付
          </h1>

          <p
            style={{
              margin: 0,
              color: 'var(--foreground-muted)',
              fontSize: '0.8rem',
              lineHeight: '1.7',
            }}
          >
            勝負の俳句や歌合で腕を競い、
            <br />
            高みを目指しましょう。
          </p>
        </div>

        {/* =====================
            自分の番付
        ===================== */}

        {myProfile && (
          <MyRankingCard
            profile={myProfile}
            position={myPosition}
          />
        )}

        {/* =====================
            位一覧
        ===================== */}

        <section
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '15px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontWeight: 'bold',
              fontSize: '0.9rem',
              marginBottom: '12px',
            }}
          >
            位階
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '7px',
            }}
          >
            {[
              '初花',
              '若葉',
              '詠士',
              '詠匠',
              '歌豪',
              '歌聖',
            ].map(
              (rank) => (
                <div
                  key={rank}
                  style={{
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '20px',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                    color: 'var(--foreground)',
                  }}
                >
                  {getRankSymbol(rank)}
                  {' '}
                  {rank}
                </div>
              )
            )}
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border)',
              marginTop: '13px',
              paddingTop: '12px',
              color: 'var(--foreground-muted)',
              fontSize: '0.76rem',
              lineHeight: '1.7',
            }}
          >
            👑 <strong>歌仙</strong>は位階とは異なる特別称号です。
            三十六の席のみが存在します。
          </div>
        </section>

        {/* =====================
            ランキングタイトル
        ===================== */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'end',
            marginBottom: '10px',
          }}
        >
          <div
            style={{
              fontWeight: 'bold',
              fontSize: '1rem',
            }}
          >
            全歌人
          </div>

          <div
            style={{
              color: 'var(--foreground-muted)',
              fontSize: '0.72rem',
            }}
          >
            {profiles.length}人
          </div>
        </div>

        {/* =====================
            番付一覧
        ===================== */}

        {profiles.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--foreground-muted)',
              padding: '50px 20px',
            }}
          >
            まだ番付に歌人はいません。
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {profiles.map(
              (
                profile,
                index
              ) => (
                <RankingRow
                  key={profile.id}
                  profile={profile}
                  position={index + 1}
                  isMe={
                    String(profile.id) ===
                    String(userId)
                  }
                  onClick={() =>
                    router.push(
                      `/user/${profile.id}`
                    )
                  }
                />
              )
            )}
          </div>
        )}
      </main>

      <BottomNav
        currentUserId={userId}
      />
    </div>
  )
}

// =============================
// 自分の番付カード
// =============================

function MyRankingCard({
  profile,
  position,
}: {
  profile: RankingProfile
  position: number | null
}) {
  const rating =
    profile.rating ?? 1000

  const rank =
    getRankInfo(rating)

  const progress =
    rank.nextMin
      ? Math.min(
          Math.max(
            (
              (rating -
                rank.min) /
              (
                rank.nextMin -
                rank.min
              )
            ) *
              100,
            0
          ),
          100
        )
      : 100

  const remaining =
    rank.nextMin
      ? Math.max(
          rank.nextMin -
            rating,
          0
        )
      : null

  return (
    <section
      style={{
        backgroundColor: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '18px',
        marginBottom: '18px',
        boxShadow:
          '0 4px 15px var(--shadow)',
      }}
    >
      <div
        style={{
          color: 'var(--foreground-muted)',
          fontSize: '0.75rem',
          marginBottom: '8px',
        }}
      >
        あなたの番付
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'end',
          gap: '10px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '1.45rem',
              fontWeight: 'bold',
              color: 'var(--primary)',
            }}
          >
            {getRankSymbol(
              rank.name
            )}
            {' '}
            {rank.name}
          </div>

          <div
            style={{
              color: 'var(--foreground-muted)',
              fontSize: '0.8rem',
              marginTop: '4px',
            }}
          >
            {position
              ? `第${position}位`
              : '順位なし'}
          </div>
        </div>

        <div
          style={{
            textAlign: 'right',
          }}
        >
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
            }}
          >
            {rating}
          </div>

          <div
            style={{
              color: 'var(--foreground-muted)',
              fontSize: '0.7rem',
            }}
          >
            rating
          </div>
        </div>
      </div>

      {/* 進捗 */}

      {rank.nextMin ? (
        <>
          <div
            style={{
              height: '6px',
              backgroundColor: 'var(--surface-elevated)',
              borderRadius: '10px',
              overflow: 'hidden',
              marginTop: '16px',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: 'var(--primary)',
                borderRadius: '10px',
              }}
            />
          </div>

          <div
            style={{
              marginTop: '7px',
              color: 'var(--foreground-muted)',
              fontSize: '0.73rem',
              textAlign: 'right',
            }}
          >
            次の位まであと
            {' '}
            <strong
              style={{
                color: 'var(--foreground)',
              }}
            >
              {remaining}
            </strong>
          </div>
        </>
      ) : (
        <div
          style={{
            marginTop: '14px',
            color: 'var(--foreground-muted)',
            fontSize: '0.76rem',
          }}
        >
          位階の最高位に到達しています。
        </div>
      )}
    </section>
  )
}

// =============================
// ランキング1行
// =============================

function RankingRow({
  profile,
  position,
  isMe,
  onClick,
}: {
  profile: RankingProfile
  position: number
  isMe: boolean
  onClick: () => void
}) {
  const rating =
    profile.rating ?? 1000

  const rank =
    getRankInfo(rating)

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        backgroundColor: isMe
          ? 'var(--surface-elevated)'
          : 'var(--surface)',
        border: isMe
          ? '1px solid var(--border)'
          : '1px solid var(--border)',
        borderRadius: '12px',
        padding: '12px',
        color: 'var(--foreground)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '11px',
        textAlign: 'left',
      }}
    >
      {/* 順位 */}

      <div
        style={{
          width: '34px',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize:
            position <= 3
              ? '1rem'
              : '0.85rem',
          color:
            position <= 3
              ? 'var(--primary)'
              : 'var(--foreground-muted)',
          flexShrink: 0,
        }}
      >
        {position <= 3
          ? ['🥇', '🥈', '🥉'][
              position - 1
            ]
          : position}
      </div>

      {/* アイコン */}

      {profile.avatar_url ? (
        <Image
          src={profile.avatar_url}
          alt={`${profile.username ?? '歌人'}のアイコン`}
          width={42}
          height={42}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
          unoptimized
        />
      ) : (
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'var(--surface-elevated)',
            flexShrink: 0,
          }}
        />
      )}

      {/* 名前 */}

      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontWeight: 'bold',
            fontSize: '0.9rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {profile.username ??
            '名無し'}

          {isMe && (
            <span
              style={{
                color: 'var(--primary)',
                fontSize: '0.68rem',
                marginLeft: '6px',
              }}
            >
              あなた
            </span>
          )}
        </div>

        <div
          style={{
            color: 'var(--foreground-muted)',
            fontSize: '0.73rem',
            marginTop: '3px',
          }}
        >
          {getRankSymbol(
            rank.name
          )}
          {' '}
          {rank.name}
        </div>
      </div>

      {/* rating */}

      <div
        style={{
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontWeight: 'bold',
            fontSize: '0.95rem',
          }}
        >
          {rating}
        </div>

        <div
          style={{
            color: 'var(--foreground-muted)',
            fontSize: '0.65rem',
          }}
        >
          rating
        </div>
      </div>
    </button>
  )
}
