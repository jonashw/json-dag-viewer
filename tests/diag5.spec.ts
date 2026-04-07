import { test } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

async function loadAndWait(page: any) {
  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  await page.waitForTimeout(3000)
}

test('setZoom after layout done callback and compare qf vs proxy', async ({ page }) => {
  page.on('console', m => {
    const t = m.text()
    if (!t.includes('WebGL') && !t.includes('React DevTools') && !t.includes('[vite]')) {
      console.log('BROWSER:', t)
    }
  })

  await loadAndWait(page)

  // Check if layout is still computing via isLayoutMoving helper
  const info = await page.evaluate(() => {
    // Enumerate what qf looks like (can't access directly, but check via __Nvl helpers)
    const zoom = (window as any).__Nvl_getZoomLevel?.('default')
    const nodesOnScreen = (window as any).__Nvl_getNodesOnScreen?.('default')
    
    // Also: are there are 2+ NVL instances running?
    // We could check by registering callbacks with both "default" and trying other ids
    
    // Let's also count canvases and check their parents
    const canvases = Array.from(document.querySelectorAll('canvas'))
    const parents = canvases.map(c => ({ 
      parentId: c.parentElement?.id,
      parentClass: c.parentElement?.className,
      w: c.width, h: c.height 
    }))
    
    // Check how many times the NVL ctor registered helpers (if window was overwritten)
    const nvlZoom = zoom
    
    return { zoom, nodesOnScreen, parents, nvlZoom }
  })
  console.log('=== PRE-ZOOM INFO:', JSON.stringify(info), '===')

  // Now register a "done" callback via window helper to know EXACTLY when layout is done
  await page.evaluate(() => {
    ;(window as any).__layoutDone = false
    ;(window as any).__Nvl_registerDoneCallback(() => {
      console.log('[LAYOUT DONE CALLBACK] zoom at this moment:', (window as any).__Nvl_getZoomLevel('default'))
      ;(window as any).__layoutDone = true
    }, 'default')
  })
  await page.waitForTimeout(500)

  const layoutDone = await page.evaluate(() => (window as any).__layoutDone)
  console.log('=== layoutDone flag:', layoutDone, '===')

  // Try setZoom via __dag (proxy path)
  const z1 = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  await page.evaluate(() => (window as any).__dag?.setZoom(2))
  await page.waitForTimeout(800)
  const z2 = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  const z2b = await page.evaluate(() => (window as any).__dag?.getScale())
  console.log(`=== zoom via qf: ${z1} → ${z2}  |  zoom via proxy: ${z2b} ===`)

  throw new Error('Done')
})
