type RawGraph = EdgesGraph | RelsGraph;

type EdgesGraph = {
    nodes: Array<INode>
    edges: Array<IEdge>
}

type RelsGraph = {
    nodes: Array<INode>
    rels: Array<IEdge>
}

type INode = {
    id: string
    type: string,
} & Record<string, any>;

type IEdge = {
    type: string,
    from: string
    to: string
} & Record<string, any>;