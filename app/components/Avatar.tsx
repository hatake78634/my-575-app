import Image from 'next/image'
import type { CSSProperties, MouseEventHandler } from 'react'

export default function Avatar({ src, name, size = 48, frame = null, className = '', onClick, style }: { src?: string | null; name?: string | null; size?: number; frame?: string | null; className?: string; onClick?: MouseEventHandler<HTMLSpanElement>; style?: CSSProperties }) {
  return <span className={`avatar-shell${frame ? ` avatar-frame-${frame}` : ''} ${className}`.trim()} style={{ width: size, height: size, ...style }} aria-label={`${name || '歌人'}の画像`} onClick={onClick}>
    {src ? <Image src={src} alt="" width={size} height={size} unoptimized /> : <span aria-hidden="true">歌</span>}
  </span>
}
