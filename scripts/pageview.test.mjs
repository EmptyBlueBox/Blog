import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'

const source = await readFile(new URL('../src/utils/pageview.js', import.meta.url), 'utf8')
const head = await readFile(new URL('../src/components/BaseHead.astro', import.meta.url), 'utf8')
const head_script = head.match(/<script>\s*(import \{ init_pageview \}[\s\S]*?)<\/script>/)[1]
const settle = () => new Promise((resolve) => setImmediate(resolve))

async function setup({ production = true, origin = 'https://www.lyt0112.com', visible = true } = {}) {
  const requests = []
  const reads = []
  const element = { dataset: { path: '/blog/shared' }, textContent: '—' }
  const document = Object.assign(new EventTarget(), {
    visibilityState: visible ? 'visible' : 'hidden',
    body: { dataset: { pageviewPath: '/blog/shared' } },
    querySelector: () => null,
    querySelectorAll: () => [element]
  })
  const window = Object.assign(new EventTarget(), { location: { origin, pathname: '/blog/shared-en' } })
  const context = createContext({
    document,
    window,
    AbortController,
    URL,
    URLSearchParams,
    fetch: (url, options) => new Promise((resolve) => requests.push({ url, ...options, resolve }))
  })
  const waline = new SyntheticModule(['pageviewCount'], function () {
    this.setExport('pageviewCount', (options) => {
      const read = { ...options, stopped: false }
      reads.push(read)
      return () => { read.stopped = true }
    })
  }, { context })
  const module = new SourceTextModule(source, {
    context,
    initializeImportMeta(meta) {
      meta.env = { PROD: production, SITE: 'https://www.lyt0112.com/' }
    }
  })
  await module.link(() => waline)
  await module.evaluate()
  const entry = new SourceTextModule(head_script, { context })
  await entry.link(() => module)
  await entry.evaluate()
  const load = () => document.dispatchEvent(new Event('astro:page-load'))
  const swap = () => document.dispatchEvent(new Event('astro:before-swap'))
  const visibility = (state) => {
    document.visibilityState = state
    document.dispatchEvent(new Event('visibilitychange'))
  }
  const respond = async (index, time) => {
    requests[index].resolve({ ok: true, json: async () => ({ errno: 0, data: [{ time }] }) })
    await settle()
  }
  return { document, window, element, requests, reads, load, swap, visibility, respond }
}

test('production immediately sends one keepalive request to the shared article counter', async () => {
  const page = await setup()
  page.load()
  assert.equal(page.requests.length, 1)
  const request = page.requests[0]
  assert.equal(request.url, 'https://waline.lyt0112.com/api/article')
  assert.equal(request.method, 'POST')
  assert.equal(request.keepalive, true)
  assert.equal(request.signal, undefined)
  assert.deepEqual(Object.fromEntries(request.body), { path: '/blog/shared', type: 'time', action: 'inc' })
  await page.respond(0, 42)
  assert.equal(page.element.textContent, '42')
  page.visibility('hidden')
  page.visibility('visible')
  assert.equal(page.requests.length, 1)
})

test('development and preview origins only read counts', async () => {
  for (const options of [{ production: false }, { origin: 'https://preview.vercel.app' }]) {
    const page = await setup(options)
    page.load()
    assert.equal(page.requests.length, 0)
    assert.equal(page.reads.length, 1)
    assert.equal(page.reads[0].update, false)
    page.swap()
    assert.equal(page.reads[0].stopped, true)
  }
})

test('background tabs count once when first shown', async () => {
  const page = await setup({ visible: false })
  page.load()
  page.visibility('hidden')
  assert.equal(page.requests.length, 0)
  page.visibility('visible')
  assert.equal(page.requests.length, 1)
  await page.respond(0, 7)
  page.visibility('hidden')
  page.visibility('visible')
  assert.equal(page.requests.length, 1)
})

test('SPA navigation preserves the pending increment without updating the next page', async () => {
  const page = await setup()
  page.load()
  page.swap()
  page.document.body.dataset.pageviewPath = '/next'
  page.element.dataset.path = '/next'
  page.load()
  assert.equal(page.requests.length, 2)
  await page.respond(0, 999)
  assert.equal(page.element.textContent, '—')
  await page.respond(1, 8)
  assert.equal(page.element.textContent, '8')
})

test('a hidden page replaced before it is viewed never reports later', async () => {
  const page = await setup({ visible: false })
  page.load()
  page.swap()
  page.document.body.dataset.pageviewPath = '/next'
  page.load()
  page.visibility('visible')
  assert.equal(page.requests.length, 1)
  assert.equal(page.requests[0].body.get('path'), '/next')
  await page.respond(0, 3)
})

test('back-forward cache restoration counts a new view without doubling initial pageshow', async () => {
  const page = await setup()
  page.load()
  page.window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }))
  assert.equal(page.requests.length, 1)
  await page.respond(0, 10)
  page.window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }))
  assert.equal(page.requests.length, 2)
  await page.respond(1, 11)
  assert.equal(page.element.textContent, '11')
})

test('standalone project pages report without a visible counter', async () => {
  const page = await setup()
  page.document.body.dataset = {}
  page.document.querySelectorAll = () => []
  page.window.location.pathname = '/projects/FINGR'
  page.load()
  assert.equal(page.requests.length, 1)
  assert.equal(page.requests[0].body.get('path'), '/projects/FINGR')
  await page.respond(0, 100)
})
