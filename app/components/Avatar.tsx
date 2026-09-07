import Image from 'next/image'

export default function Avatar({ src, name, size = 48, frame = null }: { src?: string | null; name?: string | null; size?: number; frame?: string | null }) {
  return <span className={`avatar-shell${frame ? ` avatar-frame-${frame}` : ''}`} style={{ width: size, height: size }} aria-label={`${name || '歌人'}の画像`}>
    {src ? <Image src={src} alt="" width={size} height={size} unoptimized /> : <span aria-hidden="true">歌</span>}
  </span>
}
