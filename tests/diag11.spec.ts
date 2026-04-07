import { test } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

test('NVL wheel handler investigation', async ({ page }) => {
  page.on('console', m => {
    if (!m.text().includes('WebGL') && !m.text().includes('DevTools') && !m.text().includes('Download')) {
      console.log('BROWSER:', m.text())
    }
  })
  
  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  await page.waitForTimeout(2000)

  // Intercept NVL's setZoomAndPan and setZoom methods
  const intercepted = await page.evaluate(() => {
    let calls: string[] = []
    
    // Try to intercept via the nvl instance
    const nvlInstance = (window as any).__Nvl_instances?.get('default')
    if (nvlInstance) {
      const origSetZoomAndPan = nvlInstance.setZoomAndPan?.bind(nvlInstance)
      if (origSetZoomAndPan) {
        nvlInstance.setZoomAndPan = (...args: any[]) => {
          calls.push(`setZoomAndPan(${JSON.stringify(args)})`)
          console.log('setZoomAndPan called:', JSON.stringify(args))
          return origSetZoomAndPan(...args)
        }
      }
      const origSetZoom = nvlInstance.setZoom?.bind(nvlInstance)
      if (origSetZoom) {
        nvlInstance.setZoom = (...args: any[]) => {
          calls.push(`setZoom(${JSON.stringify(args)})`)
          console.log('setZoom called:', JSON.stringify(args))
          return origSetZoom(...args)
        }
      }
      ;(window as any).__nvlCalls = calls
      return `intercepted nvlInstance methods. setZoomAndPan=${!!nvlInstance.setZoomAndPan} setZoom=${!!nvlInstance.setZoom}`
    }
    
    // Also check for nvl global
    const keys = Object.keys(window as any).filter(k => k.toLowerCase().includes('nvl'))
    return 'no __Nvl_instances, checking keys: ' + keys.join(', ')
  })
  console.log('=== Intercept result:', intercepted)

  // Fire wheel on the wrapper
  const wrapperBox = await page.locator('#NVL_interactive-wrapper').boundingBox()
  if (!wrapperBox) throw new Error('no wrapper')
  const cx = wrapperBox.x + wrapperBox.width / 2
  const cy = wrapperBox.y + wrapperBox.height / 2
  
  const before = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  await page.mouse.move(cx, cy)
  await page.mouse.wheel(0, -300)
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  const calls = await page.evaluate(() => (window as any).__nvlCalls ?? [])
  
  console.log(`zoom: ${before} -> ${after}`)
  console.log('NVL method calls:', calls)

  throw new Error('diagnostic done')
})
