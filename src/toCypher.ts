// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CypherStatement {
  /** Parameterised Cypher query ready for a Neo4j driver session.run() */
  cypher: string
  /** Parameter bag to accompany the query */
  params: Record<string, unknown>
}

// Mirror of RawGraph / INode / IEdge from DAG.ts (kept local to avoid coupling)
type RawNode = { id: string; type: string } & Record<string, unknown>
type RawEdge = { type: string; from: string; to: string } & Record<string, unknown>
export type RawGraph =
  | { nodes: RawNode[]; edges: RawEdge[] }
  | { nodes: RawNode[]; rels:  RawEdge[] }

// ---------------------------------------------------------------------------
// Label / relationship-type naming
// ---------------------------------------------------------------------------

/** int-api-endpoint → IntApiEndpoint */
function toLabel(type: string): string {
  return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

/** ui-calls → UI_CALLS */
function toRelType(type: string): string {
  return type.replace(/-/g, '_').toUpperCase()
}

// ---------------------------------------------------------------------------
// Cypher literal serialisation (for copy-paste text output)
// ---------------------------------------------------------------------------

function cypherString(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

function cypherLiteral(v: unknown): string {
  if (typeof v === 'string')  return cypherString(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number')  return String(v)
  if (typeof v === 'object' && v !== null && !Array.isArray(v))
    return cypherMap(v as Record<string, unknown>)
  return 'null'
}

function cypherMap(obj: Record<string, unknown>): string {
  const pairs = Object.entries(obj)
    .map(([k, v]) => `${k}: ${cypherLiteral(v)}`)
    .join(', ')
  return `{${pairs}}`
}

function cypherInlineList(items: Array<Record<string, unknown>>): string {
  return '[\n  ' + items.map(cypherMap).join(',\n  ') + '\n]'
}

// ---------------------------------------------------------------------------
// Data profiling
// ---------------------------------------------------------------------------

function isPrimitive(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
}

/**
 * Walk all records of one type and return the *union* of all scalar property
 * keys so that properties absent on some records (nullable) are still captured.
 */
function profileScalarKeys(
  records: Array<Record<string, unknown>>,
  exclude: Set<string>,
): string[] {
  const keys = new Set<string>()
  for (const rec of records)
    for (const [k, v] of Object.entries(rec))
      if (!exclude.has(k) && isPrimitive(v)) keys.add(k)
  return [...keys].sort()
}

/**
 * Pick only the profiled scalar keys from a single record.
 * Missing or non-primitive values are omitted rather than set to null,
 * which preserves any existing value in the database for that property.
 */
function pickScalars(
  rec: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    const v = rec[k]
    if (isPrimitive(v)) out[k] = v
  }
  return out
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const bucket = map.get(k) ?? []
    bucket.push(item)
    map.set(k, bucket)
  }
  return map
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Transform a RawGraph into an ordered list of parameterised Cypher UPSERT
 * statements — one per node label, then one per relationship type.
 *
 * Each statement uses UNWIND for batch efficiency:
 *
 *   for (const { cypher, params } of toCypherUpserts(graph)) {
 *     await session.run(cypher, params)
 *   }
 *
 * Node properties are discovered by profiling the full type group so that
 * nullable/sparse properties are included for nodes that carry them.
 */
export function toCypherUpserts(graph: RawGraph): CypherStatement[] {
  const nodes = graph.nodes
  const edges = 'edges' in graph ? graph.edges : graph.rels
  const statements: CypherStatement[] = []

  // ── Nodes ─────────────────────────────────────────────────────────────────
  const NODE_EXCLUDE = new Set(['id', 'type'])

  for (const [type, typeNodes] of groupBy(nodes, n => n.type)) {
    const label     = toLabel(type)
    const scalarKeys = profileScalarKeys(typeNodes as Record<string, unknown>[], NODE_EXCLUDE)

    const rows = typeNodes.map(node => ({
      id:    node.id,
      props: pickScalars(node as Record<string, unknown>, scalarKeys),
    }))

    const lines = [
      'UNWIND $rows AS row',
      `MERGE (n:${label} {id: row.id})`,
      ...(scalarKeys.length > 0 ? ['SET n += row.props'] : []),
    ]

    statements.push({ cypher: lines.join('\n'), params: { rows } })
  }

  // ── Edges ─────────────────────────────────────────────────────────────────
  const EDGE_EXCLUDE = new Set(['type', 'from', 'to'])

  for (const [type, typeEdges] of groupBy(edges, e => e.type)) {
    const relType    = toRelType(type)
    const scalarKeys = profileScalarKeys(typeEdges as Record<string, unknown>[], EDGE_EXCLUDE)

    const rows = typeEdges.map(edge => ({
      from: edge.from,
      to:   edge.to,
      ...(scalarKeys.length > 0
        ? { props: pickScalars(edge as Record<string, unknown>, scalarKeys) }
        : {}),
    }))

    const lines = [
      'UNWIND $rows AS row',
      'MATCH (a {id: row.from})',
      'MATCH (b {id: row.to})',
      `MERGE (a)-[r:${relType}]->(b)`,
      ...(scalarKeys.length > 0 ? ['SET r += row.props'] : []),
    ]

    statements.push({ cypher: lines.join('\n'), params: { rows } })
  }

  return statements
}

// ---------------------------------------------------------------------------
// Text Cypher — inline literals suitable for copy-paste into Neo4j Browser
// ---------------------------------------------------------------------------

/**
 * Transform a RawGraph into plain-text Cypher UPSERT statements with all
 * values inlined as literals — no driver or parameter binding required.
 *
 * Returns one string per node-label group and one per relationship-type group.
 * Each block can be selected and run independently in Neo4j Browser.
 */
export function toCypherText(graph: RawGraph): string[] {
  const nodes = graph.nodes
  const edges = 'edges' in graph ? graph.edges : graph.rels
  const blocks: string[] = []

  // ── Nodes ─────────────────────────────────────────────────────────────────
  const NODE_EXCLUDE = new Set(['id', 'type'])

  for (const [type, typeNodes] of groupBy(nodes, n => n.type)) {
    const label      = toLabel(type)
    const scalarKeys = profileScalarKeys(typeNodes as Record<string, unknown>[], NODE_EXCLUDE)

    const rows: Array<Record<string, unknown>> = typeNodes.map(node => ({
      id:   node.id,
      ...(scalarKeys.length > 0
        ? { props: pickScalars(node as Record<string, unknown>, scalarKeys) }
        : {}),
    }))

    const lines = [
      `// ── ${label} nodes (${rows.length}) ──────────────────────────────────`,
      `UNWIND ${cypherInlineList(rows)} AS row`,
      `MERGE (n:${label} {id: row.id})`,
      ...(scalarKeys.length > 0 ? ['SET n += row.props'] : []),
      ';',
    ]

    blocks.push(lines.join('\n'))
  }

  // ── Edges ─────────────────────────────────────────────────────────────────
  const EDGE_EXCLUDE = new Set(['type', 'from', 'to'])

  for (const [type, typeEdges] of groupBy(edges, e => e.type)) {
    const relType    = toRelType(type)
    const scalarKeys = profileScalarKeys(typeEdges as Record<string, unknown>[], EDGE_EXCLUDE)

    const rows: Array<Record<string, unknown>> = typeEdges.map(edge => ({
      from: edge.from,
      to:   edge.to,
      ...(scalarKeys.length > 0
        ? { props: pickScalars(edge as Record<string, unknown>, scalarKeys) }
        : {}),
    }))

    const lines = [
      `// ── ${relType} edges (${rows.length}) ──────────────────────────────────`,
      `UNWIND ${cypherInlineList(rows)} AS row`,
      'MATCH (a {id: row.from})',
      'MATCH (b {id: row.to})',
      `MERGE (a)-[r:${relType}]->(b)`,
      ...(scalarKeys.length > 0 ? ['SET r += row.props'] : []),
      ';',
    ]

    blocks.push(lines.join('\n'))
  }

  return blocks
}

// ---------------------------------------------------------------------------
// Graph visualisation query — scoped MATCH for copy-paste into Neo4j Browser
// ---------------------------------------------------------------------------

/**
 * Generate a single Cypher MATCH query that retrieves the full extracted
 * subgraph from an existing database that may contain other node/edge types.
 *
 * The WHERE clauses on both ends of the OPTIONAL MATCH ensure that only
 * nodes and relationships belonging to this schema are returned, regardless
 * of what else lives in the database.
 */
export function toGraphQueryText(graph: RawGraph): string {
  const nodes = graph.nodes
  const edges  = 'edges' in graph ? graph.edges : graph.rels

  const labels = [...new Set(
    nodes.map(n => toLabel(String(n.type ?? ''))).filter(Boolean)
  )].sort()

  const relTypes = [...new Set(
    edges.map(e => toRelType(String(e.type ?? ''))).filter(Boolean)
  )].sort()

  const nodePredicate  = labels.map(l => `n:${l}`).join(' OR ')
  const targetPredicate = labels.map(l => `m:${l}`).join(' OR ')
  const relTypeList    = relTypes.join('|')

  return [
    '// Visualise the full extracted graph (scoped to schema node/edge types only)',
    'MATCH (n)',
    `WHERE ${nodePredicate}`,
    `OPTIONAL MATCH (n)-[r:${relTypeList}]->(m)`,
    `  WHERE ${targetPredicate}`,
    'RETURN n, r, m',
  ].join('\n')
}

/**
 * Generate a DETACH DELETE query scoped to only the schema node types.
 * Relationships to/from nodes outside this schema are also removed (DETACH),
 * but non-schema nodes themselves are left untouched.
 */
export function toDropQueryText(graph: RawGraph): string {
  const nodes = graph.nodes

  const labels = [...new Set(
    nodes.map(n => toLabel(String(n.type ?? ''))).filter(Boolean)
  )].sort()

  const nodePredicate = labels.map(l => `n:${l}`).join(' OR ')

  return [
    '// Drop all schema nodes (and their relationships) — leaves other data untouched',
    'MATCH (n)',
    `WHERE ${nodePredicate}`,
    'DETACH DELETE n',
  ].join('\n')
}
