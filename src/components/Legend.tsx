import './Legend.css'

interface Props {
  colorFacetField: string | null
  colorEntries:    { label: string; color: string }[]
  edgeColorMap:    Map<string, string>
  hiddenNodeTypes: Set<string>
  onToggleNodeType: (type: string) => void
}

const DEFAULT_COLOR = 'hsl(167, 34%, 46%)'

export default function Legend({ colorFacetField, colorEntries, edgeColorMap, hiddenNodeTypes, onToggleNodeType }: Props) {
  const edgeEntries = [...edgeColorMap.entries()].map(([label, color]) => ({ label, color }))

  return (
    <section className="legend">
      <div className="legend-title">Legend</div>

      {/* ── Node types ───────────────────────────────── */}
      <div className="legend-section-label">Node types</div>
      {colorFacetField && colorEntries.length > 0 ? (
        colorEntries.map(({ label, color }) => {
          const hidden = hiddenNodeTypes.has(label)
          return (
            <div
              key={label}
              className={`legend-item legend-item--toggle${hidden ? ' legend-item--hidden' : ''}`}
              onClick={() => onToggleNodeType(label)}
              title={hidden ? `Show ${label} nodes` : `Hide ${label} nodes`}
            >
              <span className="legend-dot" style={{ background: hidden ? 'transparent' : color, borderColor: color }} />
              <span>{label}</span>
            </div>
          )
        })
      ) : (
        <div className="legend-item">
          <span className="legend-dot" style={{ background: DEFAULT_COLOR }} />
          <span>Node</span>
        </div>
      )}

      {/* ── Edge types ───────────────────────────────── */}
      {edgeEntries.length > 0 && (
        <>
          <div className="legend-section-label" style={{ marginTop: 8 }}>Edge types</div>
          {edgeEntries.map(({ label, color }) => (
            <div key={label} className="legend-item">
              <span className="legend-line" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
        </>
      )}
    </section>
  )
}
