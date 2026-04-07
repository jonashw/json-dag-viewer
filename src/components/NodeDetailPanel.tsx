import type { DagNode } from '../types'
import './NodeDetailPanel.css'

interface Props {
  node:    DagNode
  onClose: () => void
}

function renderValue(v: unknown): string {
  if (Array.isArray(v)) return v.map(item => String(item)).join(', ')
  if (typeof v === 'object' && v !== null) return JSON.stringify(v)
  if (v == null) return '\u2014'
  return String(v)
}

export default function NodeDetailPanel({ node, onClose }: Props) {
  const entries = Object.entries(node).filter(([k]) => k !== 'id')

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <span className="detail-type-badge detail-id-badge" title={node.id}>{node.id}</span>
        <button className="btn-icon detail-close" onClick={onClose} title="Close">\u2715</button>
      </div>

      <dl className="detail-dl">
        {entries.map(([k, v]) => (
          <div key={k} className="detail-dl-row">
            <dt>{k}</dt>
            <dd>{renderValue(v)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
