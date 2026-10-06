import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { test } from 'node:test'
import vm from 'node:vm'

const desktopRoot = process.env.HERMES_DESKTOP_ROOT
if (!desktopRoot) throw new Error('Set HERMES_DESKTOP_ROOT to the apps/desktop directory of a Hermes checkout with npm dependencies installed')
const requireDesktop = createRequire(`${desktopRoot}/package.json`)
const React = requireDesktop('react')
const { renderToStaticMarkup } = requireDesktop('react-dom/server')
const jsxRuntime = requireDesktop('react/jsx-runtime')
const source = await readFile(new URL('../desktop/plugin.js', import.meta.url), 'utf8')

async function loadPlugin() {
  const state = {
    sessionId: 'runtime-1', owner: { connectionId: 'remote-a', profile: 'default' }, busy: false,
    busyBySession: {},
    routes: [{ connectionId: 'remote-a', profile: 'default', targetProfile: 'default', mode: 'remote' }],
    routesLoading: false, routesError: false, usage: null,
    expanded: false, refetches: 0, accountRefetches: 0, items: [], request: null,
    events: new Map(), resets: [],
    accountQuery: { isFetching: false, isPending: false, isError: false, data: { account_lines: [] } },
    cursorQuery: { isFetching: false, isPending: false, isError: false, data: { status: 'empty', windows: [] } },
    quotaResponse: null,
    settingsQuery: {
      isFetching: false, isPending: false, isError: false, error: null,
      data: {
        show_openai_codex: true, show_anthropic: true, show_openrouter: true, show_other: true
      }
    },
    pluginsPayload: null,
    settingsError: null,
    settingsRefetches: 0,
    requests: [],
    navigations: [],
    codicons: [],
    query: { isFetching: false, isPending: false, isError: false, data: { context_max: 4000, context_files: [] } }
  }
  const atoms = {
    focusedSessionId: { get: () => state.sessionId },
    focusedSessionOwner: { get: () => state.owner },
    focusedUsage: { get: () => state.usage },
    busy: { get: () => state.busy },
    busyBySession: { get: () => state.busyBySession },
    connectionId: { get: () => 'remote-a' },
    profile: { get: () => 'default' }
  }
  const sdk = {
    STATUSBAR_AREAS: { right: 'statusBar.right' },
    Codicon: ({ name, ...props }) => {
      state.codicons.push({ name, ...props })
      return React.createElement('i', { 'aria-hidden': 'true', className: `codicon codicon-${name}` })
    },
    DropdownMenuItem: ({ children, ...props }) => {
      state.items.push({ children, ...props })
      return React.createElement('button', {
        type: 'button', 'aria-expanded': props['aria-expanded'], 'aria-label': props['aria-label'],
        className: props.className
      }, children)
    },
    host: {
      state: atoms,
      navigate: path => { state.navigations.push(path) },
      profileRoutes: async () => state.routes,
      requestProfile: async (...args) => {
        state.request = args
        state.requests.push(args)
        if (args[1] === 'plugins.manage') {
          if (state.settingsError) throw state.settingsError
          return state.pluginsPayload
        }
        if (args[1] === 'cli.exec') return state.quotaResponse
        return state.query.data
      }
    },
    queryClient: { resetQueries: async options => { state.resets.push(options) } },
    usePluginI18n: () => (key, ...args) => {
      const parts = key.split('.')
      let value = state.translations.en
      for (const part of parts) value = value?.[part]
      return typeof value === 'function' ? value(...args) : value ?? key
    },
    useQuery: options => {
      if (options.queryKey[1] === 'routes') {
        state.routesOptions = options
        return { data: state.routesLoading ? undefined : state.routes,
          isFetching: state.routesLoading, isPending: state.routesLoading, isError: state.routesError }
      }
      if (options.queryKey[1] === 'account-limits') {
        state.accountOptions = options
        const cacheKey = options.queryKey.map(part => String(part ?? '')).join('\0')
        const refetch = async () => { state.accountRefetches += 1 }
        // A pinned snapshot belongs to one query key. A new key is a new observer.
        if (state.accountCacheKey != null && state.accountCacheKey !== cacheKey) {
          return { isFetching: false, isPending: true, isFetched: false, isError: false, data: undefined, refetch }
        }
        return { ...state.accountQuery, refetch }
      }
      if (options.queryKey[1] === 'provider-settings') {
        state.settingsOptions = options
        return { ...state.settingsQuery, refetch: async () => { state.settingsRefetches += 1 } }
      }
      if (options.queryKey[1] === 'cursor-limits') {
        state.cursorOptions = options
        return { ...state.cursorQuery, refetch: async () => { state.cursorRefetches = (state.cursorRefetches || 0) + 1 } }
      }
      state.options = options
      return { ...state.query, refetch: async () => { state.refetches += 1 } }
    },
    useValue: atom => atom.get()
  }
  const modules = {
    '@hermes/plugin-sdk': sdk,
    react: { useId: () => 'details-id', useState: () => [state.expanded, next => {
      state.expanded = typeof next === 'function' ? next(state.expanded) : next
    }] },
    'react/jsx-runtime': jsxRuntime
  }
  const context = vm.createContext({ Intl, Number, Set })
  const pluginModule = new vm.SourceTextModule(source, { context })
  await pluginModule.link(specifier => new vm.SyntheticModule(Object.keys(modules[specifier]), function () {
    for (const [key, value] of Object.entries(modules[specifier])) this.setExport(key, value)
  }, { context }))
  await pluginModule.evaluate()
  const plugin = pluginModule.namespace.default
  const registrations = []
  plugin.register({
    i18n: { register: bundles => { state.translations = bundles } },
    onEvent: (type, callback) => { state.events.set(type, callback); return () => state.events.delete(type) },
    register: c => registrations.push(c)
  })
  const menu = () => {
    state.items = []
    state.codicons = []
    return renderToStaticMarkup(registrations[0].data.menuContent())
  }
  return { state, plugin, registrations, menu }
}

const files = [
  { label: 'AGENTS.md', path: '/repo/AGENTS.md', est_tokens: 12000, status: 'truncated', loaded: true },
  { label: 'CLAUDE.md', path: '/repo/CLAUDE.md', est_tokens: 4000, status: 'shadowed', loaded: false }
]

test('registers an SDK statusbar menu', async () => {
  const { plugin, registrations, state } = await loadPlugin()
  assert.equal(plugin.defaultEnabled, true)
  assert.equal(plugin.id, 'context-window-visualizer')
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].area, 'statusBar.right')
  assert.equal(registrations[0].data.variant, 'menu')
  assert.ok(registrations[0].data.label)
  assert.equal(typeof state.translations.en.status.truncated, 'string')
  assert.deepEqual(Array.from(state.events.keys()), ['session.info', 'session.reclaimed'])
  state.events.get('session.info')({ session_id: 'runtime-1', connectionId: 'remote-a', profile: 'default' })
  assert.deepEqual(Array.from(state.resets[0].queryKey), ['context-window-visualizer', 'remote-a', 'default', 'runtime-1'])
  assert.equal(state.resets[0].exact, true)
  assert.deepEqual(Array.from(state.resets[1].queryKey), ['context-window-visualizer', 'account-limits', 'remote-a', 'default', 'runtime-1'])
  state.resets = []
  state.events.get('session.reclaimed')({ session_id: '', payload: { session_id: 'runtime-1' } })
  assert.equal(state.resets.length, 2)
  assert.deepEqual(Array.from(state.resets[0].queryKey), ['context-window-visualizer', 'remote-a', 'default', 'runtime-1'])
})

test('paints context occupancy in the footer before the menu is opened', async () => {
  const { state, registrations } = await loadPlugin()
  state.query.data = { model: 'example-model-200k', context_max: 200000, context_used: 50000,
    context_percent: 25, context_estimated: false, categories: [], context_files: [] }
  const html = renderToStaticMarkup(registrations[0].data.label)
  assert.match(html, />Context<\/span>/)
  assert.doesNotMatch(html, /Calculating\.\.\./)
  assert.match(html, /role="progressbar"/)
  assert.match(html, /aria-valuenow="25"/)
  assert.match(html, /25%/)
  assert.match(html, /width:25%/)
  state.query.isFetching = true
  const refreshing = renderToStaticMarkup(registrations[0].data.label)
  assert.doesNotMatch(refreshing, /aria-valuenow=/)
  state.query.isFetching = false
  state.busy = true
  state.usage = { context_max: 100000, context_used: 7000, context_estimated: true }
  const live = renderToStaticMarkup(registrations[0].data.label)
  assert.match(live, />Calculating\.\.\.<\/span>/)
  assert.doesNotMatch(live, />Context<\/span>/)
  assert.match(live, /~7%/)
  assert.match(live, /width:7%/)
  assert.match(live, /aria-valuetext="7% used, Estimated occupancy"/)
  assert.doesNotMatch(live, /25%/)
  state.busy = false
  state.sessionId = null
  const empty = renderToStaticMarkup(registrations[0].data.label)
  assert.match(empty, />Context<\/span>/)
  assert.match(empty, /role="progressbar"/)
  assert.doesNotMatch(empty, /aria-valuenow=/)
})

test('visualizes the focused model context window, occupancy, and estimated composition', async () => {
  const { state, menu } = await loadPlugin()
  state.query.data = {
    model: 'example-model-200k', context_max: 200000, context_used: 50000,
    context_percent: 25, context_estimated: false, context_files: [],
    categories: [
      { id: 'system_prompt', label: 'System prompt', tokens: 10000, color: 'var(--context-usage-system)' },
      { id: 'conversation', label: 'Conversation', tokens: 30000, color: 'var(--context-usage-conversation)' }
    ]
  }
  const html = menu()
  assert.match(html, /example-model-200k/)
  assert.match(html, /25% used/)
  assert.match(html, /aria-valuetext="25% used"/)
  assert.match(html, /50K \/ 200K tokens/i)
  assert.match(html, /role="progressbar"/)
  assert.match(html, /Estimated composition/)
  assert.match(html, /System prompt/)
  assert.match(html, /Conversation/)
  assert.doesNotMatch(html, /full file/)
})

test('paints category swatches from known ids and drops remote color strings', async () => {
  const { state, menu } = await loadPlugin()
  const attack = 'url("https://evil.example/steal")'
  state.query.data = {
    model: 'example-model-200k', context_max: 200000, context_used: 50000,
    context_estimated: false, context_files: [],
    categories: [
      { id: 'system_prompt', label: 'System prompt', tokens: 1000, color: attack },
      { id: 'tool_definitions', label: 'Tool definitions', tokens: 1000, color: attack },
      { id: 'rules', label: 'Rules', tokens: 1000, color: attack },
      { id: 'skills', label: 'Skills', tokens: 1000, color: attack },
      { id: 'mcp', label: 'MCP', tokens: 1000, color: attack },
      { id: 'subagent_definitions', label: 'Subagents', tokens: 1000, color: attack },
      { id: 'memory', label: 'Memory', tokens: 1000, color: attack },
      { id: 'conversation', label: 'Conversation', tokens: 1000, color: attack },
      { id: 'not_a_category', label: 'Injected', tokens: 1000, color: attack }
    ]
  }
  const html = menu()
  for (const color of [
    'var(--context-usage-system)',
    'var(--context-usage-tools)',
    'var(--context-usage-rules)',
    'var(--context-usage-skills)',
    'var(--context-usage-mcp)',
    'var(--context-usage-subagents)',
    'var(--context-usage-memory)',
    'var(--context-usage-conversation)',
    'var(--ui-stroke-tertiary)'
  ]) {
    assert.ok(html.includes(`background:${color}`), color)
  }
  assert.equal((html.match(/background:var\(--ui-stroke-tertiary\)/g) || []).length, 3)
  assert.doesNotMatch(html, /url\(/i)
  assert.doesNotMatch(html, /evil\.example/)
})

test('uses live focused usage mid-turn without showing stale model or category data', async () => {
  const { state, menu } = await loadPlugin()
  state.busy = true
  state.usage = { context_max: 100000, context_used: 7000, context_estimated: true }
  state.query.data = { model: 'old-model', context_max: 200000, categories: [
    { id: 'conversation', label: 'Conversation', tokens: 1000, color: 'var(--context-usage-conversation)' }
  ] }
  const html = menu()
  assert.match(html, /7% used/)
  assert.match(html, /~7K \/ 100K tokens/i)
  assert.match(html, /Estimated occupancy/)
  assert.doesNotMatch(html, /old-model|Estimated composition/)
  assert.equal(state.options.enabled, false)
})

test('keeps an idle focused chat readable while another session runs', async () => {
  const { state, menu, registrations } = await loadPlugin()
  state.busy = true
  state.busyBySession = { 'runtime-1': false, 'runtime-2': true }
  state.query.data = { model: 'idle-model', context_max: 200000, context_used: 50000,
    context_estimated: false, context_files: [], categories: [] }
  state.accountQuery.data = { account_lines: ['Provider: example-provider (Pro)',
    'Weekly: 80% remaining (20% used)'] }
  const idle = menu()
  assert.match(idle, /idle-model/)
  assert.match(idle, /25% used/)
  assert.match(idle, /Weekly/)
  assert.doesNotMatch(idle, /Waiting for the response to finish before fetching the latest details/)
  assert.equal(state.options.enabled, true)
  assert.equal(state.accountOptions.enabled, true)
  assert.match(renderToStaticMarkup(registrations[0].data.label), />Context<\/span>/)

  state.sessionId = 'runtime-2'
  state.busy = false
  state.usage = { context_max: 100000, context_used: 7000 }
  const active = menu()
  assert.match(renderToStaticMarkup(registrations[0].data.label), />Calculating\.\.\.<\/span>/)
  assert.match(active, /Waiting for the response to finish before fetching the latest details/)
  assert.doesNotMatch(active, /idle-model|Weekly/)
  assert.equal(state.options.enabled, false)
})

test('routes model breakdown reads to the focused chat connection after a switch', async () => {
  const { state, menu } = await loadPlugin()
  state.owner = { connectionId: 'remote-b', profile: 'work' }
  state.sessionId = 'runtime-2'
  state.routes = [{ connectionId: 'remote-b', profile: 'work', targetProfile: 'work', mode: 'remote' }]
  state.query.data = { model: 'example-model-200k', context_max: 100000, context_used: 1,
    context_estimated: false, categories: [], context_files: [] }
  menu()
  assert.deepEqual(Array.from(state.options.queryKey), ['context-window-visualizer', 'remote-b', 'work', 'runtime-2'])
  await state.options.queryFn()
  assert.equal(state.request[0].connectionId, 'remote-b')
  assert.equal(state.request[2].session_id, 'runtime-2')
  assert.equal(state.request[3], 12_000)
  assert.deepEqual(Array.from(state.accountOptions.queryKey), ['context-window-visualizer', 'account-limits', 'remote-b', 'work', 'runtime-2', 'example-model-200k', 'on menu open'])
  await state.accountOptions.queryFn()
  assert.equal(state.request[0].connectionId, 'remote-b')
  assert.equal(state.request[1], 'session.usage')
  assert.equal(state.request[2].session_id, 'runtime-2')
  assert.equal(state.request[3], 25_000)
})

test('hides the account section when the returned openai-codex provider is disabled', async () => {
  const { state, menu } = await loadPlugin()
  state.query.data = {
    model: 'example-model-200k', context_max: 200000, context_used: 50000,
    context_percent: 25, context_estimated: false, context_files: [], categories: []
  }
  state.accountQuery.data = { account_lines: [
    'Provider: openai-codex (Pro)',
    'Weekly: 80% remaining (20% used)'
  ] }
  state.settingsQuery.data = {
    show_openai_codex: false, show_anthropic: true, show_openrouter: true, show_other: true
  }
  const html = menu()
  assert.match(html, /example-model-200k/)
  assert.match(html, /25% used/)
  assert.match(html, /role="progressbar"/)
  assert.doesNotMatch(html, /Account limits/)
  assert.doesNotMatch(html, /openai-codex/)
  assert.doesNotMatch(html, /Weekly/)
  assert.equal(state.accountOptions.enabled, true)
})

test('shows only provider-reported account windows as remaining-allowance bars', async () => {
  const { state, menu } = await loadPlugin()
  state.accountQuery.data = { account_lines: [
    '📈 Account limits', 'Provider: openai-codex (Pro)',
    '5h session: 63% remaining (37% used) • resets in 1h 10m (2030-01-01 12:00 UTC)',
    'Weekly: 80% remaining (20% used) • resets in 6d 12h (2030-01-08 12:00 UTC)',
    'You have 2 resets banked - use /usage reset to activate'
  ] }
  const html = menu()
  assert.match(html, /Account limits/)
  assert.match(html, /openai-codex \(Pro\)/)
  assert.match(html, /5h session: 63% remaining|5h session<\/span><span[^>]*>63% remaining/)
  assert.match(html, /Weekly/)
  assert.match(html, /aria-label="Weekly Account limits"[^>]*aria-valuenow="80"/)
  assert.match(html, /width:80%/)
  assert.match(html, /resets in 6d 12h/)
  state.accountQuery.isFetching = true
  const refreshing = menu()
  assert.match(refreshing, /Loading account limits/)
  assert.doesNotMatch(refreshing, /63% remaining|80% remaining/)
  state.accountQuery.isFetching = false
  assert.doesNotMatch(html, /Provider rate-limit allowance|Exact token balances are not reported/)
  assert.doesNotMatch(html, /resets banked/)
  assert.equal(state.accountOptions.enabled, true)
  assert.equal(state.accountOptions.refetchInterval, undefined)
  assert.equal(state.accountOptions.staleTime, 0)
  assert.equal(state.accountOptions.refetchOnMount, 'always')
})

test('does not invent hourly or token quota when only a weekly window is reported', async () => {
  const { state, menu } = await loadPlugin()
  state.accountQuery.data = { account_lines: [
    'Provider: openai-codex (Pro)',
    'Weekly: 80% remaining (20% used) • resets in 6d 11h (2030-01-08 12:00 UTC)'
  ] }
  const html = menu()
  assert.match(html, /Weekly/)
  assert.doesNotMatch(html, /5h session|Hourly|\d+ tokens remaining/)
  assert.equal((html.match(/aria-label="Weekly Account limits"/g) || []).length, 1)
  state.accountQuery.data = { account_lines: ['Provider: openai-codex', 'Weekly: 160% remaining (0% used)'] }
  assert.match(menu(), /No account-limit windows reported/)
  assert.doesNotMatch(menu(), /160% remaining/)
  state.accountQuery.data = { account_lines: ['Provider: example-provider', 'Weekly: unavailable', 'Unavailable: provider timeout'] }
  assert.match(menu(), /Account limits unavailable/)
  state.accountQuery.data = { total: 10 }
  assert.match(menu(), /Account limits unavailable/)
  state.accountQuery = { isFetching: false, isPending: false, isError: true }
  assert.match(menu(), /Account limits unavailable/)
  state.sessionId = null
  menu()
  assert.equal(state.accountOptions.enabled, false)
  assert.doesNotMatch(menu(), /Account limits unavailable/)
})

test('fetches the focused runtime session and distinguishes whole-file size from usage', async () => {
  const { state, menu } = await loadPlugin()
  state.query.data.context_files = files
  let html = menu()
  assert.match(html, /Context files \(2\)/)
  assert.doesNotMatch(html, /\/repo\/AGENTS\.md/)
  assert.deepEqual(Array.from(state.options.queryKey), ['context-window-visualizer', 'remote-a', 'default', 'runtime-1'])
  assert.equal(state.routesOptions.enabled, true)
  assert.equal(state.routesOptions.refetchOnMount, 'always')
  assert.deepEqual(Array.from(await state.routesOptions.queryFn()), state.routes)
  assert.equal(state.options.enabled, true)
  await state.options.queryFn()
  assert.equal(state.request[0].connectionId, 'remote-a')
  assert.equal(state.request[1], 'session.context_breakdown')
  assert.equal(state.request[2].session_id, 'runtime-1')
  assert.equal(state.request[3], 12_000)
  assert.equal(state.request.length, 4)
  let prevented = false
  state.items.find(item => item['aria-controls'] === 'details-id').onSelect({ preventDefault: () => { prevented = true } })
  assert.equal(prevented, true)
  html = menu()
  assert.match(html, /~12K full file/i)
  assert.match(html, /~4K full file/i)
  assert.match(html, /Full-file estimates before truncation/)
  assert.match(html, /AGENTS\.md/)
  assert.doesNotMatch(html, /\/repo\//)
  assert.match(html, /Loaded — truncated at the context-file limit/)
  assert.match(html, /Not loaded — a higher-priority context file won/)
  assert.match(html, /aria-expanded="true"/)
})

test('shows context-file basenames by default without parent paths', async () => {
  const { state, menu } = await loadPlugin()
  state.query.data = {
    model: 'example-model-200k', context_max: 200000, context_used: 50000,
    context_percent: 25, context_estimated: false, categories: [],
    context_files: [
      { label: 'AGENTS.md', path: '/example/work/private/AGENTS.md', est_tokens: 1200, status: 'loaded', loaded: true },
      { label: 'CLAUDE.md', path: 'C:\\example\\private\\CLAUDE.md', est_tokens: 800, status: 'shadowed', loaded: false }
    ]
  }
  menu()
  state.items.find(item => item['aria-controls'] === 'details-id').onSelect({ preventDefault: () => {} })
  const html = menu()
  assert.match(html, /AGENTS\.md/)
  assert.match(html, /CLAUDE\.md/)
  assert.match(html, />Loaded</)
  assert.match(html, /Not loaded — a higher-priority context file won/)
  assert.match(html, /~1\.2K full file/i)
  assert.match(html, /~800 full file/i)
  assert.doesNotMatch(html, /example\/work\/private/)
  assert.doesNotMatch(html, /example\\private/)
  assert.doesNotMatch(html, /example\/private/)
  assert.doesNotMatch(html, /title="[^"]*[/\\]/)
})

test('omits the context-file path element when paths are hidden', async () => {
  const { state, menu } = await loadPlugin()
  state.settingsQuery.data = { ...state.settingsQuery.data, context_file_paths: 'hidden' }
  state.query.data = {
    model: 'example-model-200k', context_max: 200000, context_used: 50000,
    context_percent: 25, context_estimated: false, categories: [],
    context_files: [
      { label: '/example/work/private/AGENTS.md', path: '/example/work/private/AGENTS.md/', est_tokens: 1200, status: 'loaded', loaded: true },
      { label: 'C:\\example\\private\\CLAUDE.md', path: 'C:\\example\\private\\CLAUDE.md\\', est_tokens: 800, status: 'shadowed', loaded: false }
    ]
  }
  menu()
  state.items.find(item => item['aria-controls'] === 'details-id').onSelect({ preventDefault: () => {} })
  const html = menu()
  assert.match(html, />AGENTS\.md</)
  assert.match(html, />CLAUDE\.md</)
  assert.match(html, />Loaded</)
  assert.match(html, /Not loaded — a higher-priority context file won/)
  assert.match(html, /~1\.2K full file/i)
  assert.match(html, /~800 full file/i)
  assert.doesNotMatch(html, /<p[^>]*title=/)
  assert.doesNotMatch(html, /example\/work\/private/)
  assert.doesNotMatch(html, /example\\private/)
  assert.doesNotMatch(html, /title="/)
  assert.doesNotMatch(html, /aria-label="[^"]*[/\\]/)
})

test('refuses stale data while busy, and distinguishes unavailable and error states', async () => {
  const { state, menu } = await loadPlugin()
  state.query.data.context_files = files
  state.busy = true
  assert.match(menu(), /Waiting for the response to finish before fetching the latest details/)
  assert.doesNotMatch(menu(), /AGENTS\.md/)
  assert.equal(state.options.enabled, false)
  state.busy = false
  state.query = { isFetching: false, isPending: false, isError: true }
  assert.match(menu(), /Could not load/)
  state.sessionId = null
  assert.match(menu(), /Open a chat/)
  assert.equal(state.options.enabled, false)
  state.sessionId = 'runtime-2'
  state.query = { isFetching: false, isPending: false, isError: false, data: { context_max: 0 } }
  assert.match(menu(), /Send a message/)
  assert.equal(state.accountOptions.enabled, false)
  assert.doesNotMatch(menu(), /Account limits/)
  state.routesLoading = true
  assert.match(menu(), /Loading context files/)
  assert.equal(state.options.enabled, false)
})

test('unknown statuses fall back, refresh stays in the menu, and disabled connection prevents RPC', async () => {
  const { state, menu } = await loadPlugin()
  state.query.data.context_files = [{ ...files[0], status: 'future-status' }]
  menu()
  state.items.find(item => item['aria-controls'] === 'details-id').onSelect({ preventDefault: () => {} })
  assert.match(menu(), /Status unavailable/)
  let prevented = false
  state.items.at(-1).onSelect({ preventDefault: () => { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(state.refetches, 1)
  assert.equal(state.accountRefetches, 1)
  state.routes = []
  assert.doesNotMatch(menu(), /AGENTS\.md/)
  assert.match(menu(), /connection is unavailable/)
  assert.equal(state.options.enabled, false)
  state.routes = [{ connectionId: 'remote-a', profile: 'default', targetProfile: 'default', mode: 'remote' },
    { connectionId: 'remote-a', profile: 'default', targetProfile: 'default', mode: 'remote' }]
  assert.match(menu(), /connection is unavailable/)
  assert.equal(state.accountOptions.enabled, false)
})

const shownFlags = () => ({
  show_openai_codex: true, show_anthropic: true, show_openrouter: true, show_other: true,
  show_cursor: false
})

const displayDefaults = () => ({
  account_refresh_mode: 'on menu open',
  context_file_paths: 'filename only',
  show_estimated_composition: true
})

function settleChat(state, lines = ['Provider: openai-codex (Pro)', 'Weekly: 80% remaining (20% used)']) {
  state.query.data = {
    model: 'example-model-200k', context_max: 200000, context_used: 50000,
    context_percent: 25, context_estimated: false, context_files: [], categories: []
  }
  state.accountQuery = { isFetching: false, isPending: false, isError: false, data: { account_lines: lines } }
}

function settingsSchema(values) {
  return Object.entries(values).map(([key, value]) => ({ key, type: 'boolean', value, default: true }))
}

function fromPlugin(value) {
  return JSON.parse(JSON.stringify(value))
}

test('shows built-in provider windows when their switches are true', async () => {
  const { state, menu, registrations } = await loadPlugin()
  for (const provider of ['openai-codex', 'anthropic', 'openrouter']) {
    settleChat(state, [`Provider: ${provider}`, 'Weekly: 80% remaining (20% used)'])
    state.settingsQuery.data = shownFlags()
    const html = menu()
    assert.match(html, new RegExp(provider))
    assert.match(html, /Weekly/)
    assert.match(html, /25% used/)
    assert.equal(state.accountOptions.enabled, true)
  }
  assert.match(renderToStaticMarkup(registrations[0].data.label), /25%/)
  state.requests = []
  await state.accountOptions.queryFn()
  const usage = state.requests.filter(args => args[1] === 'session.usage')
  assert.equal(usage.length, 1)
  assert.equal(usage[0][0].connectionId, 'remote-a')
  assert.equal(usage[0][0].profile, 'default')
  assert.equal(usage[0][2].session_id, 'runtime-1')
})

test('hides only the provider whose switch is off', async () => {
  const { state, menu } = await loadPlugin()
  settleChat(state)
  state.settingsQuery.data = { ...shownFlags(), show_openai_codex: false }
  assert.doesNotMatch(menu(), /Account limits/)
  assert.equal(state.accountOptions.enabled, true)
  state.requests = []
  await state.accountOptions.queryFn()
  assert.equal(state.requests.filter(args => args[1] === 'session.usage').length, 1)

  settleChat(state, ['Provider: anthropic', 'Weekly: 70% remaining (30% used)'])
  let html = menu()
  assert.match(html, /anthropic/)
  assert.match(html, /Weekly/)
  assert.match(html, /25% used/)
  state.settingsQuery.data = { ...shownFlags(), show_anthropic: false }
  assert.doesNotMatch(menu(), /Account limits|anthropic/)
  settleChat(state, ['Provider: openai-codex', 'Weekly: 80% remaining (20% used)'])
  html = menu()
  assert.match(html, /openai-codex/)
  assert.match(html, /Weekly/)

  settleChat(state, ['Provider: openrouter', 'Weekly: 40% remaining (60% used)'])
  state.settingsQuery.data = shownFlags()
  assert.match(menu(), /openrouter/)
  state.settingsQuery.data = { ...shownFlags(), show_openrouter: false }
  assert.doesNotMatch(menu(), /Account limits|openrouter/)
  settleChat(state, ['Provider: anthropic (Team)', 'Weekly: 70% remaining (30% used)'])
  html = menu()
  assert.match(html, /anthropic/)
  assert.match(html, /Weekly/)
  assert.doesNotMatch(html, /5h session|Hourly|\d+ tokens remaining/)
})

test('keeps substring provider ids on the other switch', async () => {
  const { state, menu } = await loadPlugin()
  state.settingsQuery.data = { ...shownFlags(), show_other: false, show_openai_codex: true }
  for (const id of ['nous', 'custom-hook', 'openai-codex-extra', 'my-anthropic', 'custom-openrouter']) {
    settleChat(state, [`Provider: ${id} (Plan)`, 'Weekly: 80% remaining (20% used)'])
    const html = menu()
    assert.match(html, /example-model-200k/)
    assert.match(html, /25% used/)
    assert.doesNotMatch(html, /Account limits/)
    assert.doesNotMatch(html, /Weekly/)
  }
  settleChat(state, ['Provider: openai-codex (Pro)', 'Weekly: 80% remaining (20% used)'])
  const shown = menu()
  assert.match(shown, /openai-codex \(Pro\)/)
  assert.match(shown, /Weekly/)
  assert.doesNotMatch(shown, /5h session|Hourly|\d+ tokens remaining/)
})

test('keeps the account status when usage returns no provider id', async () => {
  const { state, menu } = await loadPlugin()
  state.settingsQuery.data = { ...shownFlags(), show_other: false }
  const payloads = [
    [{}, /Account limits unavailable/],
    [{ account_lines: [] }, /No account-limit windows reported/],
    [{ account_lines: ['Unavailable: provider timeout'] }, /Account limits unavailable/],
    [{ account_lines: ['Account usage unavailable'] }, /No account-limit windows reported/]
  ]
  for (const [data, status] of payloads) {
    settleChat(state)
    state.accountQuery.data = data
    const html = menu()
    assert.match(html, /example-model-200k/)
    assert.match(html, /25% used/)
    assert.match(html, /Account limits/)
    assert.match(html, status)
    assert.equal(state.accountOptions.enabled, true)
  }
  state.requests = []
  await state.accountOptions.queryFn()
  assert.equal(state.requests.filter(args => args[1] === 'session.usage').length, 1)
})

test('does not request usage when every provider switch is off', async () => {
  const { state, menu } = await loadPlugin()
  settleChat(state)
  state.settingsQuery.data = {
    show_openai_codex: false, show_anthropic: false, show_openrouter: false, show_other: false
  }
  const html = menu()
  assert.match(html, /25% used/)
  assert.match(html, /example-model-200k/)
  assert.doesNotMatch(html, /Account limits|openai-codex|Weekly/)
  assert.equal(state.accountOptions.enabled, false)
  state.items.at(-1).onSelect({ preventDefault: () => {} })
  assert.equal(state.refetches, 1)
  assert.equal(state.accountRefetches, 0)
})

test('waits for provider settings before requesting usage', async () => {
  const { state, menu } = await loadPlugin()
  settleChat(state)
  state.settingsQuery = { isFetching: true, isPending: true, isError: false, error: null, data: undefined }
  assert.doesNotMatch(menu(), /Account limits/)
  assert.equal(state.accountOptions.enabled, false)
  state.settingsQuery = { isFetching: false, isPending: false, isError: false, error: null, data: shownFlags() }
  const html = menu()
  assert.equal(state.accountOptions.enabled, true)
  assert.match(html, /Account limits/)
  assert.match(html, /Weekly/)
  state.requests = []
  await state.accountOptions.queryFn()
  assert.equal(state.requests.filter(args => args[1] === 'session.usage').length, 1)
})

test('keeps usage when plugins.manage is unknown', async () => {
  const { state, menu } = await loadPlugin()
  settleChat(state)
  menu()
  state.settingsError = Object.assign(new Error('Method not found'), { code: -32601 })
  await assert.rejects(() => state.settingsOptions.queryFn(), error => error.code === -32601)
  state.settingsQuery = {
    isFetching: false, isPending: false, isError: true, error: { code: -32601 }, data: undefined
  }
  const html = menu()
  assert.match(html, /Weekly/)
  assert.match(html, /openai-codex/)
  assert.match(html, /25% used/)
  assert.equal(state.accountOptions.enabled, true)
})

test('treats a missing package schema as all providers visible', async () => {
  const { state, menu } = await loadPlugin()
  settleChat(state, ['Provider: nous', 'Weekly: 55% remaining (45% used)'])
  menu()
  state.pluginsPayload = { plugins: [{ key: 'other-plugin', name: 'other-plugin', settings_schema: [{ key: 'note', type: 'string', value: 'leave-me' }] }] }
  assert.deepEqual(fromPlugin(await state.settingsOptions.queryFn()), { ...shownFlags(), ...displayDefaults() })
  state.pluginsPayload = { plugins: [{ key: 'context-window-visualizer', name: 'context-window-visualizer' }] }
  assert.deepEqual(fromPlugin(await state.settingsOptions.queryFn()), { ...shownFlags(), ...displayDefaults() })
  state.pluginsPayload = { plugins: [{ name: 'context-window-visualizer', settings_schema: [] }] }
  assert.deepEqual(fromPlugin(await state.settingsOptions.queryFn()), { ...shownFlags(), ...displayDefaults() })
  state.settingsQuery.data = shownFlags()
  const html = menu()
  assert.match(html, /nous/)
  assert.match(html, /Weekly/)
  assert.match(html, /25% used/)
  assert.equal(state.accountOptions.enabled, true)
  state.pluginsPayload = {
    plugins: [
      { key: 'other-plugin', settings_schema: [{ key: 'note', type: 'string', value: 'leave-me' }] },
      {
        name: 'context-window-visualizer',
        settings_schema: [
          { key: 'show_openai_codex', type: 'boolean', value: false, default: true },
          { key: 'show_anthropic', type: 'boolean', default: false }
        ]
      }
    ]
  }
  assert.deepEqual(fromPlugin(await state.settingsOptions.queryFn()), {
    show_openai_codex: false, show_anthropic: false, show_openrouter: true, show_other: true,
    show_cursor: false, ...displayDefaults()
  })
})

test('fails closed on malformed, timed-out, or foreign provider settings', async () => {
  const { state, menu, registrations } = await loadPlugin()
  settleChat(state)
  menu()
  state.pluginsPayload = null
  await assert.rejects(() => state.settingsOptions.queryFn(), /malformed settings/)
  state.pluginsPayload = { plugins: 'nope' }
  await assert.rejects(() => state.settingsOptions.queryFn(), /malformed settings/)
  state.pluginsPayload = {
    plugins: [{
      key: 'context-window-visualizer',
      settings_schema: settingsSchema({ ...shownFlags(), show_openrouter: 'off' })
    }]
  }
  await assert.rejects(() => state.settingsOptions.queryFn(), /non-boolean/)
  state.pluginsPayload = {
    profile: 'work',
    plugins: [{ key: 'context-window-visualizer', settings_schema: settingsSchema(shownFlags()) }]
  }
  await assert.rejects(() => state.settingsOptions.queryFn(), /profile mismatch/)
  state.pluginsPayload = {
    connectionId: 'remote-b',
    plugins: [{ key: 'context-window-visualizer', settings_schema: settingsSchema(shownFlags()) }]
  }
  await assert.rejects(() => state.settingsOptions.queryFn(), /connection mismatch/)

  state.settingsQuery = {
    isFetching: false, isPending: false, isError: true, error: new Error('timeout'), data: shownFlags()
  }
  let html = menu()
  assert.equal(state.accountOptions.enabled, false)
  assert.doesNotMatch(html, /Account limits/)
  assert.match(html, /25% used/)
  assert.match(renderToStaticMarkup(registrations[0].data.label), /25%/)
  state.items.at(-1).onSelect({ preventDefault: () => {} })
  assert.equal(state.accountRefetches, 0)

  state.settingsQuery = {
    isFetching: false, isPending: false, isError: false, error: null,
    data: { show_openai_codex: 'no', show_anthropic: true, show_openrouter: true, show_other: true }
  }
  html = menu()
  assert.equal(state.accountOptions.enabled, false)
  assert.doesNotMatch(html, /Account limits/)
  assert.match(html, /example-model-200k/)
  state.items.at(-1).onSelect({ preventDefault: () => {} })
  assert.equal(state.accountRefetches, 0)
})

test('reads provider settings only for the focused route', async () => {
  const { state, menu } = await loadPlugin()
  settleChat(state)
  menu()
  assert.deepEqual(Array.from(state.settingsOptions.queryKey), [
    'context-window-visualizer', 'provider-settings', 'remote-a', 'default'
  ])
  assert.equal(state.settingsOptions.enabled, true)
  state.pluginsPayload = {
    plugins: [{ key: 'context-window-visualizer', settings_schema: settingsSchema(shownFlags()) }]
  }
  state.requests = []
  await state.settingsOptions.queryFn()
  assert.equal(state.requests.length, 1)
  assert.equal(state.request[0].connectionId, 'remote-a')
  assert.equal(state.request[0].profile, 'default')
  assert.equal(state.request[1], 'plugins.manage')
  assert.equal(state.request[2].action, 'list')
  assert.equal(state.request[2].profile, 'default')
  assert.equal(state.request[3], 12_000)

  state.owner = { connectionId: 'remote-b', profile: 'work' }
  state.routes = [{ connectionId: 'remote-b', profile: 'work', targetProfile: 'work', mode: 'remote' }]
  state.settingsQuery = { isFetching: true, isPending: false, isError: false, error: null, data: shownFlags() }
  menu()
  assert.deepEqual(Array.from(state.settingsOptions.queryKey), [
    'context-window-visualizer', 'provider-settings', 'remote-b', 'work'
  ])
  assert.equal(state.accountOptions.enabled, false)
  state.settingsQuery = { isFetching: false, isPending: false, isError: false, error: null, data: shownFlags() }
  menu()
  state.requests = []
  await state.settingsOptions.queryFn()
  assert.equal(state.request[0].connectionId, 'remote-b')
  assert.equal(state.request[2].action, 'list')
  assert.equal(state.request[2].profile, 'work')

  state.requests = []
  state.routes = []
  menu()
  assert.equal(state.settingsOptions.enabled, false)
  assert.equal(state.accountOptions.enabled, false)
  state.owner = null
  menu()
  assert.equal(state.settingsOptions.enabled, false)
  assert.equal(state.accountOptions.enabled, false)
  state.owner = { connectionId: 'remote-b', profile: 'work' }
  state.routes = [
    { connectionId: 'remote-b', profile: 'work', targetProfile: 'work', mode: 'remote' },
    { connectionId: 'remote-b', profile: 'work', targetProfile: 'work', mode: 'remote' }
  ]
  menu()
  assert.equal(state.settingsOptions.enabled, false)
  assert.equal(state.accountOptions.enabled, false)
  assert.equal(state.requests.length, 0)
})

test('footer occupancy does not read provider settings', async () => {
  const { state, registrations } = await loadPlugin()
  settleChat(state)
  const html = renderToStaticMarkup(registrations[0].data.label)
  assert.match(html, /25%/)
  assert.equal(state.settingsOptions, undefined)
  assert.equal(state.requests.length, 0)
})

function menuText(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(menuText).join('')
  return menuText(node.props?.children)
}

test('offers plugin settings from the context menu with no session', async () => {
  const { state, menu } = await loadPlugin()
  state.sessionId = null
  state.owner = null
  state.busy = true
  state.requests = []
  const html = menu()
  assert.match(html, /Open a chat to inspect its context files/)
  const header = html.match(/<div data-slot="context-menu-header"[^>]*>(.*?)<\/div>/s)?.[1]
  assert.ok(header, 'settings shortcut belongs in the popup header')
  assert.match(html, /data-slot="context-menu-header" class="flex items-center justify-between/)
  assert.match(header, /Context window/)
  assert.match(header, /<button[^>]*aria-label="Plugin settings"[^>]*><i[^>]*codicon-settings-gear[^>]*><\/i><\/button>/)
  assert.doesNotMatch(html, />Plugin settings<\/button>/)
  assert.equal((html.match(/codicon-settings-gear/g) || []).length, 1)
  assert.match(html, /codicon-settings-gear/)
  assert.match(html, /aria-hidden="true"/)
  assert.equal(state.codicons.some(icon => icon.name === 'settings-gear'), true)
  const settingsItem = state.items.find(item => item['aria-label'] === 'Plugin settings')
  assert.ok(settingsItem)
  assert.notEqual(settingsItem.disabled, true)
  const refresh = state.items.find(item => menuText(item.children) === 'Refresh')
  assert.ok(refresh)
  assert.equal(refresh.disabled, true)
  let prevented = false
  settingsItem.onSelect({ preventDefault: () => { prevented = true } })
  assert.equal(prevented, false)
  assert.deepEqual(state.navigations, [
    '/capabilities?tab=plugins&plugin=' + encodeURIComponent('context-window-visualizer')
  ])
  assert.equal(state.requests.length, 0)
  assert.equal(state.refetches, 0)
  assert.equal(state.accountRefetches, 0)
  assert.equal(state.settingsRefetches, 0)
  let refreshPrevented = false
  refresh.onSelect({ preventDefault: () => { refreshPrevented = true } })
  assert.equal(refreshPrevented, true)
  assert.equal(state.refetches, 1)
  assert.deepEqual(state.navigations, [
    '/capabilities?tab=plugins&plugin=' + encodeURIComponent('context-window-visualizer')
  ])
  assert.equal(state.translations.en.pluginSettings, 'Plugin settings')
  assert.equal(state.translations.de.pluginSettings, 'Plugin-Einstellungen')
  for (const locale of ['es', 'fr', 'ja', 'ru', 'ar', 'zh', 'zh-hant']) {
    assert.equal(state.translations[locale].pluginSettings, undefined)
  }
})

test('drops cached account lines when the menu query is unused', async () => {
  const { state, menu, registrations } = await loadPlugin()
  settleChat(state)
  const meter = renderToStaticMarkup(registrations[0].data.label)
  assert.match(meter, /25%/)
  assert.equal(state.accountOptions, undefined)

  menu()
  assert.equal(state.accountOptions.gcTime, 0)
  assert.equal(state.accountOptions.staleTime, 0)
  assert.equal(state.accountOptions.refetchOnMount, 'always')
  assert.equal(state.accountOptions.refetchOnWindowFocus, false)
  assert.equal(state.accountOptions.retry, false)
  assert.equal(state.accountOptions.refetchInterval, undefined)
  assert.deepEqual(Array.from(state.accountOptions.queryKey), [
    'context-window-visualizer', 'account-limits', 'remote-a', 'default', 'runtime-1', 'example-model-200k', 'on menu open'
  ])
})

const cursorOnly = () => ({
  show_openai_codex: false, show_anthropic: false, show_openrouter: false,
  show_other: false, show_cursor: true
})

test('Cursor cache is opt-in, never queried from the footer or a missing schema', async () => {
  const { state, menu, registrations } = await loadPlugin()
  renderToStaticMarkup(registrations[0].data.label)
  assert.equal(state.cursorOptions, undefined)
  menu()
  assert.equal(state.cursorOptions.enabled, false)
  assert.equal(state.requests.filter(args => args[1] === 'cli.exec').length, 0)
  state.pluginsPayload = { plugins: [{ key: 'context-window-visualizer', settings_schema: settingsSchema(shownFlags()) }] }
  assert.equal((await state.settingsOptions.queryFn()).show_cursor, false)
  state.settingsQuery = { isPending: false, isFetching: false, isError: true, error: { code: -32601 } }
  menu()
  assert.equal(state.cursorOptions.enabled, false)
  const manifest = await readFile(new URL('../plugin.yaml', import.meta.url), 'utf8')
  assert.match(manifest, /show_cursor:\s*\n\s*type: bool\s*\n\s*default: false/)
})

test('Cursor alone reads only the focused profile Quota cache, never session.usage', async () => {
  const { state, menu } = await loadPlugin()
  state.settingsQuery.data = cursorOnly()
  menu()
  assert.equal(state.accountOptions.enabled, false)
  assert.equal(state.cursorOptions.enabled, true)
  assert.deepEqual(Array.from(state.cursorOptions.queryKey), [
    'context-window-visualizer', 'cursor-limits', 'remote-a', 'default'
  ])
  assert.equal(state.cursorOptions.gcTime, 0)
  assert.equal(state.cursorOptions.refetchInterval, undefined)
  state.quotaResponse = { blocked: false, code: 0, output: JSON.stringify({
    age_s: 30,
    providers: {
      anthropic: { details: ['SECRET_OTHER_PROVIDER'] },
      cursor: { plan: 'SECRET_PLAN', details: ['SECRET_DETAILS'], windows: [
        { label: 'Included', used_percent: 30, reset_at: '2030-01-01T12:00:00Z' },
        { label: 'API', used_percent: 100, reset_at: null }
      ] }
    }
  }) }
  const sanitized = fromPlugin(await state.cursorOptions.queryFn())
  assert.deepEqual(sanitized, { status: 'ready', windows: [
    { label: 'Included', remaining: 70, resetAt: '2030-01-01T12:00:00.000Z' },
    { label: 'API', remaining: 0, resetAt: null }
  ] })
  assert.deepEqual(state.requests.map(args => args[1]), ['cli.exec'])
  assert.equal(state.request[0].connectionId, 'remote-a')
  assert.deepEqual(fromPlugin(state.request[2]), {
    argv: ['--profile', 'default', 'quota', 'status', '--json', '--cached'], timeout: 10
  })
  state.cursorQuery.data = sanitized
  const html = menu()
  assert.match(html, /Cursor limits/)
  assert.match(html, /Included/)
  assert.match(html, /70% remaining/)
  assert.doesNotMatch(html, /SECRET_|Account limits/)
  state.items.at(-1).onSelect({ preventDefault: () => {} })
  assert.equal(state.cursorRefetches, 1)
})

test('Cursor cache is rejected when stale, malformed, or blocked; no fabricated bar', async () => {
  const { state, menu } = await loadPlugin()
  state.settingsQuery.data = cursorOnly()
  menu()
  for (const age_s of [1801, -1, '5', null, Infinity]) {
    state.quotaResponse = { blocked: false, code: 0,
      output: JSON.stringify({ age_s, providers: { cursor: { windows: [{ label: 'Included', used_percent: 20 }] } } }) }
    const result = await state.cursorOptions.queryFn()
    assert.equal(result.status, 'stale')
    assert.equal(result.windows.length, 0)
  }
  state.quotaResponse = { blocked: false, code: 0, output: JSON.stringify({ age_s: 0,
    providers: { cursor: { windows: [
      { label: 'Invalid', used_percent: 101 }, { label: 'Negative', used_percent: -1 },
      { label: 'Text', used_percent: '15' }, { label: 'NaN', used_percent: null }
    ] } } }) }
  assert.deepEqual(fromPlugin(await state.cursorOptions.queryFn()), { status: 'empty', windows: [] })
  for (const response of [{ blocked: true, code: -1, output: 'SECRET' },
    { blocked: false, code: 1, output: 'SECRET' },
    { blocked: false, code: 0, output: 'not JSON SECRET' }]) {
    state.quotaResponse = response
    await assert.rejects(() => state.cursorOptions.queryFn(), error => !String(error).includes('SECRET'))
  }
  state.cursorQuery = { isFetching: false, isPending: false, isError: true }
  assert.match(menu(), /Cursor limits unavailable/)
  assert.doesNotMatch(menu(), /SECRET/)
})

test('Cursor cache is routed only to a unique owner and is independent of the chat provider', async () => {
  const { state, menu } = await loadPlugin()
  state.settingsQuery.data = { ...shownFlags(), show_cursor: true }
  state.accountQuery.data = { account_lines: ['Provider: openai-codex', 'Weekly: 80% remaining (20% used)'] }
  state.cursorQuery.data = { status: 'ready', windows: [{ label: 'Included', remaining: 50, resetAt: null }] }
  let html = menu()
  assert.match(html, /Account limits/)
  assert.match(html, /Cursor limits/)
  assert.match(html, /50% remaining/)
  state.owner = { connectionId: 'remote-b', profile: 'work' }
  state.routes = [{ connectionId: 'remote-b', profile: 'work', targetProfile: 'work', mode: 'remote' }]
  menu()
  assert.deepEqual(Array.from(state.cursorOptions.queryKey), [
    'context-window-visualizer', 'cursor-limits', 'remote-b', 'work'
  ])
  state.quotaResponse = { blocked: false, code: 0,
    output: JSON.stringify({ age_s: 10, providers: { cursor: { windows: [] } } }) }
  await state.cursorOptions.queryFn()
  assert.deepEqual(fromPlugin(state.request[2]), {
    argv: ['--profile', 'work', 'quota', 'status', '--json', '--cached'], timeout: 10
  })
  state.routes = []
  menu()
  assert.equal(state.cursorOptions.enabled, false)
  state.routes = [{ connectionId: 'remote-b', profile: 'work', targetProfile: 'work' },
    { connectionId: 'remote-b', profile: 'work', targetProfile: 'work' }]
  menu()
  assert.equal(state.cursorOptions.enabled, false)
  state.routes = [{ connectionId: 'remote-b', profile: 'work', targetProfile: '' }]
  menu()
  assert.equal(state.cursorOptions.enabled, false)
  state.routes = [{ connectionId: 'remote-b', profile: 'work', targetProfile: 'work' }]
  state.sessionId = null
  menu()
  assert.equal(state.cursorOptions.enabled, false)
  state.sessionId = 'runtime-2'
  state.owner = null
  menu()
  assert.equal(state.cursorOptions.enabled, false)
  state.settingsQuery = { isPending: false, isFetching: false, isError: true, error: new Error('timeout') }
  menu()
  assert.equal(state.cursorOptions.enabled, false)
})

test('Cursor renders only bounded windows, never cache metadata or malformed reset strings', async () => {
  const { state, menu } = await loadPlugin()
  state.settingsQuery.data = cursorOnly()
  menu()
  state.quotaResponse = { blocked: false, code: 0, output: JSON.stringify({ age_s: 1800,
    providers: { cursor: {
      unavailable_reason: null, plan: 'SECRET_ACCOUNT', details: ['SECRET_BILLING'],
      windows: [
        { label: '<img src=x onerror=alert(1)>', used_percent: 25 },
        { label: 'On-demand', used_percent: 12.5, reset_at: 'javascript:SECRET_RESET' },
        { label: 'Included', used_percent: 25, reset_at: '2030-03-04T12:00:00Z' }
      ]
    } }
  }) }
  const result = fromPlugin(await state.cursorOptions.queryFn())
  assert.deepEqual(result, { status: 'ready', windows: [
    { label: 'On-demand', remaining: 88, resetAt: null },
    { label: 'Included', remaining: 75, resetAt: '2030-03-04T12:00:00.000Z' }
  ] })
  state.cursorQuery.data = result
  let html = menu()
  assert.match(html, /Cursor limits \(Quota cache\)/)
  assert.match(html, /75% remaining/)
  assert.match(html, /Resets 2030-03-04T12:00:00\.000Z/)
  assert.doesNotMatch(html, /SECRET_|onerror|javascript:/)
  state.cursorQuery.data = { status: 'stale', windows: [] }
  html = menu()
  assert.match(html, /Cursor cache is stale/)
  assert.doesNotMatch(html, /75% remaining/)
  state.cursorQuery.data = { status: 'unavailable', windows: [] }
  assert.match(menu(), /Cursor limits unavailable/)
  state.cursorQuery.data = { status: 'empty', windows: [] }
  assert.match(menu(), /No Cursor allowance windows/)
  state.settingsQuery.data = { ...cursorOnly(), show_cursor: 'true' }
  menu()
  assert.equal(state.cursorOptions.enabled, false)
})

function expandFiles(state) {
  const opener = state.items.find(item => item['aria-controls'] === 'details-id')
  assert.ok(opener)
  opener.onSelect({ preventDefault() {} })
}

const privateFiles = [
  { label: 'AGENTS.md', path: '/example/work/private/AGENTS.md', est_tokens: 1200, status: 'loaded', loaded: true },
  { label: 'CLAUDE.md', path: 'C:\\example\\private\\CLAUDE.md', est_tokens: 800, status: 'shadowed', loaded: false }
]

test('shows the exact context-file path when full path is selected', async () => {
  const { state, menu } = await loadPlugin()
  state.settingsQuery.data = { ...shownFlags(), context_file_paths: 'full path' }
  state.query.data = {
    model: 'example-model-200k', context_max: 200000, context_used: 50000,
    context_percent: 25, context_estimated: false, categories: [], context_files: privateFiles
  }
  menu()
  expandFiles(state)
  const html = menu()
  assert.match(html, /title="\/example\/work\/private\/AGENTS\.md"/)
  assert.match(html, />\/example\/work\/private\/AGENTS\.md</)
  assert.match(html, /title="C:\\example\\private\\CLAUDE\.md"/)
  assert.match(html, />C:\\example\\private\\CLAUDE\.md</)
  assert.match(html, />Loaded</)
  assert.match(html, /~1\.2K full file/i)
  assert.match(html, /Not loaded — a higher-priority context file won/)
})

test('keeps context-file paths private until a settled full-path choice', async () => {
  const { state, menu } = await loadPlugin()
  state.query.data.context_files = [
    { label: '/example/work/private/notes.md/', path: '/example/work/private/AGENTS.md/', est_tokens: 10, status: 'loaded', loaded: true },
    { label: 'C:\\example\\private\\CLAUDE.md\\', path: 'C:\\example\\private\\CLAUDE.md\\', est_tokens: 10, status: 'shadowed', loaded: false }
  ]
  state.settingsQuery = {
    isFetching: true, isPending: true, isError: false, error: null,
    data: { ...shownFlags(), context_file_paths: 'full path' }
  }
  menu()
  expandFiles(state)
  let html = menu()
  assert.match(html, />notes\.md</)
  assert.match(html, />CLAUDE\.md</)
  assert.doesNotMatch(html, /example\/work\/private/)
  assert.doesNotMatch(html, /example\\private/)
  assert.equal(state.accountOptions.enabled, false)

  state.settingsQuery = {
    isFetching: false, isPending: false, isError: true, error: new Error('timeout'),
    data: { ...shownFlags(), context_file_paths: 'full path' }
  }
  html = menu()
  assert.doesNotMatch(html, /example\/work\/private/)
  assert.doesNotMatch(html, /example\\private/)
  assert.equal(state.accountOptions.enabled, false)

  state.settingsQuery = {
    isFetching: false, isPending: false, isError: false, error: null,
    data: { ...shownFlags(), context_file_paths: 'sideways' }
  }
  html = menu()
  assert.doesNotMatch(html, /<p[^>]*title=/)
  assert.doesNotMatch(html, /example\/work\/private/)
  assert.equal(state.accountOptions.enabled, false)
})

test('reads account limits on menu open and again on focus only in that mode', async () => {
  const { state, menu } = await loadPlugin()
  settleChat(state)
  menu()
  assert.equal(state.accountOptions.enabled, true)
  assert.equal(state.accountOptions.refetchOnMount, 'always')
  assert.equal(state.accountOptions.refetchOnWindowFocus, false)
  assert.equal(state.accountOptions.refetchInterval, undefined)
  assert.equal(state.cursorOptions.refetchOnWindowFocus, false)

  state.settingsQuery.data = { ...shownFlags(), account_refresh_mode: 'on menu open and focus' }
  menu()
  assert.equal(state.accountOptions.enabled, true)
  assert.equal(state.accountOptions.refetchOnWindowFocus, true)
  assert.equal(state.cursorOptions.refetchOnWindowFocus, false)
  assert.match(menu(), /Weekly/)
})

test('drops a fetched account snapshot when refresh mode switches to manual', async () => {
  const { state, menu } = await loadPlugin()
  settleChat(state)
  state.accountQuery = {
    isFetching: false, isPending: false, isError: false, isFetched: true,
    data: { account_lines: ['Provider: openai-codex (Pro)', 'Weekly: 80% remaining (20% used)'] }
  }
  state.settingsQuery.data = { ...shownFlags(), account_refresh_mode: 'on menu open' }
  assert.match(menu(), /Weekly/)
  const autoKey = Array.from(state.accountOptions.queryKey)
  state.accountCacheKey = autoKey.join('\0')
  assert.equal(state.accountOptions.enabled, true)

  state.settingsQuery.data = { ...shownFlags(), account_refresh_mode: 'manual' }
  const html = menu()
  const manualKey = Array.from(state.accountOptions.queryKey)
  assert.notDeepEqual(manualKey, autoKey)
  assert.equal(manualKey.at(-1), 'manual')
  assert.equal(autoKey.at(-1), 'on menu open')
  assert.equal(state.accountOptions.enabled, false)
  assert.equal(state.accountOptions.refetchOnWindowFocus, false)
  assert.match(html, /Select Refresh to load account limits/)
  assert.doesNotMatch(html, /Weekly/)
  assert.doesNotMatch(html, /openai-codex/)
  assert.equal(state.accountRefetches, 0)

  state.owner = { connectionId: 'remote-b', profile: 'work' }
  state.routes = [{ connectionId: 'remote-b', profile: 'work', targetProfile: 'work', mode: 'remote' }]
  state.settingsQuery.data = { ...shownFlags(), account_refresh_mode: 'on menu open' }
  const isolated = menu()
  const otherKey = Array.from(state.accountOptions.queryKey)
  assert.equal(otherKey[2], 'remote-b')
  assert.equal(otherKey[3], 'work')
  assert.equal(otherKey.at(-1), 'on menu open')
  assert.notDeepEqual(otherKey, manualKey)
  assert.notDeepEqual(otherKey, autoKey)
  assert.doesNotMatch(isolated, /Weekly/)
  assert.doesNotMatch(isolated, /openai-codex/)
})

test('asks for Refresh before reading account limits in manual mode', async () => {
  const { state, menu } = await loadPlugin()
  settleChat(state)
  state.settingsQuery.data = { ...shownFlags(), account_refresh_mode: 'manual' }
  let html = menu()
  assert.equal(state.accountOptions.enabled, false)
  assert.equal(state.accountOptions.refetchOnWindowFocus, false)
  assert.equal(state.accountOptions.refetchInterval, undefined)
  assert.match(html, /Select Refresh to load account limits/)
  assert.doesNotMatch(html, /Loading account limits/)
  assert.doesNotMatch(html, /Weekly/)
  assert.doesNotMatch(html, /0% remaining/)
  assert.match(html, /25% used/)
  const refresh = state.items.find(item => menuText(item.children) === 'Refresh')
  refresh.onSelect({ preventDefault() {} })
  assert.equal(state.accountRefetches, 1)
  assert.equal(state.refetches, 1)
  state.accountQuery = {
    isFetching: false, isPending: false, isError: false, isFetched: true,
    data: { account_lines: ['Provider: openai-codex (Pro)', 'Weekly: 80% remaining (20% used)'] }
  }
  html = menu()
  assert.match(html, /Weekly/)
  assert.doesNotMatch(html, /Select Refresh to load account limits/)

  state.accountRefetches = 0
  state.settingsQuery.data = {
    show_openai_codex: false, show_anthropic: false, show_openrouter: false, show_other: false,
    account_refresh_mode: 'manual'
  }
  menu()
  state.items.find(item => menuText(item.children) === 'Refresh').onSelect({ preventDefault() {} })
  assert.equal(state.accountRefetches, 0)
  assert.equal(state.accountOptions.enabled, false)
  assert.equal(state.cursorOptions.enabled, false)
})

test('drops account rows when the focused owner changes', async () => {
  const { state, menu } = await loadPlugin()
  settleChat(state)
  assert.match(menu(), /Weekly/)
  assert.match(menu(), /openai-codex/)
  state.owner = { connectionId: 'remote-b', profile: 'work' }
  state.routes = [{ connectionId: 'remote-b', profile: 'work', targetProfile: 'work', mode: 'remote' }]
  state.accountQuery = {
    isFetching: false, isPending: true, isError: false,
    data: { account_lines: ['Provider: openai-codex (Pro)', 'Weekly: 80% remaining (20% used)'] }
  }
  const html = menu()
  assert.deepEqual(Array.from(state.accountOptions.queryKey), [
    'context-window-visualizer', 'account-limits', 'remote-b', 'work', 'runtime-1', 'example-model-200k', 'on menu open'
  ])
  assert.doesNotMatch(html, /Weekly/)
  assert.doesNotMatch(html, /openai-codex/)
  assert.match(html, /25% used/)
  assert.equal(state.cursorOptions.queryKey[2], 'remote-b')
  assert.equal(state.settingsOptions.queryKey[3], 'work')
})

test('hides estimated composition without hiding occupancy or files', async () => {
  const { state, menu, registrations } = await loadPlugin()
  state.settingsQuery.data = { ...shownFlags(), show_estimated_composition: false }
  state.query.data = {
    model: 'example-model-200k', context_max: 200000, context_used: 50000,
    context_percent: 25, context_estimated: false,
    categories: [{ id: 'conversation', label: 'Conversation', tokens: 30000 }],
    context_files: privateFiles
  }
  menu()
  expandFiles(state)
  const html = menu()
  assert.match(html, /example-model-200k/)
  assert.match(html, /25% used/)
  assert.match(html, /role="progressbar"/)
  assert.doesNotMatch(html, /Estimated composition/)
  assert.doesNotMatch(html, /Category sizes are rough/)
  assert.doesNotMatch(html, /Conversation/)
  assert.match(html, /AGENTS\.md/)
  assert.match(html, /Loaded/)
  assert.match(html, /Account limits/)
  const footer = renderToStaticMarkup(registrations[0].data.label)
  assert.match(footer, /25%/)
  assert.doesNotMatch(footer, /Estimated composition/)

  state.settingsQuery.data = { ...shownFlags(), show_estimated_composition: true }
  assert.match(menu(), /Estimated composition/)
  assert.match(menu(), /Conversation/)
})

test('uses display defaults for an old schema and rejects invalid enums', async () => {
  const { state, menu } = await loadPlugin()
  settleChat(state)
  state.query.data.context_files = privateFiles
  menu()
  state.pluginsPayload = {
    plugins: [{
      key: 'context-window-visualizer',
      settings_schema: [
        ...settingsSchema(shownFlags()),
        { key: 'account_refresh_mode', type: 'enum', value: 'manual', default: 'on menu open', choices: ['manual', 'on menu open', 'on menu open and focus'] },
        { key: 'context_file_paths', type: 'enum', value: 'full path', default: 'filename only', choices: ['hidden', 'filename only', 'full path'] },
        { key: 'show_estimated_composition', type: 'boolean', value: false, default: true }
      ]
    }]
  }
  assert.deepEqual(fromPlugin(await state.settingsOptions.queryFn()), {
    ...shownFlags(),
    account_refresh_mode: 'manual',
    context_file_paths: 'full path',
    show_estimated_composition: false
  })
  state.pluginsPayload = {
    profile: 'work',
    plugins: [{
      key: 'context-window-visualizer',
      settings_schema: [
        ...settingsSchema(shownFlags()),
        { key: 'context_file_paths', type: 'enum', value: 'full path', default: 'filename only' }
      ]
    }]
  }
  await assert.rejects(() => state.settingsOptions.queryFn(), /profile mismatch/)
  state.pluginsPayload = {
    plugins: [{
      key: 'context-window-visualizer',
      settings_schema: [
        ...settingsSchema(shownFlags()),
        { key: 'account_refresh_mode', type: 'enum', value: 'always', default: 'on menu open' },
        { key: 'context_file_paths', type: 'enum', value: 'full path', default: 'filename only' }
      ]
    }]
  }
  await assert.rejects(() => state.settingsOptions.queryFn(), /invalid account_refresh_mode/)
  state.pluginsPayload = {
    plugins: [{
      key: 'context-window-visualizer',
      settings_schema: [
        ...settingsSchema(shownFlags()),
        { key: 'context_file_paths', type: 'enum', value: '/tmp/private', default: 'filename only' }
      ]
    }]
  }
  await assert.rejects(() => state.settingsOptions.queryFn(), /invalid context_file_paths/)
  state.pluginsPayload = {
    plugins: [{
      key: 'context-window-visualizer',
      settings_schema: [
        ...settingsSchema(shownFlags()),
        { key: 'show_estimated_composition', type: 'boolean', value: 'yes', default: true }
      ]
    }]
  }
  await assert.rejects(() => state.settingsOptions.queryFn(), /non-boolean/)

  state.settingsQuery.data = {
    ...shownFlags(), account_refresh_mode: 'manual', context_file_paths: 'filename only',
    show_estimated_composition: false
  }
  state.owner = { connectionId: 'remote-b', profile: 'work' }
  state.routes = [{ connectionId: 'remote-b', profile: 'work', targetProfile: 'work', mode: 'remote' }]
  menu()
  expandFiles(state)
  const html = menu()
  assert.equal(state.settingsOptions.queryKey[2], 'remote-b')
  assert.equal(state.settingsOptions.queryKey[3], 'work')
  assert.equal(state.accountOptions.enabled, false)
  assert.doesNotMatch(html, /example\/work\/private/)
  assert.doesNotMatch(html, /Estimated composition/)
  assert.match(html, /25% used/)
  assert.match(html, /Select Refresh to load account limits/)
})

test('a disabled React Query observer fetches when Refresh calls refetch', async () => {
  const entry = [
    join(desktopRoot, 'node_modules/@tanstack/query-core/package.json'),
    join(desktopRoot, '../../node_modules/@tanstack/query-core/package.json')
  ].find(path => existsSync(path))
  assert.ok(entry, 'installed @tanstack/query-core was not found beside HERMES_DESKTOP_ROOT')
  const { QueryClient, QueryObserver } = createRequire(entry)('@tanstack/query-core')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let calls = 0
  const observer = new QueryObserver(client, {
    queryKey: ['context-window-visualizer', 'account-limits', 'manual'],
    queryFn: async () => { calls += 1; return { account_lines: ['Weekly: 80% remaining (20% used)'] } },
    enabled: false,
    retry: false
  })
  assert.equal(observer.getCurrentResult().isFetched, false)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(calls, 0)
  assert.equal(observer.getCurrentResult().fetchStatus, 'idle')
  const result = await observer.refetch()
  assert.equal(calls, 1)
  assert.equal(result.isFetched, true)
  assert.equal(result.status, 'success')
  assert.deepEqual(result.data, { account_lines: ['Weekly: 80% remaining (20% used)'] })
  client.clear()
})
