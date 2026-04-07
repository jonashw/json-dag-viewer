import { test } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

test('nvlRef diagnostic via __dag helper', async ({ page }) => {
  page.on('console', m => {
    if (!m.text().includes('WebGL') && !m.text().includes('React DevTools')) {
      console.log('BROWSER:', m.text())
    }
  })

  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  await page.waitForTimeout(2500)

  const ready = await page.evaluate(() => (window as any).__dag?.isReady())
  const scale = await page.evaluate(() => (window as any).__dag?.getScale())
  const nvlScale = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  console.log(`=== __dag.isReady=${ready}  __dag.getScale=${scale}  __Nvl_getZoomLevel=${nvlScale} ===`)

  // Try setZoom via __dag (goes through nvlRef.current)
  await page.evaluate(() => (window as any).__dag?.setZoom(2))
  await page.waitForTimeout(600)
  const afterDag = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  console.log(`=== After __dag.setZoom(2): __Nvl_getZoomLevel=${afterDag} ===`)

  // Try clicking zoom button (goes through nvlRef.current in React closure)
  await page.getByTitle('Zoom in').click()
  await page.waitForTimeout(600)
  const afterBtn = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  console.log(`=== After Zoom-In click: __Nvl_getZoomLevel=${afterBtn} ===`)

  // Try native wheel event
  const boxes = await page.locator('canvas').evaluateAll((els) =>
    els.map((c) => { const r = c.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, a: r.width * r.height } })
  )
  const best = boxes.reduce((a, b) => b.a > a.a ? b : a)
  await page.mouse.move(best.x, best.y)
  await page.mouse.wheel(0, -300)
  await page.waitForTimeout(600)
  const afterWheel = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  console.log(`=== After native wheel: __Nvl_getZoomLevel=${afterWheel} ===`)

  throw new Error('Diagnostic done — see output above')
})
