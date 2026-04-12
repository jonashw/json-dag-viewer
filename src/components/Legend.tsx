import { useState } from 'react'
import type { GraphConfig } from '../types'
import './Legend.css'

interface Props {
  colorFacetField: string | null
  colorEntries:    { label: string; color: string }[]
  edgeColorMap:    Map<string, string>
  hiddenNodeTypes: Set<string>
  onToggleNodeType: (type: string) => void
  nodeFields:       string[]
  config:           GraphConfig
  onConfigChange:   (c: GraphConfig) => void
}

const DEFAULT_COLOR = '#4d9d8c'  // hsl(167, 34%, 46%)

export default function Legend({
  colorFacetField, colorEntries, edgeColorMap, hiddenNodeTypes, onToggleNodeType,
  nodeFields, config, onConfigChange,
}: Props) {
  const edgeEntries = [...edgeColorMap.entries()].map(([label, color]) => ({ label, color }))
  const [expandedType, setExpandedType] = useState<string | null>(null)

  function handleOverrideChange(type: string, field: 'captionField' | 'color', value: string) {
    const prev = config.nodeTypeOverrides[type] ?? {}
    const next = { ...prev, [field]: value || undefined }
    // Remove empty overrides
    if (!next.captionField && !next.color) {
      const { [type]: _, ...rest } = config.nodeTypeOverrides
      onConfigChange({ ...config, nodeTypeOverrides: rest })
    } else {
      onConfigChange({ ...config, nodeTypeOverrides: { ...config.nodeTypeOverrides, [type]: next } })
    }
  }

  return (
    <section className="legend">
      <div className="legend-title">Legend</div>

      {/* ── Node types ───────────────────────────────── */}
      <div className="legend-section-label">Node types</div>
      {colorFacetField && colorEntries.length > 0 ? (
        colorEntries.map(({ label, color }) => {
          const hidden = hiddenNodeTypes.has(label)
          const expanded = expandedType === label
          const override = config.nodeTypeOverrides[label]
          return (
            <div key={label} className="legend-type-group">
              <div className={`legend-item legend-item--toggle${hidden ? ' legend-item--hidden' : ''}`}>
                <span
                  className="legend-dot"
                  style={{ background: hidden ? 'transparent' : color, borderColor: color }}
                  onClick={() => onToggleNodeType(label)}
                  title={hidden ? `Show ${label} nodes` : `Hide ${label} nodes`}
                />
                <span
                  className="legend-label"
                  onClick={() => onToggleNodeType(label)}
                  title={hidden ? `Show ${label} nodes` : `Hide ${label} nodes`}
                >{label}</span>
                <button
                  className={`legend-config-btn${expanded ? ' legend-config-btn--active' : ''}`}
                  onClick={() => setExpandedType(expanded ? null : label)}
                  title="Configure node type"
                >⚙</button>
              </div>
              {expanded && (
                <div className="legend-type-config">
                  <label className="legend-config-label">Caption</label>
                  <select
                    className="legend-config-select"
                    value={override?.captionField ?? ''}
                    onChange={e => handleOverrideChange(label, 'captionField', e.target.value)}
                  >
                    <option value="">default ({config.nodeCaptionField})</option>
                    {nodeFields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <label className="legend-config-label">Color</label>
                  <input
                    type="color"
                    className="legend-config-color"
                    value={color}
                    onChange={e => handleOverrideChange(label, 'color', e.target.value)}
                  />
                </div>
              )}
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
