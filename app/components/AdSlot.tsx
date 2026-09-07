const ADS_ENABLED = false

export default function AdSlot({ label = '広告' }: { label?: string }) {
  if (!ADS_ENABLED) return null
  return <aside aria-label={label} style={{ minHeight: 80, margin: '18px 0' }} />
}
