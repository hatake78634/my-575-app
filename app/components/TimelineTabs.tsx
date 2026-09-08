'use client'

export type TimelineTab = 'new' | 'discover' | 'favorite'

type TimelineTabsProps = {
  activeTab: TimelineTab
  onChange: (tab: TimelineTab) => void
}

export default function TimelineTabs({
  activeTab,
  onChange,
}: TimelineTabsProps) {
  const tabs: {
    id: TimelineTab
    label: string
  }[] = [
    {
      id: 'new',
      label: '新着',
    },
    {
      id: 'discover',
      label: 'みつける',
    },
    {
      id: 'favorite',
      label: '贔屓',
    },
  ]

  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: '20px',
      }}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              position: 'relative',
              background: 'none',
              border: 'none',
              color: active ? '#fff' : '#777',
              padding: '14px 5px',
              fontSize: '0.95rem',
              fontWeight: active ? 'bold' : 'normal',
              cursor: 'pointer',
            }}
          >
            {tab.label}

            {active && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  left: '25%',
                  width: '50%',
                  height: '2px',
                  backgroundColor: 'var(--primary)',
                  borderRadius: '2px',
                }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
