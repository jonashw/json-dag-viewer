import { test } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

test('DOM structure and event target diagnostic', async ({ page }) => {
  page.on('console', m => {
    if (!m.text().includes('WebGL') && !m.text().includes('React DevTools') && !m.text().includes('Download')) {
      console.log('BROWSER:', m.text())
    }
  })

  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  await page.waitForTimeout(3000)

  // Dump the DOM inside .graph-view
  const domInfo = await page.evaluate(() => {
    const graphView = document.querySelector('.graph-view')
    if (!graphView) return 'NO .graph-view FOUND'
    
    const children = Array.from(graphView.children).map(el => {
      const rect = el.getBoundingClientRect()
      return `${el.tagName} id="${el.id}" class="${el.className}" size=${rect.width.toFixed(0)}x${rect.height.toFixed(0)} style="${(el as HTMLElement).style.cssText}"`
    })
    return children.join('\n')
  })
  console.log('=== .graph-view children ===\n' + domInfo)

  // Check if there's a blocking element over center
  const canvasInfo = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas')
    return Array.from(canvases).map(c => {
      const rect = c.getBoundingClientRect()
      const center = { x: rect.x + rect.width/2, y: rect.y + rect.height/2 }
      const topEl = document.elementFromPoint(center.x, center.y)
      return `canvas ${rect.width.toFixed(0)}x${rect.height.toFixed(0)} @ (${center.x.toFixed(0)},${center.y.toFixed(0)}) topElement: ${topEl?.tagName} id="${topEl?.id}" class="${topEl?.className}"`
    })
  })
  console.log('=== Canvas / hit-test ===\n' + canvasInfo.join('\n'))

  // Fire wheel event at canvas center and check if NVL processes it
  const canvas = await page.locator('canvas').first().boundingBox()
  if (canvas) {
    const cx = canvas.x + canvas.width / 2
    const cy = canvas.y + canvas.height / 2
    const before = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
    await page.mouse.move(cx, cy)
    await page.mouse.wheel(0, -500)
    await page.waitForTimeout(800)
    const after = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
    console.log(`=== Wheel event: zoom before=${before} after=${after} ===`)
  }

  throw new Error('Diagnostic done — see output above')
})
