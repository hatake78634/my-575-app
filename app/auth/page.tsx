'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function AuthPage() {
  const router = useRouter()

  const [isSignUp, setIsSignUp] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    setErrorMessage(null)
    setLoading(true)

    try {
      // =========================
      // 新規登録
      // =========================
      if (isSignUp) {
        const finalUsername =
          username.trim() || email.split('@')[0]

        const {
          data: authData,
          error: signUpError,
        } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: finalUsername,
            },
          },
        })

        if (signUpError) {
          setErrorMessage(signUpError.message)
          return
        }

        if (!authData.user) {
          setErrorMessage(
            'ユーザー情報を取得できませんでした。'
          )
          return
        }

        // プロフィール作成
        const {
          error: profileError,
        } = await supabase
          .from('profiles_3')
          .upsert({
            id: authData.user.id,
            username: finalUsername,
            avatar_url: '',
            updated_at: new Date().toISOString(),
          })

        if (profileError) {
          console.error(
            'プロフィール作成エラー:',
            profileError
          )

          setErrorMessage(
            'アカウントは作成されましたが、プロフィールの作成に失敗しました。'
          )

          return
        }

        // メール確認が必要な設定の場合
        if (!authData.session) {
          alert(
            '登録したメールアドレスに確認メールを送りました。メールを確認してからログインしてください！'
          )

          setIsSignUp(false)
          setPassword('')
          return
        }

        // セッションがある場合はそのままホームへ
        router.replace('/')
        router.refresh()

        return
      }

      // =========================
      // ログイン
      // =========================

      const {
        data: loginData,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) {
        setErrorMessage(loginError.message)
        return
      }

      if (!loginData.session) {
        setErrorMessage(
          'ログインセッションを取得できませんでした。'
        )
        return
      }

      console.log(
        'LOGIN USER:',
        loginData.user
      )

      console.log(
        'LOGIN SESSION:',
        loginData.session
      )

      // ホームへ
      router.replace('/')
      router.refresh()
    } catch (err) {
      console.error(
        '認証処理エラー:',
        err
      )

      setErrorMessage(
        '予期しないエラーが発生しました。もう一度お試しください。'
      )
    } finally {
      setLoading(false)
    }
  }

  const changeMode = () => {
    setIsSignUp((prev) => !prev)

    setErrorMessage(null)
    setPassword('')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--page-background)',
        color: 'var(--foreground)',
        padding: '40px 20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          margin: '0 auto',
          padding: '25px',
          boxSizing: 'border-box',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
        }}
      >
        {/* タイトル */}

        <div
          style={{
            textAlign: 'center',
            marginBottom: '30px',
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: '8px',
              fontSize: '1.8rem',
            }}
          >
            詞花
          </h1>

          <div
            style={{
              color: 'var(--primary)',
              letterSpacing: '4px',
              fontSize: '0.9rem',
            }}
          >
            ShiKa
          </div>

          <p
            style={{
              color: 'var(--foreground-muted)',
              fontSize: '0.85rem',
              marginTop: '15px',
              marginBottom: 0,
            }}
          >
            俳句でつながる
          </p>
        </div>

        <h2
          style={{
            textAlign: 'center',
            fontSize: '1.2rem',
            marginBottom: '25px',
          }}
        >
          {isSignUp
            ? '新たに歌人となる'
            : '詞花へ入る'}
        </h2>

        {/* エラー */}

        {errorMessage && (
          <div
            style={{
              color: 'var(--danger)',
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: 'color-mix(in srgb, var(--danger) 16%, var(--surface))',
              borderRadius: '8px',
              border: '1px solid var(--danger)',
              fontSize: '0.9rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* フォーム */}

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* 歌人名 */}

          {isSignUp && (
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '0.85rem',
                  color: 'var(--foreground)',
                }}
              >
                歌人名
              </label>

              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                placeholder="詞花で使う名前"
                autoComplete="username"
                style={inputStyle}
              />
            </div>
          )}

          {/* メール */}

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '0.85rem',
                color: 'var(--foreground)',
              }}
            >
              メールアドレス
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              autoComplete="email"
              placeholder="example@email.com"
              style={inputStyle}
            />
          </div>

          {/* パスワード */}

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '0.85rem',
                color: 'var(--foreground)',
              }}
            >
              パスワード
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
              minLength={6}
              autoComplete={
                isSignUp
                  ? 'new-password'
                  : 'current-password'
              }
              placeholder="6文字以上"
              style={inputStyle}
            />
          </div>

          {/* 送信 */}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '13px',
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: '8px',
              cursor: loading
                ? 'not-allowed'
                : 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem',
              marginTop: '5px',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading
              ? '処理中...'
              : isSignUp
                ? '詞花をはじめる'
                : 'ログイン'}
          </button>
        </form>

        {/* 新規登録/ログイン切替 */}

        <div
          style={{
            marginTop: '25px',
            textAlign: 'center',
            fontSize: '0.85rem',
            color: 'var(--foreground-muted)',
          }}
        >
          {isSignUp
            ? 'すでに詞花を利用していますか？'
            : 'はじめて詞花を利用しますか？'}

          <br />

          <button
            type="button"
            onClick={changeMode}
            style={{
              marginTop: '8px',
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '0.9rem',
            }}
          >
            {isSignUp
              ? 'ログインへ'
              : '新規登録へ'}
          </button>
        </div>

        {/* 戻る */}

        <button
          type="button"
          onClick={() => router.push('/')}
          style={{
            display: 'block',
            margin: '25px auto 0',
            background: 'none',
            border: 'none',
            color: 'var(--foreground-muted)',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          ← 新着へ戻る
        </button>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '12px',
  boxSizing: 'border-box' as const,
  backgroundColor: 'var(--input-background)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
  borderRadius: '8px',
  outline: 'none',
  fontSize: '1rem',
}
