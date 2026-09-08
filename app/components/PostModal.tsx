'use client'

import {
  FormEvent,
  KeyboardEvent,
  useState,
} from 'react'

type PostModalProps = {
  isOpen: boolean
  onClose: () => void

  // 後でpage.tsxから
  // 「今日あと何句勝負できるか」を渡す
  competitiveRemaining?: number

  onSubmit: (data: {
    firstLine: string
    secondLine: string
    thirdLine: string
    joshi: string
    description: string
    tags: string[]

    // 勝負句かどうか
    isCompetitive: boolean
  }) => Promise<void>
}

export default function PostModal({
  isOpen,
  onClose,
  onSubmit,
  competitiveRemaining = 3,
}: PostModalProps) {
  // =============================
  // 俳句
  // =============================

  const [firstLine, setFirstLine] =
    useState('')

  const [secondLine, setSecondLine] =
    useState('')

  const [thirdLine, setThirdLine] =
    useState('')

  const [joshi, setJoshi] =
    useState('')

  const [
    description,
    setDescription,
  ] = useState('')

  // =============================
  // 札
  // =============================

  const [tags, setTags] =
    useState<string[]>([])

  const [tagInput, setTagInput] =
    useState('')

  const [tagError, setTagError] =
    useState('')

  // =============================
  // 勝負句
  // =============================

  const [
    isCompetitive,
    setIsCompetitive,
  ] = useState(false)

  // =============================
  // 投稿中
  // =============================

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  if (!isOpen) {
    return null
  }

  // =============================
  // 文字数
  // =============================

  const firstLineLength =
    firstLine.length

  const secondLineLength =
    secondLine.length

  const thirdLineLength =
    thirdLine.length

  const firstLineError =
    firstLineLength === 0
      ? '1文字以上入力してください'
      : firstLineLength > 7
        ? '7文字以内にしてください'
        : ''

  const secondLineError =
    secondLineLength === 0
      ? '3文字以上入力してください'
      : secondLineLength < 3
        ? '3文字以上入力してください'
        : secondLineLength > 10
          ? '10文字以内にしてください'
          : ''

  const thirdLineError =
    thirdLineLength === 0
      ? '1文字以上入力してください'
      : thirdLineLength > 7
        ? '7文字以内にしてください'
        : ''

  const isSubmitValid =
    !firstLineError &&
    !secondLineError &&
    !thirdLineError

  // =============================
  // 今日、勝負句を出せるか
  // =============================

  const canUseCompetitive =
    competitiveRemaining > 0

  // =============================
  // 札を整える
  // =============================

  const normalizeTag = (
    value: string
  ) => {
    return value
      .trim()
      .replace(/^#+/, '')
      .replace(/\s+/g, '')
  }

  // =============================
  // 札追加
  // =============================

  const addTag = () => {
    setTagError('')

    const newTag =
      normalizeTag(tagInput)

    if (!newTag) {
      return
    }

    if (tags.length >= 4) {
      setTagError(
        '札は4枚までです'
      )
      return
    }

    if (
      tags.includes(newTag)
    ) {
      setTagError(
        '同じ札は付けられません'
      )
      return
    }

    if (
      newTag.length > 20
    ) {
      setTagError(
        '札は20文字以内にしてください'
      )
      return
    }

    setTags(
      (prev) => [
        ...prev,
        newTag,
      ]
    )

    setTagInput('')
  }

  // =============================
  // Enterで札追加
  // =============================

  const handleTagKeyDown = (
    e: KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      e.key === 'Enter'
    ) {
      e.preventDefault()
      addTag()
    }
  }

  // =============================
  // 札削除
  // =============================

  const removeTag = (
    tag: string
  ) => {
    setTags(
      (prev) =>
        prev.filter(
          (item) =>
            item !== tag
        )
    )

    setTagError('')
  }

  // =============================
  // 勝負句ON/OFF
  // =============================

  const toggleCompetitive =
    () => {
      if (
        !canUseCompetitive
      ) {
        alert(
          '今日の勝負句は3句すべて詠み終えています。'
        )

        return
      }

      setIsCompetitive(
        (prev) => !prev
      )
    }

  // =============================
  // 投稿
  // =============================

  const handleSubmit = async (
    e: FormEvent
  ) => {
    e.preventDefault()

    if (
      !isSubmitValid ||
      submitting
    ) {
      return
    }

    if (
      isCompetitive &&
      !canUseCompetitive
    ) {
      alert(
        '今日の勝負句は3句すべて詠み終えています。'
      )

      setIsCompetitive(false)
      return
    }

    setSubmitting(true)

    try {
      await onSubmit({
        firstLine,
        secondLine,
        thirdLine,
        joshi,
        description,
        tags,
        isCompetitive,
      })

      // =============================
      // 投稿成功後リセット
      // =============================

      setFirstLine('')
      setSecondLine('')
      setThirdLine('')
      setJoshi('')
      setDescription('')

      setTags([])
      setTagInput('')
      setTagError('')

      setIsCompetitive(false)

      onClose()
    } catch (error) {
      console.error(
        '投稿エラー:',
        error
      )

      alert(
        '投稿に失敗しました'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // =============================
  // 表示
  // =============================

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',

        backgroundColor:
          'var(--modal-backdrop)',

        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',

        zIndex: 200,

        padding: '20px',

        boxSizing:
          'border-box',
      }}
    >
      <div
        onClick={(e) =>
          e.stopPropagation()
        }
        style={{
          backgroundColor:
            '#1e1e1e',

          padding: '25px',

          borderRadius:
            '16px',

          width: '100%',
          maxWidth: '400px',

          maxHeight: '90vh',
          overflowY: 'auto',

          border:
            '1px solid #333',

          boxShadow:
            '0 8px 24px var(--shadow)',
        }}
      >
        {/* =====================
            上部
        ===================== */}

        <div
          style={{
            display: 'flex',

            justifyContent:
              'space-between',

            alignItems:
              'center',

            marginBottom:
              '20px',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize:
                '1.2rem',
            }}
          >
            一句詠む
          </h3>

          <button
            type="button"
            onClick={
              onClose
            }
            style={{
              background:
                'none',

              border:
                'none',

              color:
                '#aaa',

              fontSize:
                '1.2rem',

              cursor:
                'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
          style={{
            display: 'flex',

            flexDirection:
              'column',

            gap: '12px',
          }}
        >
          {/* =====================
              序詞
          ===================== */}

          <div>
            <label
              style={
                labelStyle
              }
            >
              序詞（任意）
            </label>

            <input
              type="text"

              placeholder="例：春風に誘われて"

              value={
                joshi
              }

              onChange={(e) =>
                setJoshi(
                  e.target.value
                )
              }

              style={
                inputStyle
              }
            />
          </div>

          {/* =====================
              初句
          ===================== */}

          <div>
            <input
              type="text"

              placeholder="初句（1〜7文字）"

              value={
                firstLine
              }

              onChange={(e) =>
                setFirstLine(
                  e.target.value
                )
              }

              maxLength={7}

              required

              style={
                inputStyle
              }
            />

            <CharacterCounter
              length={
                firstLineLength
              }
              max={7}
              error={
                firstLineError
              }
            />
          </div>

          {/* =====================
              二句
          ===================== */}

          <div>
            <input
              type="text"

              placeholder="二句（3〜10文字）"

              value={
                secondLine
              }

              onChange={(e) =>
                setSecondLine(
                  e.target.value
                )
              }

              maxLength={10}

              required

              style={
                inputStyle
              }
            />

            <CharacterCounter
              length={
                secondLineLength
              }
              max={10}
              error={
                secondLineError
              }
            />
          </div>

          {/* =====================
              三句
          ===================== */}

          <div>
            <input
              type="text"

              placeholder="三句（1〜7文字）"

              value={
                thirdLine
              }

              onChange={(e) =>
                setThirdLine(
                  e.target.value
                )
              }

              maxLength={7}

              required

              style={
                inputStyle
              }
            />

            <CharacterCounter
              length={
                thirdLineLength
              }
              max={7}
              error={
                thirdLineError
              }
            />
          </div>

          {/* =====================
              札
          ===================== */}

          <div
            style={{
              marginTop:
                '5px',
            }}
          >
            <div
              style={{
                display:
                  'flex',

                justifyContent:
                  'space-between',

                alignItems:
                  'center',

                marginBottom:
                  '8px',
              }}
            >
              <label
                style={{
                  ...labelStyle,

                  marginBottom:
                    0,
                }}
              >
                札（任意）
              </label>

              <span
                style={{
                  fontSize:
                    '0.75rem',

                  color:
                    tags.length ===
                    4
                      ? 'var(--primary)'
                      : '#777',
                }}
              >
                {tags.length}
                {' / '}
                4
              </span>
            </div>

            {/* 付けた札 */}

            {tags.length >
              0 && (
              <div
                style={{
                  display:
                    'flex',

                  flexWrap:
                    'wrap',

                  gap: '7px',

                  marginBottom:
                    '10px',
                }}
              >
                {tags.map(
                  (tag) => (
                    <button
                      key={
                        tag
                      }

                      type="button"

                      onClick={() =>
                        removeTag(
                          tag
                        )
                      }

                      title="この札を外す"

                      style={{
                        backgroundColor:
                          '#302d24',

                        color:
                          'var(--primary)',

                        border:
                          '1px solid #554d35',

                        borderRadius:
                          '20px',

                        padding:
                          '6px 10px',

                        cursor:
                          'pointer',

                        fontSize:
                          '0.8rem',
                      }}
                    >
                      {tag}　×
                    </button>
                  )
                )}
              </div>
            )}

            {/* 札入力 */}

            <div
              style={{
                display:
                  'flex',

                gap: '7px',
              }}
            >
              <input
                type="text"

                value={
                  tagInput
                }

                onChange={(e) => {
                  setTagInput(
                    e.target.value
                  )

                  setTagError(
                    ''
                  )
                }}

                onKeyDown={
                  handleTagKeyDown
                }

                placeholder={
                  tags.length >=
                  4
                    ? '札は4枚までです'
                    : '例：春、猫、夜'
                }

                maxLength={21}

                disabled={
                  tags.length >=
                  4
                }

                style={{
                  ...inputStyle,

                  flex: 1,

                  opacity:
                    tags.length >=
                    4
                      ? 0.5
                      : 1,
                }}
              />

              <button
                type="button"

                onClick={
                  addTag
                }

                disabled={
                  tags.length >=
                    4 ||
                  !tagInput.trim()
                }

                style={{
                  border:
                    'none',

                  borderRadius:
                    '8px',

                  padding:
                    '0 14px',

                  backgroundColor:
                    tags.length <
                      4 &&
                    tagInput.trim()
                      ? 'var(--primary)'
                      : '#444',

                  color:
                    tags.length <
                      4 &&
                    tagInput.trim()
                      ? 'var(--primary-foreground)'
                      : '#888',

                  fontWeight:
                    'bold',

                  cursor:
                    tags.length <
                      4 &&
                    tagInput.trim()
                      ? 'pointer'
                      : 'not-allowed',
                }}
              >
                追加
              </button>
            </div>

            {/* 札補足 */}

            <div
              style={{
                marginTop:
                  '7px',

                fontSize:
                  '0.75rem',
              }}
            >
              {tagError ? (
                <span
                  style={{
                    color:
                      '#ff6b6b',
                  }}
                >
                  {tagError}
                </span>
              ) : tags.length <
                4 ? (
                <span
                  style={{
                    color:
                      '#777',
                  }}
                >
                  あと
                  {4 -
                    tags.length}
                  枚の札を付けられます
                </span>
              ) : (
                <span
                  style={{
                    color:
                      'var(--primary)',
                  }}
                >
                  4枚の札が付いています
                </span>
              )}
            </div>
          </div>

          {/* =====================
              解説
          ===================== */}

          <div>
            <label
              style={
                labelStyle
              }
            >
              句に込めた想い・背景（任意）
            </label>

            <textarea
              placeholder="句に込めた想いや背景など..."

              value={
                description
              }

              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }

              rows={3}

              style={{
                ...inputStyle,

                resize:
                  'vertical',
              }}
            />
          </div>

          {/* =====================
              勝負の俳句
          ===================== */}

          <div
            style={{
              marginTop:
                '8px',

              padding:
                '14px',

              backgroundColor:
                isCompetitive
                  ? '#29251c'
                  : 'var(--surface)',

              border:
                isCompetitive
                  ? '1px solid #6b5a2e'
                  : '1px solid #333',

              borderRadius:
                '12px',
            }}
          >
            <button
              type="button"

              onClick={
                toggleCompetitive
              }

              disabled={
                !canUseCompetitive
              }

              style={{
                width: '100%',

                display:
                  'flex',

                justifyContent:
                  'space-between',

                alignItems:
                  'center',

                background:
                  'none',

                border:
                  'none',

                padding: 0,

                color:
                  canUseCompetitive
                    ? 'var(--foreground)'
                    : '#666',

                cursor:
                  canUseCompetitive
                    ? 'pointer'
                    : 'not-allowed',

                textAlign:
                  'left',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize:
                      '0.9rem',

                    fontWeight:
                      'bold',

                    color:
                      isCompetitive
                        ? 'var(--primary)'
                        : canUseCompetitive
                          ? 'var(--foreground)'
                          : '#666',
                  }}
                >
                  ⚔️ 勝負の俳句
                </div>

                <div
                  style={{
                    fontSize:
                      '0.72rem',

                    color:
                      '#888',

                    marginTop:
                      '4px',
                  }}
                >
                  今日あと
                  {' '}
                  {competitiveRemaining}
                  {' '}
                  句
                </div>
              </div>

              {/* スイッチ */}

              <div
                style={{
                  position:
                    'relative',

                  width:
                    '44px',

                  height:
                    '24px',

                  borderRadius:
                    '12px',

                  backgroundColor:
                    isCompetitive
                      ? 'var(--primary)'
                      : '#444',

                  transition:
                    '0.2s',

                  flexShrink:
                    0,
                }}
              >
                <div
                  style={{
                    position:
                      'absolute',

                    top:
                      '3px',

                    left:
                      isCompetitive
                        ? '23px'
                        : '3px',

                    width:
                      '18px',

                    height:
                      '18px',

                    borderRadius:
                      '50%',

                    backgroundColor:
                      isCompetitive
                        ? 'var(--primary-foreground)'
                        : '#aaa',

                    transition:
                      '0.2s',
                  }}
                />
              </div>
            </button>

            {/* 勝負句をONにした本人だけ表示 */}

            {isCompetitive && (
              <div
                style={{
                  marginTop:
                    '12px',

                  paddingTop:
                    '12px',

                  borderTop:
                    '1px solid #443c29',

                  fontSize:
                    '0.76rem',

                  lineHeight:
                    '1.7',

                  color:
                    '#c9bea0',
                }}
              >
                <div
                  style={{
                    color:
                      'var(--primary)',

                    fontWeight:
                      'bold',

                    marginBottom:
                      '5px',
                  }}
                >
                  この一句で番付に挑みます
                </div>

                投稿から48時間の雅によって、
                番付レートが変動します。

                <br />

                勝負句であること・雅の基準・
                残り時間は他の歌人には表示されません。
              </div>
            )}

            {!canUseCompetitive && (
              <div
                style={{
                  marginTop:
                    '10px',

                  fontSize:
                    '0.75rem',

                  color:
                    '#888',
                }}
              >
                今日の勝負句3句をすべて詠み終えています。
              </div>
            )}
          </div>

          {/* =====================
              投稿
          ===================== */}

          <button
            type="submit"

            disabled={
              !isSubmitValid ||
              submitting
            }

            style={{
              marginTop:
                '10px',

              padding:
                '12px',

              borderRadius:
                '8px',

              backgroundColor:
                isCompetitive
                  ? '#e7c665'
                  : 'var(--primary)',

              color:
                'var(--primary-foreground)',

              fontWeight:
                'bold',

              border:
                'none',

              cursor:
                isSubmitValid &&
                !submitting
                  ? 'pointer'
                  : 'not-allowed',

              opacity:
                isSubmitValid &&
                !submitting
                  ? 1
                  : 0.6,
            }}
          >
            {submitting
              ? '詠んでいます...'
              : isCompetitive
                ? 'この句で勝負する'
                : 'この句を詠む'}
          </button>
        </form>
      </div>
    </div>
  )
}

// =============================
// 文字数表示
// =============================

type CharacterCounterProps = {
  length: number
  max: number
  error: string
}

function CharacterCounter({
  length,
  max,
  error,
}: CharacterCounterProps) {
  return (
    <div
      style={{
        display: 'flex',

        justifyContent:
          'space-between',

        marginTop:
          '6px',

        fontSize:
          '0.8rem',
      }}
    >
      <span
        style={{
          color:
            '#aaa',
        }}
      >
        {length}/{max}文字
      </span>

      <span
        style={{
          color:
            error
              ? '#ff6b6b'
              : 'transparent',
        }}
      >
        {error || ' '}
      </span>
    </div>
  )
}

// =============================
// 共通スタイル
// =============================

const labelStyle = {
  fontSize:
    '0.8rem',

  color:
    '#aaa',

  display:
    'block',

  marginBottom:
    '4px',
}

const inputStyle = {
  width:
    '100%',

  boxSizing:
    'border-box' as const,

  padding:
    '10px',

  borderRadius:
    '8px',

  border:
    '1px solid #444',

  backgroundColor:
    'var(--border)',

  color:
    'var(--foreground)',

  outline:
    'none',
}
