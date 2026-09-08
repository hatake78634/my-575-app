'use client'

import { useState } from 'react'

export default function ShareButton({ title, text, path, hashtags = ['詩花', '俳句'] }: { title: string; text: string; path: string; hashtags?: string[] }) {
  const [status, setStatus] = useState('')
  const share = async () => {
    const url = new URL(path, window.location.origin).toString()
    const shareText = `${text}\n${hashtags.map((tag) => `#${tag}`).join(' ')}`
    try {
      if (navigator.share) await navigator.share({ title, text: shareText, url })
      else { await navigator.clipboard.writeText(`${shareText}\n${url}`); setStatus('URLをコピーしました') }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      try { await navigator.clipboard.writeText(`${shareText}\n${url}`); setStatus('URLをコピーしました') }
      catch { setStatus('共有できませんでした') }
    }
  }
  return <span><button type="button" className="soft-button" onClick={share} style={{ padding: '7px 12px', cursor: 'pointer' }}>共有</button>{status && <span role="status" style={{ marginLeft: 8, color: 'var(--foreground-muted)', fontSize: 13 }}>{status}</span>}</span>
}
