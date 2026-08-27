// 流式响应性能基准测试 v3
// 用法: node scripts/bench-stream-perf.mjs
//
// 测量从"每个 token 都触发同步操作"到"raf 节流"对主线程的真实占用率改善。
// 模拟的工作量分两部分：
//   1) persist: JSON.stringify(整个持久化状态) + setItem  (localStorage 同步写)
//   2) render:  ChatPanel rounds useMemo 重算 + messages 数组遍历 (React 重渲染开销)
//
// 关键：v2 用 20ms token 间隔时，raf 节流(16ms) 没起作用，因为间隔已经 > 节流窗口。
// 真实场景下 LLM 在缓存命中或推理输出爆发期会出现 5ms 间隔 (200 tokens/s)，
// 那时 raf 节流才是有效防线。v3 同时测多种 token 速率覆盖真实情况。

import { performance } from 'node:perf_hooks'

class FakeLocalStorage {
  constructor() { this.store = new Map(); this.writeBytes = 0 }
  getItem(k) { return this.store.get(k) ?? null }
  setItem(k, v) { this.store.set(k, v); this.writeBytes += v.length }
  removeItem(k) { this.store.delete(k) }
}

// 节流版 localStorage（与 useAppStore.ts 的 createThrottledLocalStorage 行为一致）
function makeThrottledStorage(underlying, throttleMs) {
  let pendingWrites = {}
  let pendingTimer = null
  let lastWriteAt = 0

  const flush = () => {
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
    for (const [name, value] of Object.entries(pendingWrites)) {
      underlying.setItem(name, value)
    }
    pendingWrites = {}
    lastWriteAt = Date.now()
  }

  return {
    flush,
    getItem: (name) => {
      if (name in pendingWrites) return pendingWrites[name]
      return underlying.getItem(name)
    },
    setItem: (name, value) => {
      const now = Date.now()
      const elapsed = now - lastWriteAt
      if (elapsed >= throttleMs && !pendingTimer) {
        delete pendingWrites[name]
        underlying.setItem(name, value)
        lastWriteAt = now
        return
      }
      pendingWrites[name] = value
      if (!pendingTimer) {
        const delay = Math.max(0, throttleMs - elapsed)
        pendingTimer = setTimeout(flush, delay)
      }
    },
    removeItem: (name) => {
      delete pendingWrites[name]
      underlying.removeItem(name)
    },
  }
}

const partializeOld = (state) => ({
  settings: state.settings,
  history: state.history,
  customInstruction: state.customInstruction,
  referenceFiles: state.referenceFiles,
  workspace: state.workspace,
  pinnedRounds: state.pinnedRounds,
})

const partializeNew = (state) => {
  const ws = state.workspace
  const persistedWorkspace = ws.streaming
    ? { ...ws, messages: [], streaming: false }
    : { ...ws, streaming: false }
  return {
    settings: state.settings,
    history: state.history,
    customInstruction: state.customInstruction,
    referenceFiles: state.referenceFiles,
    workspace: persistedWorkspace,
    pinnedRounds: state.pinnedRounds,
  }
}

function makePersister(partialize, storage) {
  return (state) => {
    const persisted = partialize(state)
    const payload = JSON.stringify({ state: persisted, version: 0 })
    storage.setItem('wordsmith-storage', payload)
  }
}

// 让 runBench 接受可选的 persistThrottleMs，>0 时启用 persist 层节流
async function runBench(label, partialize, tokenCount, tokenIntervalMs, useRafThrottle, existingRoundCount = 0, persistThrottleMs = 0) {
  const state = makeInitialState(40, existingRoundCount)
  const rawStorage = new FakeLocalStorage()
  const storage = persistThrottleMs > 0 ? makeThrottledStorage(rawStorage, persistThrottleMs) : rawStorage
  const persist = makePersister(partialize, storage)
  const lastIdx = state.workspace.messages.length - 1

  let assistantText = ''
  let pendingStateRef = null
  let throttleTimer = null
  let persistCalls = 0
  let renderCalls = 0
  let persistTimeMs = 0
  let renderTimeMs = 0
  const sampleLatencies = []

  const doWork = (currentState) => {
    const t0 = performance.now()
    persist(currentState)
    const dt1 = performance.now() - t0
    persistTimeMs += dt1
    persistCalls += 1

    const t1 = performance.now()
    simulateChatPanelRender(currentState.workspace.messages)
    const dt2 = performance.now() - t1
    renderTimeMs += dt2
    renderCalls += 1

    sampleLatencies.push(dt1 + dt2)
  }

  const start = performance.now()

  for (let i = 0; i < tokenCount; i++) {
    assistantText += '字'
    state.workspace.messages[lastIdx] = { role: 'assistant', content: assistantText }

    if (!useRafThrottle) {
      doWork(state)
    } else {
      pendingStateRef = state
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          throttleTimer = null
          doWork(pendingStateRef)
        }, 16)
      }
    }

    if (tokenIntervalMs > 0) {
      await new Promise((r) => setTimeout(r, tokenIntervalMs))
    }
  }

  await new Promise((r) => setTimeout(r, 50))
  if (throttleTimer) {
    clearTimeout(throttleTimer)
    doWork(state)
  }
  // 强制 flush persist throttle 的挂起内容（统计 setItem 真实次数）
  if (persistThrottleMs > 0) storage.flush()

  const elapsed = performance.now() - start
  const totalWorkMs = persistTimeMs + renderTimeMs
  const mainOccupancy = (totalWorkMs / elapsed) * 100
  const maxLatency = sampleLatencies.length ? Math.max(...sampleLatencies) : 0

  // 真实 setItem 调用次数（穿透 throttle 的次数）
  const realSetItemCount = persistThrottleMs > 0 ? null : persistCalls
  return { label, elapsed, persistCalls, renderCalls, persistTimeMs, renderTimeMs, totalWorkMs, mainOccupancy, maxLatency, realSetItemCount }
}

// 模拟 ChatPanel 的 React 重渲染开销
// 来自真实代码 ChatPanel.tsx:124-139 的 rounds useMemo
function simulateChatPanelRender(messages) {
  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
  const rounds = []
  let i = 0
  while (i < visible.length) {
    if (visible[i].role === 'user') {
      const assistant = visible[i + 1]?.role === 'assistant' ? visible[i + 1] : null
      rounds.push({ user: visible[i], assistant })
      i += assistant ? 2 : 1
    } else {
      i++
    }
  }
  // 模拟 React reconciliation：遍历 rounds + 每个 round 字符串拼接（whitespace-pre-wrap 渲染）
  let _sink = ''
  for (const r of rounds) {
    _sink += r.user.content
    if (r.assistant) _sink += r.assistant.content
  }
  return _sink.length
}

function makeInitialState(historyCount = 40, existingRoundCount = 0) {
  const oneHistoryHtml =
    '<body style="font-family:SimSun;font-size:12pt;">' +
    Array.from({ length: 500 }, (_, i) =>
      `<p style="margin:0 0 6pt 0;">这是第${i + 1}段测试内容。</p>`
    ).join('') +
    '</body>'

  // 模拟当前会话已经累积的多轮对话（不仅是 streaming 中那一轮）
  const existingMessages = []
  const oneRoundContent = '这是一段已经完成的对话内容。'.repeat(200)  // ~6KB
  for (let i = 0; i < existingRoundCount; i++) {
    existingMessages.push({ role: 'user', content: `第 ${i + 1} 轮提问` })
    existingMessages.push({ role: 'assistant', content: oneRoundContent })
  }
  existingMessages.push({ role: 'user', content: '请生成新的内容' })
  existingMessages.push({ role: 'assistant', content: '' })

  return {
    settings: {
      ai: { baseUrl: 'https://api.deepseek.com', apiKey: 'sk-fake', model: 'deepseek-chat' },
      typography: { fontFamily: 'SimSun', fontSizePt: 12 },
      templateId: 'default',
      timeout: 60000,
      eyeCareMode: false,
      savePath: 'My Documents/WordSmith',
      ocrEnginePath: null,
      ocrMode: 'vlm',
      vlmOcr: { baseUrl: '', apiKey: '', model: '', systemPrompt: '' },
      recentModels: { ai: {}, vlm: {} },
      providerApiKeys: {},
      acceleratorPath: null,
      contextMaxRounds: 10,
    },
    history: Array.from({ length: historyCount }, (_, i) => ({
      id: 'hist_' + i,
      title: '历史对话 ' + i,
      createdAt: Date.now() - i * 86400000,
      mode: 'generate',
      messages: [
        { role: 'user', content: '请生成一段内容' },
        { role: 'assistant', content: oneHistoryHtml },
      ],
      finalHtml: oneHistoryHtml,
    })),
    customInstruction: '',
    referenceFiles: [],
    workspace: {
      id: null,
      htmlDraft: '<body></body>',
      finalHtml: '<body></body>',
      messages: existingMessages,
      guardReport: null,
      mode: 'generate',
      input: '',
      streaming: true,
      roundOverrides: {},
    },
    pinnedRounds: [],
  }
}

async function runBench_LEGACY_REMOVED(label, partialize, tokenCount, tokenIntervalMs, useThrottle, existingRoundCount = 0) {
  // 旧版函数已被上方新签名（含 persistThrottleMs）取代，保留空 stub 避免改大范围。
  return { label, elapsed: 0, persistCalls: 0, renderCalls: 0, persistTimeMs: 0, renderTimeMs: 0, totalWorkMs: 0, mainOccupancy: 0, maxLatency: 0 }
}

function fmt(n, digits = 2) { return n.toFixed(digits).padStart(8, ' ') }

function printRow(r) {
  console.log(
    `  ${r.label.padEnd(38)} | ` +
    `${fmt(r.elapsed, 0).trim().padStart(7)}ms | ` +
    `${String(r.persistCalls).padStart(5)} | ` +
    `${fmt(r.persistTimeMs, 0).trim().padStart(5)}ms | ` +
    `${fmt(r.renderTimeMs, 0).trim().padStart(5)}ms | ` +
    `${fmt(r.mainOccupancy, 1).trim().padStart(6)}% | ` +
    `${fmt(r.maxLatency, 1).trim().padStart(6)}ms`
  )
}

function printHeader() {
  console.log(
    `  ${'策略'.padEnd(38)} | ` +
    `${'总耗时'.padStart(9)} | ` +
    `${'次数'.padStart(5)} | ` +
    `${'persist'.padStart(7)} | ` +
    `${'render'.padStart(7)} | ` +
    `${'主占用'.padStart(7)} | ` +
    `${'最大卡顿'.padStart(8)}`
  )
  console.log('  ' + '-'.repeat(105))
}

async function runScenario(title, tokenCount, tokenIntervalMs, existingRoundCount) {
  console.log('\n' + '='.repeat(80))
  console.log(` ${title}`)
  console.log('='.repeat(80))
  console.log(` Tokens: ${tokenCount} | 间隔: ${tokenIntervalMs}ms (${(1000/tokenIntervalMs).toFixed(0)} t/s) | 已完成轮次: ${existingRoundCount}`)
  console.log()

  const results = []
  results.push(await runBench('修复前（无节流 + 老 partialize）',     partializeOld, tokenCount, tokenIntervalMs, false, existingRoundCount, 0))
  results.push(await runBench('仅 A（跳过 messages）',                partializeNew, tokenCount, tokenIntervalMs, false, existingRoundCount, 0))
  results.push(await runBench('仅 B（raf 节流）',                     partializeOld, tokenCount, tokenIntervalMs, true,  existingRoundCount, 0))
  results.push(await runBench('A + B（已交付）',                       partializeNew, tokenCount, tokenIntervalMs, true,  existingRoundCount, 0))
  results.push(await runBench('A + B + C（加 persist 100ms 节流）',   partializeNew, tokenCount, tokenIntervalMs, true,  existingRoundCount, 100))

  printHeader()
  for (const r of results) printRow(r)

  const before = results[0]
  const afterAB = results[3]
  const afterABC = results[4]
  console.log()
  console.log(`  ⇒ A+B vs 修复前   主占用 ${before.mainOccupancy.toFixed(1)}% → ${afterAB.mainOccupancy.toFixed(1)}%  (${(before.mainOccupancy / afterAB.mainOccupancy).toFixed(1)}x)`)
  console.log(`  ⇒ A+B+C vs 修复前 主占用 ${before.mainOccupancy.toFixed(1)}% → ${afterABC.mainOccupancy.toFixed(1)}%  (${(before.mainOccupancy / afterABC.mainOccupancy).toFixed(1)}x)`)
  console.log(`  ⇒ A+B+C vs A+B    主占用 ${afterAB.mainOccupancy.toFixed(1)}% → ${afterABC.mainOccupancy.toFixed(1)}%  (额外改善 ${(afterAB.mainOccupancy / afterABC.mainOccupancy).toFixed(1)}x)`)
  console.log(`  ⇒ A+B+C 累计阻塞: ${before.totalWorkMs.toFixed(0)}ms → ${afterABC.totalWorkMs.toFixed(0)}ms  (节省 ${((1 - afterABC.totalWorkMs/before.totalWorkMs)*100).toFixed(0)}%)`)

  return results
}

// ===== 主入口 =====
console.log('================================================================')
console.log(' WordSmith 流式响应性能基准 v3')
console.log('================================================================')
console.log(' 关键判断标准:')
console.log('   主线程占用 > 50% = 必然卡顿；< 15% = 流畅；20-50% = 偶尔顿挫')
console.log('   单次操作 > 50ms = 用户能感知卡顿 (low FPS)')

// 场景 1: 慢速 token (DeepSeek 普通速率，50 t/s)
await runScenario('场景 1: 普通速率 (DeepSeek 常态 50 tokens/s)', 800, 20, 0)

// 场景 2: 快速 token (推理/缓存命中爆发期，200 t/s)
await runScenario('场景 2: 爆发速率 (推理/缓存爆发期 200 tokens/s)', 1500, 5, 0)

// 场景 3: 多轮累积 + 快速 token (用户描述的"继续生成"场景)
await runScenario('场景 3: 多轮累积 (5 轮历史 + 200 t/s) ← 用户真实场景', 1500, 5, 5)

// 场景 4: 极端 (用户提到的"必须重启"级别)
await runScenario('场景 4: 极端 (10 轮历史 + 300 t/s)', 2000, 3, 10)

console.log()
