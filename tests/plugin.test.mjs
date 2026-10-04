import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
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
    routes: [{ connectionId: 'remote-a', profile: 'default', targetProfile: 'default', mode: 'remote' }],
    routesLoading: false, routesError: false, usage: null,
    expanded: false, refetches: 0, accountRefetches: 0, items: [], request: null,
    events: new Map(), resets: [],
    accountQuery: { isFetching: false, isPending: false, isError: false, data: { account_lines: [] } },
    query: { isFetching: false, isPending: false, isError: false, data: { context_max: 4000, context_files: [] } }
  }
  const atoms = {
    focusedSessionId: { get: () => state.sessionId },
    focusedSessionOwner: { get: () => state.owner },
    focusedUsage: { get: () => state.usage },
    busy: { get: () => state.busy },
    connectionId: { get: () => 'remote-a' },
    profile: { get: () => 'default' }
  }
  const sdk = {
    STATUSBAR_AREAS: { right: 'statusBar.right' },
    DropdownMenuItem: ({ children, ...props }) => {
      state.items.push({ children, ...props })
      return React.createElement('button', { type: 'button', 'aria-expanded': props['aria-expanded'] }, children)
    },
    host: {
      state: atoms,
      profileRoutes: async () => state.routes,
      requestProfile: async (...args) => { state.request = args; return state.query.data }
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
        return { ...state.accountQuery, refetch: async () => { state.accountRefetches += 1 } }
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
  assert.match(live, /~7%/)
  assert.match(live, /width:7%/)
  assert.match(live, /aria-valuetext="7% used, Estimated occupancy"/)
  assert.doesNotMatch(live, /25%/)
  state.busy = false
  state.sessionId = null
  const empty = renderToStaticMarkup(registrations[0].data.label)
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
  assert.deepEqual(Array.from(state.accountOptions.queryKey), ['context-window-visualizer', 'account-limits', 'remote-b', 'work', 'runtime-2', 'example-model-200k'])
  await state.accountOptions.queryFn()
  assert.equal(state.request[0].connectionId, 'remote-b')
  assert.equal(state.request[1], 'session.usage')
  assert.equal(state.request[2].session_id, 'runtime-2')
  assert.equal(state.request[3], 25_000)
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
  state.items[0].onSelect({ preventDefault: () => { prevented = true } })
  assert.equal(prevented, true)
  html = menu()
  assert.match(html, /~12K full file/i)
  assert.match(html, /~4K full file/i)
  assert.match(html, /Full-file estimates before truncation/)
  assert.match(html, /\/repo\/AGENTS\.md/)
  assert.match(html, /Loaded — truncated at the context-file limit/)
  assert.match(html, /Not loaded — a higher-priority context file won/)
  assert.match(html, /aria-expanded="true"/)
})

test('refuses stale data while busy, and distinguishes unavailable and error states', async () => {
  const { state, menu } = await loadPlugin()
  state.query.data.context_files = files
  state.busy = true
  assert.match(menu(), /Waiting for this turn to finish/)
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
  state.items[0].onSelect({ preventDefault: () => {} })
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
