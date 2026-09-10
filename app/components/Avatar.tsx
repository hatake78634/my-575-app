import Image from 'next/image'
import type { CSSProperties, MouseEventHandler } from 'react'

const DEBUG_AVATAR_USER_ID = 'bdb43d19-f1f2-45fd-a9ed-d51730deb427'

export default function Avatar({ src, name, size = 48, frame = null, className = '', onClick, style }: { src?: string | null; name?: string | null; size?: number; frame?: string | null; className?: string; onClick?: MouseEventHandler<HTMLSpanElement>; style?: CSSProperties }) {
  if (name === 'MIKADOテスト') {
    console.log('[Avatar] props', {
      userId: DEBUG_AVATAR_USER_ID,
      name,
      src,
      frame,
    })
  }

  return <span className={`avatar-shell${frame ? ` avatar-frame-${frame}` : ''} ${className}`.trim()} style={{ width: size, height: size, ...style }} aria-label={`${name || '歌人'}の画像`} onClick={onClick}>
    {src ? <Image src={src} alt="" width={size} height={size} unoptimized /> : <span aria-hidden="true">歌</span>}
  </span>
}
