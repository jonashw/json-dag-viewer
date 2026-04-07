import type { DagNode, DagEdge } from '../types'
import './NodeDetailPanel.css'

type Props =
  | { kind: 'node'; node: DagNode; onClose: () => void }
  | { kind: 'edge'; edge: DagEdge; onClose: () => void }

function renderValue(v: unknown): string {
  if (Array.isArray(v)) return v.map(item => String(item)).join(', ')
  if (typeof v === 'object' && v !== null) return JSON.stringify(v)
  if (v == null) return '\u2014'
  return String(v)
}

export default function NodeDetailPanel(props: Props) {
  const { kind, onClose } = props

  const title = kind === 'node'
    ? props.node.id
    : `${props.edge.from} \u2192 ${props.edge.to}`

  const entries = kind === 'node'
    ? Object.entries(props.node).filter(([k]) => k !== 'id')
    : Object.entries(props.edge).filter(([k]) => k !== 'from' && k !== 'to')

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <span className="detail-type-badge detail-id-badge" title={title}>{title}</span>
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
