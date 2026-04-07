import { test } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

test('find blocking element at main canvas center', async ({ page }) => {
  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  await page.waitForTimeout(2000)

  const info = await page.evaluate(() => {
    // (780,381) is center of main canvas
    const x = 780, y = 381
    const topEl = document.elementFromPoint(x, y)
    if (!topEl) return 'null'
    
    // Walk up ancestors
    let el: Element | null = topEl
    const chain: string[] = []
    while (el) {
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      chain.push(`${el.tagName} id="${el.id}" class="${el.className.toString().slice(0,50)}" size=${rect.width.toFixed(0)}x${rect.height.toFixed(0)} pointerEvents=${style.pointerEvents} zIndex=${style.zIndex}`)
      el = el.parentElement
    }
    return chain.join('\n')
  })
  console.log('=== Element chain at (780,381) ===\n' + info)

  // Also check all elements at that point
  const allAtPoint = await page.evaluate(() => {
    const x = 780, y = 381
    const els = document.elementsFromPoint(x, y)
    return els.slice(0, 10).map(el => {
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      return `${el.tagName} id="${el.id}" class="${el.className.toString().slice(0,60)}" size=${rect.width.toFixed(0)}x${rect.height.toFixed(0)} pointer=${style.pointerEvents}`
    }).join('\n')
  })
  console.log('=== All elements at (780,381) ===\n' + allAtPoint)

  throw new Error('diagnostic done')
})
