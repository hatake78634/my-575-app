'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import {
  supabase,
} from '../../lib/supabase'

import BottomNav from '../components/BottomNav'
import Avatar from '../components/Avatar'
import {
  useAuth,
} from '../hooks/useAuth'


type NotificationType =
  | 'haiku_like'
  | 'follow'
  | 'mutual_follow'
  | 'utaawase_invite'

type NotificationTab =
  | 'like'
  | 'follow'
  | 'utaawase'

type NotificationRow = {
  notification_id: string

  type:
    NotificationType

  actor_user_id:
    string | null

  actor_username:
    string | null

  actor_avatar_url:
    string | null

  haiku_id:
    string | null

  room_id:
    string | null

  room_name:
    string | null

  invite_id:
    string | null

  invite_status:
    string | null

  is_read:
    boolean

  created_at:
    string
}

type NotificationLoadData = {
  status: 'success' | 'error'
  notifications: NotificationRow[]
  errorText: string
}

type NotificationLoadResult =
  NotificationLoadData & {
    requestId: number
    targetUserId: string
  }


export default function NotificationsPage() {
  const router =
    useRouter()

  const {
    userId,
    loading:
      authLoading,
  } = useAuth()

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<NotificationTab>(
      'like'
    )

  const [
    notifications,
    setNotifications,
  ] =
    useState<NotificationRow[]>([])

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    errorText,
    setErrorText,
  ] =
    useState('')

  const [
    processingInviteId,
    setProcessingInviteId,
  ] =
    useState<string | null>(
      null
    )

  const notificationRequestIdRef =
    useRef(0)

  const notificationRequestsRef =
    useRef<
      Map<
        string,
        Promise<NotificationLoadData>
      >
    >(new Map())

  const [
    loadedNotificationsUserId,
    setLoadedNotificationsUserId,
  ] = useState<
    string | null | undefined
  >(undefined)

  const notificationsLoading =
    loading ||
    loadedNotificationsUserId !== userId


  // =============================
  // 通知取得
  // =============================

  const loadNotifications =
    useCallback(async (
      targetUserId: string
    ): Promise<NotificationLoadResult> => {
      const requestId =
        ++notificationRequestIdRef.current

      let request =
        notificationRequestsRef.current.get(
          targetUserId
        )

      if (!request) {
        request = (async () => {
          try {
            const {
              data,
              error,
            } =
              await supabase.rpc(
                'get_my_notifications'
              )

            if (error) {
              console.error(
                '通知取得エラー:',
                error
              )

              return {
                status: 'error',
                notifications: [],
                errorText:
                  error.message ||
                  '通知を取得できませんでした',
              }
            }

            const notifications =
              Array.isArray(data)
                ? (
                    data as NotificationRow[]
                  )
                : []

            const {
              error:
                readError,
            } =
              await supabase.rpc(
                'mark_my_notifications_read'
              )

            if (readError) {
              console.error(
                '通知既読エラー:',
                readError
              )
            }

            return {
              status: 'success',
              notifications,
              errorText: '',
            }
          } catch (error) {
            console.error(
              '通知取得処理エラー:',
              error
            )

            return {
              status: 'error',
              notifications: [],
              errorText:
                '通知を取得できませんでした',
            }
          }
        })()

        notificationRequestsRef.current.set(
          targetUserId,
          request
        )
      }

      try {
        const data = await request

        return {
          ...data,
          requestId,
          targetUserId,
        }
      } finally {
        if (
          notificationRequestsRef.current.get(
            targetUserId
          ) === request
        ) {
          notificationRequestsRef.current.delete(
            targetUserId
          )
        }
      }
    }, [])

  const applyNotificationLoadResult =
    useCallback((
      result: NotificationLoadResult
    ) => {
      if (
        result.requestId !==
        notificationRequestIdRef.current
      ) {
        return
      }

      if (result.status === 'success') {
        setNotifications(
          result.notifications
        )
        setErrorText('')
      } else {
        setNotifications([])
        setErrorText(result.errorText)
      }

      setLoadedNotificationsUserId(
        result.targetUserId
      )
      setLoading(false)
    }, [])


  // =============================
  // 初回
  // =============================

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!userId) {
      ++notificationRequestIdRef.current

      router.replace(
        '/auth'
      )

      return
    }

    void loadNotifications(
      userId
    ).then((result) => {
      applyNotificationLoadResult(
        result
      )
    })
  }, [
    applyNotificationLoadResult,
    authLoading,
    loadNotifications,
    router,
    userId,
  ])


  // =============================
  // タブ別通知
  // =============================

  const filteredNotifications =
    useMemo(
      () => {
        if (
          activeTab ===
          'like'
        ) {
          return notifications.filter(
            (item) =>
              item.type ===
              'haiku_like'
          )
        }

        if (
          activeTab ===
          'follow'
        ) {
          return notifications.filter(
            (item) =>
              item.type ===
                'follow' ||
              item.type ===
                'mutual_follow'
          )
        }

        return notifications.filter(
          (item) =>
            item.type ===
            'utaawase_invite'
        )
      },
      [
        activeTab,
        notifications,
      ]
    )


  // =============================
  // 招待承諾
  // =============================

  const handleAcceptInvite =
    async (
      inviteId: string
    ) => {
      if (
        processingInviteId
      ) {
        return
      }

      setProcessingInviteId(
        inviteId
      )

      try {
        const {
          error,
        } =
          await supabase.rpc(
            'accept_friend_utaawase_invite',
            {
              p_invite_id:
                inviteId,
            }
          )

        if (error) {
          alert(
            error.message ||
              '歌合に参加できませんでした'
          )

          return
        }

        if (userId) {
          setLoading(true)
          setErrorText('')

          await loadNotifications(
            userId
          ).then((result) => {
            applyNotificationLoadResult(
              result
            )
          })
        }
      } catch (error) {
        console.error(
          '招待承諾エラー:',
          error
        )

        alert(
          '歌合に参加できませんでした'
        )
      } finally {
        setProcessingInviteId(
          null
        )
      }
    }


  // =============================
  // 招待辞退
  // =============================

  const handleDeclineInvite =
    async (
      inviteId: string
    ) => {
      if (
        processingInviteId
      ) {
        return
      }

      setProcessingInviteId(
        inviteId
      )

      try {
        const {
          error,
        } =
          await supabase.rpc(
            'decline_friend_utaawase_invite',
            {
              p_invite_id:
                inviteId,
            }
          )

        if (error) {
          alert(
            error.message ||
              '招待を辞退できませんでした'
          )

          return
        }

        if (userId) {
          setLoading(true)
          setErrorText('')

          await loadNotifications(
            userId
          ).then((result) => {
            applyNotificationLoadResult(
              result
            )
          })
        }
      } catch (error) {
        console.error(
          '招待辞退エラー:',
          error
        )

        alert(
          '招待を辞退できませんでした'
        )
      } finally {
        setProcessingInviteId(
          null
        )
      }
    }


  // =============================
  // 通知文
  // =============================

  const getNotificationText =
    (
      item:
        NotificationRow
    ) => {
      const actor =
        item.actor_username ||
        '名無し'

      if (
        item.type ===
        'haiku_like'
      ) {
        return `${actor}さんがあなたの句に雅を贈りました`
      }

      if (
        item.type ===
        'follow'
      ) {
        return `${actor}さんの贔屓に追加されました`
      }

      if (
        item.type ===
        'mutual_follow'
      ) {
        return `${actor}さんと歌友になりました`
      }

      const roomName =
        item.room_name ||
        'フレンド歌合'

      return `${actor}さんから「${roomName}」に招待されました`
    }


  // =============================
  // 日時
  // =============================

  const formatDate =
    (
      value: string
    ) => {
      const date =
        new Date(value)

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return ''
      }

      return date.toLocaleString(
        'ja-JP',
        {
          month:
            'numeric',
          day:
            'numeric',
          hour:
            '2-digit',
          minute:
            '2-digit',
        }
      )
    }


  // =============================
  // 読み込み
  // =============================

  if (
    authLoading ||
    notificationsLoading
  ) {
    return (
      <FullScreenMessage
        text="通知を集めています…"
      />
    )
  }


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
            ヘッダー
        ===================== */}

        <header
          style={{
            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'space-between',

            gap:
              '12px',

            marginBottom:
              '22px',
          }}
        >
          <div>
            <div
              style={{
                color:
                  'var(--foreground-muted)',

                fontSize:
                  '0.72rem',

                marginBottom:
                  '5px',
              }}
            >
              ShiKa
            </div>

            <h1
              style={{
                margin: 0,

                fontSize:
                  '1.55rem',

                letterSpacing:
                  '0.05em',
              }}
            >
              🔔 通知
            </h1>
          </div>

          <button
            type="button"

            onClick={() =>
              router.push('/')
            }

            style={
              backButtonStyle
            }
          >
            ホームへ
          </button>
        </header>


        {/* =====================
            タブ
        ===================== */}

        <div
          style={
            tabsStyle
          }
        >
          <TabButton
            active={
              activeTab ===
              'like'
            }

            onClick={() =>
              setActiveTab(
                'like'
              )
            }

            label="雅"
          />

          <TabButton
            active={
              activeTab ===
              'follow'
            }

            onClick={() =>
              setActiveTab(
                'follow'
              )
            }

            label="贔屓・歌友"
          />

          <TabButton
            active={
              activeTab ===
              'utaawase'
            }

            onClick={() =>
              setActiveTab(
                'utaawase'
              )
            }

            label="歌合"
          />
        </div>


        {/* =====================
            エラー
        ===================== */}

        {errorText && (
          <div
            style={
              errorStyle
            }
          >
            {errorText}

            <button
              type="button"

              onClick={() => {
                if (!userId) {
                  return
                }

                setLoading(true)
                setErrorText('')

                void loadNotifications(
                  userId
                ).then((result) => {
                  applyNotificationLoadResult(
                    result
                  )
                })
              }}

              style={{
                ...secondaryButtonStyle,

                marginTop:
                  '12px',
              }}
            >
              もう一度読み込む
            </button>
          </div>
        )}


        {/* =====================
            空
        ===================== */}

        {!errorText &&
          filteredNotifications
            .length ===
            0 && (
          <section
            style={{
              ...cardStyle,

              textAlign:
                'center',

              padding:
                '46px 20px',
            }}
          >
            <div
              style={{
                fontSize:
                  '2rem',

                marginBottom:
                  '12px',
              }}
            >
              {activeTab ===
              'like'
                ? '🌸'
                : activeTab ===
                    'follow'
                  ? '🤝'
                  : '⚔️'}
            </div>

            <div
              style={{
                fontWeight:
                  'bold',

                marginBottom:
                  '7px',
              }}
            >
              まだ通知はありません
            </div>

            <div
              style={{
                color:
                  'var(--foreground-muted)',

                fontSize:
                  '0.76rem',

                lineHeight:
                  '1.7',
              }}
            >
              {activeTab ===
              'like'
                ? 'あなたの句に届いた雅がここに表示されます。'
                : activeTab ===
                    'follow'
                  ? '贔屓や歌友に関する通知がここに表示されます。'
                  : 'フレンド歌合への招待がここに表示されます。'}
            </div>
          </section>
        )}


        {/* =====================
            通知一覧
        ===================== */}

        {!errorText &&
          filteredNotifications
            .length >
            0 && (
          <div
            style={{
              display:
                'flex',

              flexDirection:
                'column',

              gap:
                '10px',
            }}
          >
            {filteredNotifications.map(
              (
                item
              ) => (
                <NotificationCard
                  key={
                    item.notification_id
                  }

                  item={
                    item
                  }

                  text={
                    getNotificationText(
                      item
                    )
                  }

                  dateText={
                    formatDate(
                      item.created_at
                    )
                  }

                  processing={
                    processingInviteId ===
                    item.invite_id
                  }

                  onActorClick={() => {
                    if (
                      item.actor_user_id
                    ) {
                      router.push(
                        `/user/${item.actor_user_id}`
                      )
                    }
                  }}

                  onAccept={() => {
                    if (
                      item.invite_id
                    ) {
                      void handleAcceptInvite(
                        item.invite_id
                      )
                    }
                  }}

                  onDecline={() => {
                    if (
                      item.invite_id
                    ) {
                      void handleDeclineInvite(
                        item.invite_id
                      )
                    }
                  }}
                />
              )
            )}
          </div>
        )}
      </main>

      <BottomNav
        currentUserId={
          userId
        }
      />
    </div>
  )
}


function TabButton({
  active,
  onClick,
  label,
}: {
  active:
    boolean

  onClick:
    () => void

  label:
    string
}) {
  return (
    <button
      type="button"

      onClick={
        onClick
      }

      style={{
        flex: 1,

        border:
          'none',

        borderBottom:
          active
            ? '2px solid var(--primary)'
            : '2px solid transparent',

        background:
          'none',

        color:
          active
            ? 'var(--primary)'
            : 'var(--foreground-muted)',

        padding:
          '11px 5px',

        fontSize:
          '0.74rem',

        fontWeight:
          active
            ? 'bold'
            : 'normal',

        cursor:
          'pointer',
      }}
    >
      {label}
    </button>
  )
}


function NotificationCard({
  item,
  text,
  dateText,
  processing,
  onActorClick,
  onAccept,
  onDecline,
}: {
  item:
    NotificationRow

  text:
    string

  dateText:
    string

  processing:
    boolean

  onActorClick:
    () => void

  onAccept:
    () => void

  onDecline:
    () => void
}) {
  const isPendingInvite =
    item.type ===
      'utaawase_invite' &&
    item.invite_status ===
      'pending'

  return (
    <section
      style={{
        ...cardStyle,

        display:
          'flex',

        gap:
          '12px',

        backgroundColor:
          item.is_read
            ? 'var(--surface)'
            : 'var(--surface-elevated)',

        border:
          item.is_read
            ? '1px solid var(--border)'
            : '1px solid var(--border)',
      }}
    >
      {/* アイコン */}

      <button
        type="button"

        onClick={
          onActorClick
        }

        disabled={
          !item.actor_user_id
        }

        style={{
          width:
            '42px',

          height:
            '42px',

          padding:
            0,

          borderRadius:
            '50%',

          border:
            '1px solid var(--border)',

          overflow:
            'hidden',

          flexShrink:
            0,

          backgroundColor:
            'var(--surface-elevated)',

          color:
            'var(--foreground-muted)',

          cursor:
            item.actor_user_id
              ? 'pointer'
              : 'default',

          display:
            'flex',

          alignItems:
            'center',

          justifyContent:
            'center',
        }}
      >
        {item.actor_avatar_url ? (
          <Avatar
            src={
              item.actor_avatar_url
            }

            name={item.actor_username}

            size={42}
          />
        ) : (
          <span>
            👤
          </span>
        )}
      </button>


      {/* 本文 */}

      <div
        style={{
          minWidth:
            0,

          flex:
            1,
        }}
      >
        <div
          style={{
            color:
              'var(--foreground)',

            fontSize:
              '0.82rem',

            lineHeight:
              '1.65',

            wordBreak:
              'break-word',
          }}
        >
          {text}
        </div>

        <div
          style={{
            color:
              'var(--foreground-muted)',

            fontSize:
              '0.65rem',

            marginTop:
              '5px',
          }}
        >
          {dateText}
        </div>


        {/* 歌合招待 */}

        {item.type ===
          'utaawase_invite' && (
          <div
            style={{
              marginTop:
                '12px',
            }}
          >
            {isPendingInvite ? (
              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    '1fr 1fr',

                  gap:
                    '8px',
                }}
              >
                <button
                  type="button"

                  onClick={
                    onAccept
                  }

                  disabled={
                    processing
                  }

                  style={{
                    ...primaryButtonStyle,

                    opacity:
                      processing
                        ? 0.5
                        : 1,

                    cursor:
                      processing
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {processing
                    ? '処理中…'
                    : '参加する'}
                </button>

                <button
                  type="button"

                  onClick={
                    onDecline
                  }

                  disabled={
                    processing
                  }

                  style={{
                    ...secondaryButtonStyle,

                    opacity:
                      processing
                        ? 0.5
                        : 1,

                    cursor:
                      processing
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  辞退する
                </button>
              </div>
            ) : (
              <div
                style={{
                  color:
                    item.invite_status ===
                    'accepted'
                      ? 'var(--success)'
                      : 'var(--foreground-muted)',

                  fontSize:
                    '0.72rem',

                  fontWeight:
                    'bold',
                }}
              >
                {item.invite_status ===
                'accepted'
                  ? '参加済み'
                  : item.invite_status ===
                      'declined'
                    ? '辞退済み'
                    : '受付終了'}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}


function FullScreenMessage({
  text,
}: {
  text:
    string
}) {
  return (
    <div
      style={{
        minHeight:
          '100vh',

        backgroundColor:
          'var(--page-background)',

        color:
          'var(--foreground-muted)',

        display:
          'flex',

        alignItems:
          'center',

        justifyContent:
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


const pageStyle = {
  minHeight:
    '100vh',

  backgroundColor:
    'var(--page-background)',

  color:
    'var(--foreground)',

  paddingBottom:
    '100px',
}

const mainStyle = {
  width:
    '100%',

  maxWidth:
    '600px',

  margin:
    '0 auto',

  padding:
    '20px',

  boxSizing:
    'border-box' as const,
}

const tabsStyle = {
  display:
    'flex',

  borderBottom:
    '1px solid var(--border)',

  marginBottom:
    '18px',
}

const cardStyle = {
  backgroundColor:
    'var(--surface)',

  border:
    '1px solid var(--border)',

  borderRadius:
    '14px',

  padding:
    '14px',
}

const primaryButtonStyle = {
  width:
    '100%',

  border:
    'none',

  borderRadius:
    '9px',

  padding:
    '10px',

  backgroundColor:
    'var(--primary)',

  color:
    'var(--page-background)',

  fontWeight:
    'bold',

  fontSize:
    '0.75rem',

  cursor:
    'pointer',
}

const secondaryButtonStyle = {
  width:
    '100%',

  border:
    '1px solid var(--border)',

  borderRadius:
    '9px',

  padding:
    '10px',

  backgroundColor:
    'var(--surface-elevated)',

  color:
    'var(--foreground)',

  fontWeight:
    'bold',

  fontSize:
    '0.75rem',

  cursor:
    'pointer',
}

const backButtonStyle = {
  border:
    '1px solid var(--border)',

  borderRadius:
    '8px',

  backgroundColor:
    'var(--surface)',

  color:
    'var(--foreground-muted)',

  padding:
    '7px 10px',

  cursor:
    'pointer',

  fontSize:
    '0.7rem',
}

const errorStyle = {
  backgroundColor:
    'color-mix(in srgb, var(--danger) 16%, var(--surface))',

  border:
    '1px solid color-mix(in srgb, var(--danger) 55%, var(--border))',

  color:
    'var(--danger)',

  padding:
    '13px',

  borderRadius:
    '10px',

  marginBottom:
    '14px',

  fontSize:
    '0.76rem',

  lineHeight:
    '1.6',
}
