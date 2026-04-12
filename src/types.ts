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
  nodeCaptionField: string         // default node caption attribute
  edgeCaptionField: string         // which edge attribute becomes the visual label ('' = none)
  colorFacetField:  string | null  // which attribute drives node colour (null = uniform)
  /** Per-facet inclusion filter: empty Set means "show all values". */
  facetFilters:     Record<string, Set<string>>
  /** Node-type values (from colorFacetField) to hide, along with connected edges. */
  hiddenNodeTypes:  Set<string>
  /** Per-node-type overrides for caption field and color. Keyed by colorFacetField value. */
  nodeTypeOverrides: Record<string, { captionField?: string; color?: string }>
}
