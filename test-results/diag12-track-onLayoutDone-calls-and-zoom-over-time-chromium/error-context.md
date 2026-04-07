# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: diag12.spec.ts >> track onLayoutDone calls and zoom over time
- Location: tests/diag12.spec.ts:8:1

# Error details

```
Error: diagnostic done
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - button "◂" [ref=e5] [cursor=pointer]
    - generic [ref=e6]: DAG Viewer
    - generic [ref=e7]: 3 nodes · 2 edges
    - generic [ref=e8]: Layout
    - combobox [ref=e9] [cursor=pointer]:
      - option "Force-directed" [selected]
      - option "Hierarchical"
  - generic [ref=e10]:
    - complementary [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]: JSON Input
        - textbox "Paste a graph JSON with \"nodes\" and \"edges\" arrays\\u2026" [ref=e14]: "{\"nodes\":[{\"id\":\"1\"},{\"id\":\"2\"},{\"id\":\"3\"}],\"edges\":[{\"from\":\"1\",\"to\":\"2\"},{\"from\":\"2\",\"to\":\"3\"}]}"
        - generic [ref=e15]:
          - button "Load" [active] [ref=e16] [cursor=pointer]
          - button "Open file\\u2026" [ref=e17] [cursor=pointer]
        - button "Export to Neo4j" [ref=e19] [cursor=pointer]
        - button "Copy visualise query" [ref=e21] [cursor=pointer]
        - button "Copy drop query" [ref=e23] [cursor=pointer]
      - generic [ref=e24]:
        - generic [ref=e25]: Display
        - generic [ref=e26]: Node caption
        - combobox [ref=e27] [cursor=pointer]:
          - option "id" [selected]
        - generic [ref=e28]: Colour by
        - combobox [ref=e29] [cursor=pointer]:
          - option "\\u2014 uniform \\u2014" [selected]
      - generic [ref=e30]:
        - generic [ref=e31]: Legend
        - generic [ref=e32]: Node types
        - generic [ref=e35]: Node
    - generic [ref=e37]:
      - generic "Minimap (click to pan)" [ref=e38]
      - img "Graph visualization" [ref=e40]:
        - img [ref=e43]
      - generic:
        - button "+" [ref=e45] [cursor=pointer]
        - button "−" [ref=e46] [cursor=pointer]
        - button "⊑" [ref=e47] [cursor=pointer]
```

# Test source

```ts
  1  | import { test } from '@playwright/test'
  2  | 
  3  | const SAMPLE_GRAPH = JSON.stringify({
  4  |   nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  5  |   edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
  6  | })
  7  | 
  8  | test('track onLayoutDone calls and zoom over time', async ({ page }) => {
  9  |   let layoutDoneCount = 0
  10 |   page.on('console', m => {
  11 |     const text = m.text()
  12 |     if (!text.includes('WebGL') && !text.includes('DevTools') && !text.includes('Download')) {
  13 |       if (text.includes('layout done')) layoutDoneCount++
  14 |       console.log(`t=${Date.now()} BROWSER: ${text}`)
  15 |     }
  16 |   })
  17 |   
  18 |   await page.goto('/')
  19 |   await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  20 |   await page.getByRole('button', { name: /load/i }).click()
  21 |   await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  22 |   
  23 |   // Poll zoom every 200ms for 3 seconds to see if it's still changing
  24 |   const zoomHistory: { t: number; z: number }[] = []
  25 |   for (let i = 0; i < 15; i++) {
  26 |     const z = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default') ?? -1)
  27 |     zoomHistory.push({ t: i * 200, z })
  28 |     await page.waitForTimeout(200)
  29 |   }
  30 |   console.log('=== Zoom history (every 200ms) ===')
  31 |   zoomHistory.forEach(h => console.log(`  t=${h.t}ms  zoom=${h.z.toFixed(4)}`))
  32 |   console.log(`=== Total onLayoutDone calls: ${layoutDoneCount} ===`)
  33 | 
  34 |   // Now fire wheel
  35 |   const wrapperBox = await page.locator('#NVL_interactive-wrapper').boundingBox()
  36 |   if (!wrapperBox) throw new Error('no wrapper')
  37 |   const cx = wrapperBox.x + wrapperBox.width / 2
  38 |   const cy = wrapperBox.y + wrapperBox.height / 2
  39 |   const before = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  40 |   await page.mouse.move(cx, cy)
  41 |   await page.mouse.wheel(0, -300)
  42 |   await page.waitForTimeout(500)
  43 |   const after = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  44 |   console.log(`=== Wheel at (#NVL_interactive-wrapper center): zoom ${before} -> ${after} ===`)
  45 |   console.log(`=== Final onLayoutDone count: ${layoutDoneCount} ===`)
  46 |   
> 47 |   throw new Error('diagnostic done')
     |         ^ Error: diagnostic done
  48 | })
  49 | 
```