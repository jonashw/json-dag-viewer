import { useState, useMemo, useCallback } from 'react'
import type { Node } from '@neo4j-nvl/base'
import GraphView from './components/GraphView'
import Sidebar from './components/Sidebar'
import NodeDetailPanel from './components/NodeDetailPanel'
import type { DagGraph, DagNode, FacetDef, GraphConfig } from './types'
import {
  parseDagJson, applyFilters, convertToNvl,
  detectFacets, buildDefaultConfig, buildColorMap, buildEdgeColorMap,
  deriveNodeFields, deriveEdgeFields,
} from './converter'
import { toCypherText, toGraphQueryText, toDropQueryText } from './toCypher'
import type { RawGraph } from './toCypher'
import './App.css'

export default function App() {
  const [dag,        setDag]        = useState<DagGraph | null>(null)
  const [facets,     setFacets]     = useState<FacetDef[]>([])
  const [config,     setConfig]     = useState<GraphConfig>({
    nodeCaptionField: 'id',
    edgeCaptionField: '',
    colorFacetField:  null,
    facetFilters:     {},
  })
  const [parseError,   setParseError]   = useState<string | null>(null)
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const [selectedNode, setSelectedNode] = useState<DagNode | null>(null)
  const [layout,       setLayout]       = useState<'forceDirected' | 'hierarchical'>('forceDirected')

  // ---- derived data --------------------------------------------------------
  const nodeFields = useMemo(() => (dag ? deriveNodeFields(dag) : []), [dag])
  const edgeFields = useMemo(() => (dag ? deriveEdgeFields(dag) : []), [dag])
  const colorMap   = useMemo(
    () => buildColorMap(facets, config.colorFacetField),
    [facets, config.colorFacetField],
  )

  const filteredDag = useMemo(
    () => (dag ? applyFilters(dag, config) : null),
    [dag, config],
  )

  const edgeColorMap = useMemo(
    () => (filteredDag ? buildEdgeColorMap(filteredDag) : new Map<string, string>()),
    [filteredDag],
  )

  const nvlGraph = useMemo(
    () => (filteredDag ? convertToNvl(filteredDag, config, colorMap, edgeColorMap) : null),
    [filteredDag, config, colorMap, edgeColorMap],
  )

  // ---- handlers ------------------------------------------------------------
  const handleLoad = useCallback((json: string) => {
    try {
      const parsed         = parseDagJson(json)
      const detectedFacets = detectFacets(parsed)
      const defaultConfig  = buildDefaultConfig(parsed, detectedFacets)
      setDag(parsed)
      setFacets(detectedFacets)
      setConfig(defaultConfig)
      setParseError(null)
      setSelectedNode(null)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const handleNodeClick = useCallback((nvlNode: Node) => {
    if (!dag) return
    const found = dag.nodes.find(n => n.id === nvlNode.id) ?? null
    setSelectedNode(prev => (prev?.id === nvlNode.id ? null : found))
  }, [dag])

  const handleCanvasClick = useCallback(() => setSelectedNode(null), [])

  const handleExportNeo4j = useCallback(async () => {
    if (!dag) return
    const blocks = toCypherText(dag as unknown as RawGraph)
    await navigator.clipboard.writeText(blocks.join('\n\n'))
  }, [dag])

  const handleCopyGraphQuery = useCallback(async () => {
    if (!dag) return
    await navigator.clipboard.writeText(toGraphQueryText(dag as unknown as RawGraph))
  }, [dag])

  const handleCopyDropQuery = useCallback(async () => {
    if (!dag) return
    await navigator.clipboard.writeText(toDropQueryText(dag as unknown as RawGraph))
  }, [dag])

  // ---- stats ---------------------------------------------------------------
  const stats = filteredDag
    ? `${filteredDag.nodes.length} nodes \u00b7 ${filteredDag.edges.length} edges`
    : null

  return (
    <div className="app">
      {/* ── top bar ─────────────────────────────────────────────────────── */}
      <header className="topbar">
        <button
          className="btn-icon topbar-toggle"
          onClick={() => setSidebarOpen(o => !o)}
          title="Toggle sidebar"
        >
          {sidebarOpen ? '\u25c2' : '\u25b8'}
        </button>
        <span className="topbar-title">DAG Viewer</span>
        {stats && <span className="topbar-stats">{stats}</span>}
        <div className="topbar-spacer" />
        <label className="topbar-label">Layout</label>
        <select
          className="topbar-select"
          value={layout}
          onChange={e => setLayout(e.target.value as typeof layout)}
        >
          <option value="forceDirected">Force-directed</option>
          <option value="hierarchical">Hierarchical</option>
        </select>
      </header>

      {/* ── main content ────────────────────────────────────────────────── */}
      <div className="content">
        {sidebarOpen && (
          <Sidebar
            onLoad={handleLoad}
            parseError={parseError}
            facets={facets}
            config={config}
            onConfigChange={setConfig}
            nodeFields={nodeFields}
            edgeFields={edgeFields}
            colorMap={colorMap}
            edgeColorMap={edgeColorMap}
            onExportNeo4j={dag ? handleExportNeo4j : undefined}
            onCopyGraphQuery={dag ? handleCopyGraphQuery : undefined}
            onCopyDropQuery={dag ? handleCopyDropQuery : undefined}
          />
        )}

        <div className="graph-area">
          {nvlGraph ? (
            <GraphView
              nodes={nvlGraph.nodes}
              rels={nvlGraph.rels}
              layout={layout}
              onNodeClick={handleNodeClick}
              onCanvasClick={handleCanvasClick}
            />
          ) : (
            <div className="graph-empty">
              <p>Paste a JSON graph with <code>nodes</code> and <code>edges</code> arrays, then press <strong>Load</strong>.</p>
            </div>
          )}
        </div>

        {selectedNode && (
          <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
        )}
      </div>
    </div>
  )
}
