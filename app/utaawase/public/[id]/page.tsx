'use client'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  useParams,
  useRouter,
} from 'next/navigation'
import Image from 'next/image'

import {
  supabase,
} from '@/lib/supabase'


// =============================
// 型
// =============================

type LobbyMember = {
  room_id: string
  room_name: string | null
  room_status: string

  host_user_id: string
  host_username: string

  member_user_id: string
  member_username: string
  member_avatar_url: string | null

  current_players: number
  max_players: number

  is_host: boolean
  can_start: boolean
}


// =============================
// 公開歌合 待機室
// =============================

export default function PublicUtaawaseLobbyPage() {
  const router = useRouter()

  const params =
    useParams()

  const roomId =
    params.id as string


  const [members, setMembers] =
    useState<LobbyMember[]>([])

  const [loading, setLoading] =
    useState(true)

  const [starting, setStarting] =
    useState(false)

  const [leaving, setLeaving] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)


  // =============================
  // 代表データ
  // =============================

  const lobby =
    members.length > 0
      ? members[0]
      : null


  // =============================
  // 待機室取得
  // =============================

  const loadLobby =
    useCallback(
      async () => {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            'get_public_utaawase_lobby',
            {
              p_room_id:
                roomId,
            }
          )

        if (error) {
          throw error
        }

        const rows =
          (data || []) as LobbyMember[]


        // =========================
        // ホストが開始したら
        // 全員本戦へ移動
        // =========================

        if (
          rows.length > 0 &&
          (
            rows[0].room_status ===
              'writing' ||
            rows[0].room_status ===
              'rating'
          )
        ) {
          router.replace(
            `/utaawase/${roomId}`
          )

          return
        }


        // =========================
        // finishedになっていた場合も
        // 本戦側へ
        // =========================

        if (
          rows.length > 0 &&
          rows[0].room_status ===
            'finished'
        ) {
          router.replace(
            `/utaawase/${roomId}`
          )

          return
        }


        // =========================
        // 閉幕済み
        // =========================

        if (
          rows.length > 0 &&
          rows[0].room_status ===
            'closed'
        ) {
          router.replace(
            '/utaawase/public'
          )

          return
        }


        setMembers(
          rows
        )
      },
      [
        roomId,
        router,
      ]
    )


  // =============================
  // 初回取得
  // =============================

  useEffect(() => {
    let cancelled =
      false

    const initialize =
      async () => {
        try {
          setLoading(true)

          setError(null)

          await loadLobby()
        } catch (err) {
          console.error(err)

          if (!cancelled) {
            setError(
              getErrorMessage(
                err
              )
            )
          }
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      }

    initialize()

    return () => {
      cancelled =
        true
    }
  }, [
    loadLobby,
  ])


  // =============================
  // 2秒ごとに人数・状態更新
  // =============================

  useEffect(() => {
    if (loading) {
      return
    }

    const interval =
      window.setInterval(
        () => {
          loadLobby().catch(
            (err) => {
              console.error(
                err
              )
            }
          )
        },
        2000
      )

    return () => {
      window.clearInterval(
        interval
      )
    }
  }, [
    loading,
    loadLobby,
  ])


  // =============================
  // ホストが開始
  // =============================

  const handleStart =
    async () => {
      if (
        starting ||
        !lobby ||
        !lobby.is_host ||
        !lobby.can_start
      ) {
        return
      }

      try {
        setStarting(true)

        setError(null)

        const {
          error,
        } =
          await supabase.rpc(
            'start_public_utaawase_room',
            {
              p_room_id:
                roomId,
            }
          )

        if (error) {
          throw error
        }

        router.replace(
          `/utaawase/${roomId}`
        )
      } catch (err) {
        console.error(err)

        setError(
          getErrorMessage(
            err
          )
        )

        try {
          await loadLobby()
        } catch (
          reloadError
        ) {
          console.error(
            reloadError
          )
        }
      } finally {
        setStarting(false)
      }
    }


  // =============================
  // 一般参加者：待機室から退出
  // =============================

  const handleLeave =
    async () => {
      if (
        leaving ||
        !lobby ||
        lobby.is_host
      ) {
        return
      }

      const confirmed =
        window.confirm(
          'この公開歌合の待機室から退出しますか？'
        )

      if (!confirmed) {
        return
      }

      try {
        setLeaving(true)
        setError(null)

        const { error } =
          await supabase.rpc(
            'leave_public_utaawase_room',
            {
              p_room_id:
                roomId,
            }
          )

        if (error) {
          throw error
        }

        router.replace(
          '/utaawase/public'
        )
      } catch (err) {
        console.error(err)

        setError(
          getErrorMessage(
            err
          )
        )

        setLeaving(false)
      }
    }


  // =============================
  // ホスト：募集取り消し
  // =============================

  const handleCancel =
    async () => {
      if (
        leaving ||
        !lobby ||
        !lobby.is_host
      ) {
        return
      }

      const confirmed =
        window.confirm(
          'この公開歌合の募集を取り消しますか？\n\n開始前なので歌合チケットは返却されます。'
        )

      if (!confirmed) {
        return
      }

      try {
        setLeaving(true)
        setError(null)

        const { error } =
          await supabase.rpc(
            'cancel_public_utaawase_room',
            {
              p_room_id:
                roomId,
            }
          )

        if (error) {
          throw error
        }

        router.replace(
          '/utaawase/public'
        )
      } catch (err) {
        console.error(err)

        setError(
          getErrorMessage(
            err
          )
        )

        setLeaving(false)
      }
    }


  // =============================
  // ロード中
  // =============================

  if (loading) {
    return (
      <FullScreenMessage
        text="待機室を開いています…"
      />
    )
  }


  // =============================
  // エラーで情報なし
  // =============================

  if (
    !lobby &&
    error
  ) {
    return (
      <div
        style={
          pageStyle
        }
      >
        <main
          style={
            mainStyle
          }
        >
          <section
            style={
              cardStyle
            }
          >
            <div
              style={{
                color:
                  '#ffaaaa',

                lineHeight:
                  '1.8',

                marginBottom:
                  '18px',
              }}
            >
              {error}
            </div>

            <button
              type="button"

              onClick={() =>
                router.replace(
                  '/utaawase/public'
                )
              }

              style={
                secondaryButtonStyle
              }
            >
              公開歌合へ戻る
            </button>
          </section>
        </main>
      </div>
    )
  }


  // =============================
  // データなし
  // =============================

  if (!lobby) {
    return (
      <FullScreenMessage
        text="歌合が見つかりません"
      />
    )
  }


  const playersNeeded =
    Math.max(
      3 -
        lobby.current_players,
      0
    )


  // =============================
  // 本体
  // =============================

  return (
    <div
      style={
        pageStyle
      }
    >
      <main
        style={
          mainStyle
        }
      >
        {/* =====================
            上部
        ===================== */}

        <header
          style={{
            textAlign:
              'center',

            marginBottom:
              '28px',
          }}
        >
          <div
            style={{
              color:
                '#a99e7f',

              fontSize:
                '0.72rem',

              marginBottom:
                '7px',
            }}
          >
            一般公開
          </div>

          <h1
            style={{
              margin: 0,

              fontSize:
                '1.7rem',

              letterSpacing:
                '0.08em',

              lineHeight:
                '1.5',
            }}
          >
            ⚔️ {
              lobby.room_name ||
              '公開歌合'
            }
          </h1>

          <div
            style={{
              color:
                '#777',

              fontSize:
                '0.72rem',

              marginTop:
                '8px',
            }}
          >
            主催：
            {
              lobby.host_username
            }
          </div>
        </header>


        {/* =====================
            人数
        ===================== */}

        <section
          style={{
            ...cardStyle,

            textAlign:
              'center',

            marginBottom:
              '14px',
          }}
        >
          <div
            style={{
              color:
                '#777',

              fontSize:
                '0.7rem',

              marginBottom:
                '5px',
            }}
          >
            現在の参加者
          </div>

          <div
            style={{
              fontSize:
                '2rem',

              fontWeight:
                'bold',

              color:
                lobby.current_players >=
                3
                  ? '#9ed89e'
                  : '#fff',
            }}
          >
            {
              lobby.current_players
            }
            <span
              style={{
                color:
                  '#666',

                fontSize:
                  '1rem',

                margin:
                  '0 5px',
              }}
            >
              /
            </span>
            {
              lobby.max_players
            }
            <span
              style={{
                fontSize:
                  '0.8rem',

                marginLeft:
                  '4px',

                color:
                  '#777',
              }}
            >
              人
            </span>
          </div>


          {/* ゲージ */}

          <div
            style={{
              height:
                '6px',

              backgroundColor:
                '#292929',

              borderRadius:
                '999px',

              overflow:
                'hidden',

              margin:
                '18px 0 12px',
            }}
          >
            <div
              style={{
                height:
                  '100%',

                width:
                  `${
                    (
                      lobby.current_players /
                      lobby.max_players
                    ) *
                    100
                  }%`,

                backgroundColor:
                  '#ffda79',

                transition:
                  'width 0.25s ease',
              }}
            />
          </div>


          <div
            style={{
              color:
                lobby.current_players >=
                3
                  ? '#9ed89e'
                  : '#999',

              fontSize:
                '0.76rem',
            }}
          >
            {lobby.current_players >=
            3
              ? '歌合を開始できます'
              : `あと ${playersNeeded} 人で開始できます`}
          </div>
        </section>


        {/* =====================
            エラー
        ===================== */}

        {error && (
          <div
            style={
              errorStyle
            }
          >
            {error}
          </div>
        )}


        {/* =====================
            参加者一覧
        ===================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              '14px',
          }}
        >
          <div
            style={{
              color:
                '#888',

              fontSize:
                '0.72rem',

              marginBottom:
                '13px',

              fontWeight:
                'bold',
            }}
          >
            参加者
          </div>

          <div
            style={{
              display:
                'grid',

              gap:
                '8px',
            }}
          >
            {members.map(
              (
                member
              ) => {
                const memberIsHost =
                  member.member_user_id ===
                  lobby.host_user_id

                return (
                  <div
                    key={
                      member.member_user_id
                    }

                    style={{
                      display:
                        'flex',

                      alignItems:
                        'center',

                      gap:
                        '11px',

                      padding:
                        '10px',

                      borderRadius:
                        '10px',

                      backgroundColor:
                        '#171717',

                      border:
                        memberIsHost
                          ? '1px solid #4a4020'
                          : '1px solid #292929',
                    }}
                  >
                    {/* アイコン */}

                    <div
                      style={{
                        width:
                          '38px',

                        height:
                          '38px',

                        borderRadius:
                          '50%',

                        overflow:
                          'hidden',

                        backgroundColor:
                          '#292929',

                        display:
                          'flex',

                        justifyContent:
                          'center',

                        alignItems:
                          'center',

                        flexShrink:
                          0,
                      }}
                    >
                      {member.member_avatar_url ? (
                        <Image
                          src={
                            member.member_avatar_url
                          }

                          alt=""

                          width={44}

                          height={44}

                          unoptimized

                          style={{
                            width:
                              '100%',

                            height:
                              '100%',

                            objectFit:
                              'cover',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            color:
                              '#777',
                          }}
                        >
                          👤
                        </span>
                      )}
                    </div>


                    {/* 名前 */}

                    <div
                      style={{
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          fontWeight:
                            'bold',

                          fontSize:
                            '0.86rem',
                        }}
                      >
                        {
                          member.member_username
                        }
                      </div>

                      {memberIsHost && (
                        <div
                          style={{
                            color:
                              '#ffda79',

                            fontSize:
                              '0.62rem',

                            marginTop:
                              '3px',
                          }}
                        >
                          👑 主催者
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
            )}


            {/* 空き枠 */}

            {Array.from({
              length:
                Math.max(
                  lobby.max_players -
                    lobby.current_players,
                  0
                ),
            }).map(
              (
                _,
                index
              ) => (
                <div
                  key={
                    `empty-${index}`
                  }

                  style={{
                    padding:
                      '12px',

                    borderRadius:
                      '10px',

                    border:
                      '1px dashed #292929',

                    color:
                      '#555',

                    fontSize:
                      '0.72rem',

                    textAlign:
                      'center',
                  }}
                >
                  参加者を待っています…
                </div>
              )
            )}
          </div>
        </section>


        {/* =====================
            ホスト
        ===================== */}

        {lobby.is_host ? (
          <section
            style={
              cardStyle
            }
          >
            <div
              style={{
                color:
                  '#ffda79',

                fontWeight:
                  'bold',

                fontSize:
                  '0.8rem',

                marginBottom:
                  '10px',
              }}
            >
              👑 あなたが主催者です
            </div>

            <div
              style={{
                color:
                  '#888',

                fontSize:
                  '0.72rem',

                lineHeight:
                  '1.7',

                marginBottom:
                  '15px',
              }}
            >
              3人以上集まったら、
              好きなタイミングで
              歌合を始められます。
              <br />

              開始すると30分の
              開催時間が始まります。
            </div>

            <button
              type="button"

              onClick={
                handleStart
              }

              disabled={
                !lobby.can_start ||
                starting
              }

              style={{
                ...primaryButtonStyle,

                opacity:
                  lobby.can_start &&
                  !starting
                    ? 1
                    : 0.45,

                cursor:
                  lobby.can_start &&
                  !starting
                    ? 'pointer'
                    : 'not-allowed',
              }}
            >
              {starting
                ? '歌合を始めています…'
                : lobby.can_start
                  ? '⚔️ 歌合を始める'
                  : `あと ${playersNeeded} 人必要です`}
            </button>

            <button
              type="button"

              onClick={
                handleCancel
              }

              disabled={
                starting ||
                leaving
              }

              style={{
                ...dangerButtonStyle,

                marginTop:
                  '10px',

                opacity:
                  starting ||
                  leaving
                    ? 0.45
                    : 1,

                cursor:
                  starting ||
                  leaving
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {leaving
                ? '募集を取り消しています…'
                : '募集を取り消す'}
            </button>
          </section>
        ) : (
          <section
            style={{
              ...cardStyle,

              textAlign:
                'center',
            }}
          >
            <div
              style={{
                fontSize:
                  '1.3rem',

                marginBottom:
                  '10px',
              }}
            >
              🌙
            </div>

            <div
              style={{
                fontWeight:
                  'bold',

                fontSize:
                  '0.82rem',

                marginBottom:
                  '7px',
              }}
            >
              開始を待っています
            </div>

            <div
              style={{
                color:
                  '#777',

                fontSize:
                  '0.72rem',

                lineHeight:
                  '1.7',
              }}
            >
              主催者が歌合を開始すると、
              自動的に作句画面へ移動します。
            </div>

            <button
              type="button"

              onClick={
                handleLeave
              }

              disabled={
                leaving
              }

              style={{
                ...secondaryButtonStyle,

                marginTop:
                  '16px',

                opacity:
                  leaving
                    ? 0.45
                    : 1,

                cursor:
                  leaving
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {leaving
                ? '退出しています…'
                : '待機室から退出する'}
            </button>
          </section>
        )}


        <div
          style={{
            textAlign:
              'center',

            color:
              '#555',

            fontSize:
              '0.65rem',

            marginTop:
              '18px',
          }}
        >
          待機室は自動で更新されます
        </div>
      </main>
    </div>
  )
}


// =============================
// エラー文字列
// =============================

function getErrorMessage(
  err: unknown
) {
  if (
    typeof err ===
      'object' &&
    err !== null &&
    'message' in err
  ) {
    const message =
      (
        err as {
          message?: unknown
        }
      ).message

    if (
      typeof message ===
      'string'
    ) {
      return message
    }
  }

  return 'エラーが発生しました'
}


// =============================
// 全画面メッセージ
// =============================

function FullScreenMessage({
  text,
}: {
  text: string
}) {
  return (
    <div
      style={{
        minHeight:
          '100vh',

        backgroundColor:
          '#121212',

        color:
          '#888',

        display:
          'flex',

        justifyContent:
          'center',

        alignItems:
          'center',

        padding:
          '20px',

        boxSizing:
          'border-box',
      }}
    >
      {text}
    </div>
  )
}


// =============================
// styles
// =============================

const pageStyle = {
  minHeight:
    '100vh',

  backgroundColor:
    '#121212',

  color:
    '#fff',

  paddingBottom:
    '70px',
}

const mainStyle = {
  width:
    '100%',

  maxWidth:
    '560px',

  margin:
    '0 auto',

  padding:
    '24px 18px',

  boxSizing:
    'border-box' as const,
}

const cardStyle = {
  backgroundColor:
    '#1c1c1c',

  border:
    '1px solid #303030',

  borderRadius:
    '15px',

  padding:
    '17px',
}

const primaryButtonStyle = {
  width:
    '100%',

  border:
    'none',

  borderRadius:
    '10px',

  padding:
    '14px',

  backgroundColor:
    '#ffda79',

  color:
    '#111',

  fontWeight:
    'bold',

  fontSize:
    '0.88rem',

  cursor:
    'pointer',
}

const secondaryButtonStyle = {
  width:
    '100%',

  border:
    '1px solid #444',

  borderRadius:
    '10px',

  padding:
    '12px',

  backgroundColor:
    '#252525',

  color:
    '#eee',

  fontWeight:
    'bold',

  cursor:
    'pointer',
}

const dangerButtonStyle = {
  width:
    '100%',

  border:
    '1px solid #633',

  borderRadius:
    '10px',

  padding:
    '12px',

  backgroundColor:
    '#2c1818',

  color:
    '#ffaaaa',

  fontWeight:
    'bold',

  fontSize:
    '0.82rem',

  cursor:
    'pointer',
}

const errorStyle = {
  backgroundColor:
    '#2c1818',

  border:
    '1px solid #633',

  color:
    '#ffaaaa',

  padding:
    '12px',

  borderRadius:
    '10px',

  marginBottom:
    '14px',

  fontSize:
    '0.76rem',

  lineHeight:
    '1.6',
}
