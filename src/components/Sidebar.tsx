import { useRef, useState, useCallback } from 'react'
import type { FacetDef, GraphConfig } from '../types'
import Legend from './Legend'
import './Sidebar.css'

interface Props {
  onLoad:           (json: string) => void
  parseError:       string | null
  facets:           FacetDef[]
  config:           GraphConfig
  onConfigChange:   (c: GraphConfig) => void
  nodeFields:       string[]
  edgeFields:       string[]
  colorMap:         Map<string, string>
  edgeColorMap:     Map<string, string>
  onToggleNodeType: (type: string) => void
  onExportNeo4j?:    () => Promise<void>
  onCopyGraphQuery?: () => Promise<void>
  onCopyDropQuery?:  () => Promise<void>
}

export default function Sidebar({
  onLoad, parseError, facets, config, onConfigChange, nodeFields, edgeFields, colorMap, edgeColorMap,
  onToggleNodeType, onExportNeo4j, onCopyGraphQuery, onCopyDropQuery,
}: Props) {
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [copyState, setCopyState]   = useState<'idle' | 'copied' | 'error'>('idle')
  const [queryState, setQueryState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [dropState, setDropState]   = useState<'idle' | 'copied' | 'error'>('idle')

  const handleExport = useCallback(async () => {
    if (!onExportNeo4j) return
    try {
      await onExportNeo4j()
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }, [onExportNeo4j])

  const handleCopyQuery = useCallback(async () => {
    if (!onCopyGraphQuery) return
    try {
      await onCopyGraphQuery()
      setQueryState('copied')
      setTimeout(() => setQueryState('idle'), 2000)
    } catch {
      setQueryState('error')
      setTimeout(() => setQueryState('idle'), 2000)
    }
  }, [onCopyGraphQuery])

  const handleCopyDrop = useCallback(async () => {
    if (!onCopyDropQuery) return
    try {
      await onCopyDropQuery()
      setDropState('copied')
      setTimeout(() => setDropState('idle'), 2000)
    } catch {
      setDropState('error')
      setTimeout(() => setDropState('idle'), 2000)
    }
  }, [onCopyDropQuery])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target?.result as string
      setText(content)
      onLoad(content)
    }
    reader.readAsText(file)
  }

  function toggleFacetValue(attr: string, value: string) {
    const current = config.facetFilters[attr] ?? new Set<string>()
    const next = new Set(current)
    if (next.has(value)) next.delete(value); else next.add(value)
    onConfigChange({ ...config, facetFilters: { ...config.facetFilters, [attr]: next } })
  }

  function clearFacetFilter(attr: string) {
    const next = { ...config.facetFilters }
    delete next[attr]
    onConfigChange({ ...config, facetFilters: next })
  }

  const colorEntries = [...colorMap.entries()].map(([label, color]) => ({ label, color }))

  return (
    <aside className="sidebar">

      {/* ── JSON Input ────────────────────────────────────────────────── */}
      <section className="sidebar-section">
        <div className="sidebar-section-title">JSON Input</div>
        <textarea
          className="json-input"
          spellCheck={false}
          placeholder='Paste a graph JSON with "nodes" and "edges" arrays...'
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="sidebar-row">
          <button className="btn-primary" onClick={() => onLoad(text)}>Load</button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Open file...</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFile} />
        </div>        {onExportNeo4j && (
          <div className="sidebar-row">
            <button
              className={`btn-neo4j${copyState !== 'idle' ? ' btn-neo4j--feedback' : ''}`}
              onClick={handleExport}
            >
              {copyState === 'copied' ? '✓ Copied!' : copyState === 'error' ? '✗ Failed' : 'Export to Neo4j'}
            </button>
          </div>
        )}
        {onCopyGraphQuery && (
          <div className="sidebar-row">
            <button
              className={`btn-neo4j btn-neo4j--query${queryState !== 'idle' ? ' btn-neo4j--feedback' : ''}`}
              onClick={handleCopyQuery}
            >
              {queryState === 'copied' ? '✓ Copied!' : queryState === 'error' ? '✗ Failed' : 'Copy visualise query'}
            </button>
          </div>
        )}
        {onCopyDropQuery && (
          <div className="sidebar-row">
            <button
              className={`btn-neo4j btn-neo4j--danger${dropState !== 'idle' ? ' btn-neo4j--feedback' : ''}`}
              onClick={handleCopyDrop}
            >
              {dropState === 'copied' ? '✓ Copied!' : dropState === 'error' ? '✗ Failed' : 'Copy drop query'}
            </button>
          </div>
        )}        {parseError && <div className="error-msg">{parseError}</div>}
      </section>

      <Legend
        colorFacetField={config.colorFacetField}
        colorEntries={colorEntries}
        edgeColorMap={edgeColorMap}
        hiddenNodeTypes={config.hiddenNodeTypes}
        onToggleNodeType={onToggleNodeType}
      />

      {/* ── Display options ────────────────────────────────────────────── */}
      {nodeFields.length > 0 && (
        <section className="sidebar-section">
          <div className="sidebar-section-title">Display</div>

          <label className="sidebar-field-label">Node caption</label>
          <select
            className="sidebar-select"
            value={config.nodeCaptionField}
            onChange={e => onConfigChange({ ...config, nodeCaptionField: e.target.value })}
          >
            {nodeFields.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          {edgeFields.length > 0 && (
            <>
              <label className="sidebar-field-label">Edge label</label>
              <select
                className="sidebar-select"
                value={config.edgeCaptionField}
                onChange={e => onConfigChange({ ...config, edgeCaptionField: e.target.value })}
              >
                <option value="">\u2014 none \u2014</option>
                {edgeFields.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </>
          )}

          <label className="sidebar-field-label">Colour by</label>
          <select
            className="sidebar-select"
            value={config.colorFacetField ?? ''}
            onChange={e => onConfigChange({ ...config, colorFacetField: e.target.value || null })}
          >
            <option value="">\u2014 uniform \u2014</option>
            {facets.map(f => <option key={f.attribute} value={f.attribute}>{f.attribute}</option>)}
          </select>
        </section>
      )}

      {/* ── Dynamic facet filters ──────────────────────────────────────── */}
      {facets.map(facet => {
        const included = config.facetFilters[facet.attribute] ?? new Set<string>()
        return (
          <section key={facet.attribute} className="sidebar-section">
            <div className="sidebar-section-title">
              {facet.attribute}
              {included.size > 0 && (
                <button className="btn-tiny" onClick={() => clearFacetFilter(facet.attribute)}>all</button>
              )}
            </div>
            {facet.values.map(v => {
              const dotColor = config.colorFacetField === facet.attribute
                ? colorMap.get(v)
                : undefined
              return (
                <label key={v} className="checkbox-label checkbox-label--small" title={v}>
                  <input
                    type="checkbox"
                    checked={included.size === 0 || included.has(v)}
                    onChange={() => toggleFacetValue(facet.attribute, v)}
                  />
                  {dotColor && <span className="facet-color-dot" style={{ background: dotColor }} />}
                  <span className="truncate">{v}</span>
                </label>
              )
            })}
          </section>
        )
      })}

    </aside>
  )
}
