import type { Node, Relationship } from '@neo4j-nvl/base'
import type { DagGraph, DagNode, DagEdge, FacetDef, GraphConfig } from './types'

// ---------------------------------------------------------------------------
// Colour palette (Tableau-20 inspired)
// ---------------------------------------------------------------------------
const COLOR_PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
  '#4e9e8c', '#e6a817', '#8cd17d', '#86bcb6', '#f1ce63',
  '#d37295', '#a0cbe8', '#ffbe7d', '#499894', '#fabfd2',
]

const DEFAULT_NODE_COLOR = '#4e9e8c'
const DEFAULT_NODE_SIZE  = 30
const DEFAULT_EDGE_COLOR = '#aaaaaa'
// Edge types get colours from the second half of the palette to stay visually distinct from nodes
const EDGE_PALETTE_OFFSET = 10

// ---------------------------------------------------------------------------
// Parse arbitrary JSON -> DagGraph  (no strict schema required)
// ---------------------------------------------------------------------------
export function parseDagJson(raw: string): DagGraph {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Expected a JSON object')
  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.nodes)) throw new Error('Missing "nodes" array')
  if (!Array.isArray(obj.edges)) throw new Error('Missing "edges" array')

  const nodes: DagNode[] = (obj.nodes as unknown[]).map((rawNode, i) => {
    if (typeof rawNode !== 'object' || rawNode === null)
      throw new Error(`Node at index ${i} is not an object`)
    const n = rawNode as Record<string, unknown>
    if (!('id' in n) || n.id == null) throw new Error(`Node at index ${i} is missing an "id" field`)
    return { ...n, id: String(n.id) } as DagNode
  })

  const edges: DagEdge[] = (obj.edges as unknown[]).map((rawEdge, i) => {
    if (typeof rawEdge !== 'object' || rawEdge === null)
      throw new Error(`Edge at index ${i} is not an object`)
    const e = rawEdge as Record<string, unknown>
    if (!e.from || !e.to) throw new Error(`Edge at index ${i} missing "from" or "to"`)
    return { ...e, from: String(e.from), to: String(e.to) } as DagEdge
  })

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Facet detection -- find low-cardinality categorical attributes
// ---------------------------------------------------------------------------
const MAX_FACET_CARDINALITY = 30

function isPrimitive(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
}

export function detectFacets(dag: DagGraph): FacetDef[] {
  if (dag.nodes.length === 0) return []

  const keySet = new Set<string>()
  for (const node of dag.nodes) {
    for (const k of Object.keys(node)) {
      if (k !== 'id') keySet.add(k)
    }
  }

  const facets: FacetDef[] = []

  for (const key of keySet) {
    let allPrimitive = true
    const values: string[] = []

    for (const node of dag.nodes) {
      const v = node[key]
      if (v === undefined || v === null) continue
      if (!isPrimitive(v)) { allPrimitive = false; break }
      values.push(String(v))
    }

    if (!allPrimitive || values.length === 0) continue

    const distinct = [...new Set(values)].sort()
    // Candidate: more than 1 distinct value, low cardinality, not fully unique
    if (
      distinct.length > 1 &&
      distinct.length <= MAX_FACET_CARDINALITY &&
      distinct.length < dag.nodes.length
    ) {
      facets.push({ attribute: key, values: distinct })
    }
  }

  // Fewer distinct values = more useful as a filter -> sort ascending
  return facets.sort((a, b) => a.values.length - b.values.length)
}

// ---------------------------------------------------------------------------
// Caption heuristics
// ---------------------------------------------------------------------------
const NODE_CAPTION_PRIORITY = [
  'label', 'name', 'caption', 'title', 'className', 'class', 'displayName', 'description',
]
const EDGE_CAPTION_PRIORITY = [
  'type', 'label', 'caption', 'name', 'relation', 'relationship', 'kind',
]

export function detectBestNodeCaption(dag: DagGraph): string {
  if (dag.nodes.length === 0) return 'id'

  const presentKeys = new Set<string>()
  for (const node of dag.nodes) {
    for (const k of Object.keys(node)) {
      if (k !== 'id') presentKeys.add(k)
    }
  }

  for (const field of NODE_CAPTION_PRIORITY) {
    if (presentKeys.has(field)) return field
  }

  // Prefer a string field with >60% unique values across all nodes
  for (const key of presentKeys) {
    const values = dag.nodes
      .map(n => n[key])
      .filter((v): v is string => typeof v === 'string')
    if (values.length >= dag.nodes.length * 0.8) {
      const uniqueCount = new Set(values).size
      if (uniqueCount > dag.nodes.length * 0.6) return key
    }
  }

  return 'id'
}

export function detectBestEdgeCaption(dag: DagGraph): string {
  if (dag.edges.length === 0) return ''

  const presentKeys = new Set<string>()
  for (const edge of dag.edges) {
    for (const k of Object.keys(edge)) {
      if (k !== 'from' && k !== 'to') presentKeys.add(k)
    }
  }

  for (const field of EDGE_CAPTION_PRIORITY) {
    if (presentKeys.has(field)) return field
  }

  return presentKeys.size > 0 ? [...presentKeys][0] : ''
}

// ---------------------------------------------------------------------------
// Colour-facet heuristic -- pick the best attribute to drive node colours
// ---------------------------------------------------------------------------
const COLOR_FACET_PRIORITY = [
  'type', 'kind', 'status', 'category', 'group', 'httpMethod', 'method', 'role',
]

export function detectBestColorFacet(facets: FacetDef[]): string | null {
  if (facets.length === 0) return null

  for (const name of COLOR_FACET_PRIORITY) {
    const facet = facets.find(f => f.attribute === name)
    if (facet && facet.values.length >= 2 && facet.values.length <= 15) return facet.attribute
  }

  // Fall back to any facet with 2-10 values
  const good = facets.filter(f => f.values.length >= 2 && f.values.length <= 10)
  return good.length > 0 ? good[0].attribute : null
}

// ---------------------------------------------------------------------------
// Build default config from auto-detected candidates
// ---------------------------------------------------------------------------
export function buildDefaultConfig(dag: DagGraph, facets: FacetDef[]): GraphConfig {
  return {
    nodeCaptionField: detectBestNodeCaption(dag),
    edgeCaptionField: detectBestEdgeCaption(dag),
    colorFacetField:  detectBestColorFacet(facets),
    facetFilters:     {},
  }
}

// ---------------------------------------------------------------------------
// Colour map: facet value -> palette colour
// ---------------------------------------------------------------------------
export function buildColorMap(
  facets: FacetDef[],
  colorFacetField: string | null,
): Map<string, string> {
  if (!colorFacetField) return new Map()
  const facet = facets.find(f => f.attribute === colorFacetField)
  if (!facet) return new Map()
  return new Map(facet.values.map((v, i) => [v, COLOR_PALETTE[i % COLOR_PALETTE.length]]))
}

/** Assigns a stable colour to each distinct edge `type` value. */
export function buildEdgeColorMap(dag: DagGraph): Map<string, string> {
  const types = [...new Set(dag.edges.map(e => String(e.type ?? '')).filter(Boolean))].sort()
  return new Map(types.map((t, i) =>
    [t, COLOR_PALETTE[(EDGE_PALETTE_OFFSET + i) % COLOR_PALETTE.length]]
  ))
}

// ---------------------------------------------------------------------------
// Derive field lists for caption selector dropdowns
// ---------------------------------------------------------------------------
export function deriveNodeFields(dag: DagGraph): string[] {
  const keys = new Set<string>()
  for (const node of dag.nodes) {
    for (const k of Object.keys(node)) keys.add(k)
  }
  return [...keys].sort()
}

export function deriveEdgeFields(dag: DagGraph): string[] {
  const keys = new Set<string>()
  for (const edge of dag.edges) {
    for (const k of Object.keys(edge)) {
      if (k !== 'from' && k !== 'to') keys.add(k)
    }
  }
  return [...keys].sort()
}

// ---------------------------------------------------------------------------
// Apply facet filters to produce a filtered sub-graph
// ---------------------------------------------------------------------------
export function applyFilters(dag: DagGraph, config: GraphConfig): DagGraph {
  const filteredNodes = dag.nodes.filter(node => {
    for (const [attr, included] of Object.entries(config.facetFilters)) {
      if (included.size === 0) continue  // empty Set = all values pass
      const v = node[attr]
      if (v === undefined || v === null) continue
      if (!included.has(String(v))) return false
    }
    return true
  })

  const visibleIds = new Set(filteredNodes.map(n => n.id))
  const filteredEdges = dag.edges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to))

  return { nodes: filteredNodes, edges: filteredEdges }
}

// ---------------------------------------------------------------------------
// Convert to NVL graph for rendering
// ---------------------------------------------------------------------------
export interface NvlGraph {
  nodes:   Node[]
  rels:    Relationship[]
  edgeMap: Map<string, DagEdge>
}

export function convertToNvl(
  dag: DagGraph,
  config: GraphConfig,
  colorMap: Map<string, string>,
  edgeColorMap: Map<string, string> = new Map(),
): NvlGraph {
  const nodeSet    = new Set(dag.nodes.map(n => n.id))
  const validEdges = dag.edges.filter(e => nodeSet.has(e.from) && nodeSet.has(e.to))

  return {
    nodes: dag.nodes.map(node => {
      const captionVal = node[config.nodeCaptionField]
      const caption    = captionVal != null ? String(captionVal) : node.id

      let color = DEFAULT_NODE_COLOR
      if (config.colorFacetField) {
        const facetVal = node[config.colorFacetField]
        if (facetVal != null) color = colorMap.get(String(facetVal)) ?? DEFAULT_NODE_COLOR
      }

      return { id: node.id, caption, color, size: DEFAULT_NODE_SIZE }
    }),

    rels: validEdges.map((edge, i) => {
      const captionVal = config.edgeCaptionField ? edge[config.edgeCaptionField] : undefined
      const caption    = captionVal != null ? String(captionVal) : ''
      const edgeType = edge.type != null ? String(edge.type) : ''
      return {
        id:      `edge-${i}`,
        from:    edge.from,
        to:      edge.to,
        caption,
        color:   edgeColorMap.get(edgeType) ?? DEFAULT_EDGE_COLOR,
        width:   1.5,
      }
    }),

    edgeMap: new Map(validEdges.map((edge, i) => [`edge-${i}`, edge])),
  }
}
