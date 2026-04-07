// ---------------------------------------------------------------------------
// Generic graph types — any JSON with nodes[] and edges[]
// ---------------------------------------------------------------------------

/** A graph node: must have an `id`; all other attributes are arbitrary. */
export interface DagNode {
  id: string
  [key: string]: unknown
}

/** A graph edge: must have `from` and `to`; all other attributes are arbitrary. */
export interface DagEdge {
  from: string
  to:   string
  [key: string]: unknown
}

export interface DagGraph {
  nodes: DagNode[]
  edges: DagEdge[]
}

// ---------------------------------------------------------------------------
// Auto-detected facet (low-cardinality categorical attribute)
// ---------------------------------------------------------------------------
export interface FacetDef {
  attribute: string    // attribute name on DagNode
  values:    string[]  // sorted distinct string values found in the data
}

// ---------------------------------------------------------------------------
// Display + filter config — starts from auto-detected defaults, user-overridable
// ---------------------------------------------------------------------------
export interface GraphConfig {
  nodeCaptionField: string         // which node attribute becomes the visual caption
  edgeCaptionField: string         // which edge attribute becomes the visual label ('' = none)
  colorFacetField:  string | null  // which attribute drives node colour (null = uniform)
  /** Per-facet inclusion filter: empty Set means "show all values". */
  facetFilters:     Record<string, Set<string>>
}
