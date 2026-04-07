import { useRef, useCallback, useState, useEffect } from 'react'
import { InteractiveNvlWrapper } from '@neo4j-nvl/react'
import type { Node, Relationship } from '@neo4j-nvl/base'
import { NVL } from '@neo4j-nvl/base'
import './GraphView.css'

const ZOOM_STEP = 1.4

interface Props {
  nodes:         Node[]
  rels:          Relationship[]
  layout:        'forceDirected' | 'hierarchical'
  onNodeClick:   (node: Node) => void
  onRelClick:    (rel: Relationship) => void
  onCanvasClick: () => void
}

export default function GraphView({ nodes, rels, layout, onNodeClick, onRelClick, onCanvasClick }: Props) {
    const nvlRef = useRef<NVL>(null)
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)

    // NVL requires the minimap container to exist in the DOM *before* it initialises.
    // Render the div unconditionally first, capture it via a callback ref, then
    // mount InteractiveNvlWrapper only once the container is ready.
    const [minimapContainer, setMinimapContainer] = useState<HTMLDivElement | null>(null)
    const minimapRef = useCallback((el: HTMLDivElement | null) => {
        if (el) setMinimapContainer(el)
    }, [])


    // ── button handlers ────────────────────────────────────────────
    const zoomIn = useCallback(() => {
        const nvl = nvlRef.current
        if (!nvl) return
        nvl.setZoom(Math.min(nvl.getScale() * ZOOM_STEP, 5))
    }, [])

    const zoomOut = useCallback(() => {
        const nvl = nvlRef.current
        if (!nvl) return
        nvl.setZoom(Math.max(nvl.getScale() / ZOOM_STEP, 0.05))
    }, [])

    const fitAll = useCallback(() => {
        const nvl = nvlRef.current
        if (!nvl) return
        nvl.fit(nodes.map(n => n.id), { animated: false })
    }, [nodes])

    // Dev-only test helper: exposes nvlRef state on window so Playwright tests can verify it
    useEffect(() => {
        if (import.meta.env.DEV) {
            ;(window as any).__dag = {
                isReady:  () => nvlRef.current !== null,
                getScale: () => nvlRef.current?.getScale() ?? null,
                setZoom:  (z: number) => {
                    const nvl = nvlRef.current
                    console.log('[__dag.setZoom] nvlRef.current:', nvl)
                    if (!nvl) { console.warn('[__dag.setZoom] ref is null!'); return }
                    const before = nvl.getScale()
                    console.log('[__dag.setZoom] before getScale:', before)
                    nvl.setZoom(z)
                    // Synchronous read — pendingZoomOperation hasn't fired yet
                    console.log('[__dag.setZoom] immediately after setZoom:', nvl.getScale())
                    // Schedule async read after RAF
                    setTimeout(() => console.log('[__dag.setZoom] 100ms after setZoom:', nvl.getScale()), 100)
                    setTimeout(() => console.log('[__dag.setZoom] 500ms after setZoom:', nvl.getScale()), 500)
                },
            }
        }
    })



    return (
        <div className="graph-view">
            {/* Rendered first so the element exists before NVL initialises */}
            <div ref={minimapRef} className="minimap" title="Minimap (click to pan)" />

            {/* Always mounted — NVL waits internally until minimapContainer is non-null */}
            <InteractiveNvlWrapper
                ref={nvlRef}
                nodes={nodes}
                rels={rels}
                nvlCallbacks={{
                    onLayoutDone: () => {
                        console.log('layout done');
                        //fitAll();
                    }
                }}
                nvlOptions={{
                    minimapContainer,
                    layout,
                    disableTelemetry: true,
                    renderer: 'canvas',
                    minZoom: 0.05,
                    maxZoom: 5,
                }}
                mouseEventCallbacks={{
                    onNodeClick: (node) => { setContextMenu(null); onNodeClick(node) },
                    onNodeRightClick: (_node, _hit, event) => {
                        event.preventDefault()
                        setContextMenu({ x: event.clientX, y: event.clientY, nodeId: _node.id })
                    },
                    onRelationshipClick: (rel) => { setContextMenu(null); onRelClick(rel) },
                    onCanvasClick: () => { setContextMenu(null); onCanvasClick() },
                    onDrag: true,
                    onZoom: true,
                    onPan: true,
                }}
            />

            {/* ── zoom controls ────────────────────────────────────────────────────── */}
            <div className="zoom-controls">
                <button className="zoom-btn" onClick={zoomIn} title="Zoom in">+</button>
                <button className="zoom-btn" onClick={zoomOut} title="Zoom out">−</button>
                <button className="zoom-btn zoom-fit" onClick={fitAll} title="Fit all nodes">⊑</button>
            </div>
            {/* ── context menu ──────────────────────────────────────────────────────── */}
            {contextMenu && (
                <div
                    className="graph-context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button onClick={() => {
                        nvlRef.current?.updateElementsInGraph([{ id: contextMenu.nodeId, pinned: false }], [])
                        setContextMenu(null)
                    }}>Unpin node</button>
                </div>
            )}
        </div>
    )
}
