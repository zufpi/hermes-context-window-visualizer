import * as sdk from '@hermes/plugin-sdk'

const {
  Codicon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  STATUSBAR_AREAS,
  host,
  queryClient,
  usePluginI18n,
  useQuery,
  useValue
} = sdk
import { useId, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const ID = 'context-window-visualizer'
const STATUS_KEYS = new Set(['blocked', 'empty', 'flagged', 'loaded', 'shadowed', 'suppressed', 'truncated', 'unreadable'])

const translations = {
  en: {
    title: 'Context window',
    footer: 'Context',
    calculating: 'Calculating...',
    used: percent => `${percent}% used`,
    tokens: (used, max) => `${used} / ${max} tokens`,
    estimated: 'Estimated occupancy',
    limits: 'Account limits',
    remaining: percent => `${percent}% remaining`,
    limitsEmpty: 'No account-limit windows reported for this chat.',
    limitsLoading: 'Loading account limits…',
    limitsError: 'Account limits unavailable. Try Refresh.',
    limitsManual: 'Select Refresh to load account limits',
    cursorLimits: 'Cursor limits (Quota cache)',
    cursorLoading: 'Loading cached Cursor limits…',
    cursorEmpty: 'No Cursor allowance windows in the Quota cache.',
    cursorStale: 'Cursor cache is stale. Refresh it in Quota, then try again.',
    cursorUnavailable: 'Cursor limits unavailable. Check Quota on this profile.',
    cursorReset: time => `Resets ${time}`,
    composition: 'Estimated composition',
    compositionNote: 'Category sizes are rough estimates, not measured shares of the window.',
    categories: {
      system_prompt: 'System prompt', tool_definitions: 'Tool definitions', rules: 'Rules',
      skills: 'Skills', mcp: 'MCP', subagent_definitions: 'Subagent definitions',
      memory: 'Memory', conversation: 'Conversation'
    },
    section: count => `Context files (${count})`,
    fullFile: amount => `~${amount} full file`,
    note: 'Full-file estimates before truncation, not tokens used in the context total.',
    noSession: 'Open a chat to inspect its context files.',
    noRoute: 'The focused chat’s connection is unavailable.',
    busy: 'Waiting for the response to finish before fetching the latest details…',
    loading: 'Loading context files…',
    noAgent: 'Send a message to initialize this chat, then reopen this menu.',
    empty: 'No context files were considered for this chat.',
    failed: 'Could not load the context-file breakdown. Check the connection or try again.',
    refresh: 'Refresh',
    pluginSettings: 'Plugin settings',
    status: {
      blocked: 'Not loaded — blocked by the prompt-injection scan',
      empty: 'Not loaded — empty file',
      flagged: 'Loaded — review the prompt-injection warning',
      loaded: 'Loaded',
      shadowed: 'Not loaded — a higher-priority context file won',
      suppressed: 'Not loaded — Hermes install directory',
      truncated: 'Loaded — truncated at the context-file limit',
      unreadable: 'Not loaded — file could not be read',
      unknown: 'Status unavailable'
    }
  },
  de: {
    title: 'Kontextfenster',
    footer: 'Kontext',
    calculating: 'Berechne...',
    used: percent => `${percent}% belegt`,
    tokens: (used, max) => `${used} / ${max} Tokens`,
    estimated: 'Geschätzte Auslastung',
    limits: 'Kontolimits',
    remaining: percent => `${percent}% verbleibend`,
    limitsEmpty: 'Für diesen Chat wurden keine Kontolimits gemeldet.',
    limitsLoading: 'Kontolimits werden geladen…',
    limitsError: 'Kontolimits nicht verfügbar. Bitte aktualisieren.',
    limitsManual: 'Wähle Aktualisieren, um die Kontolimits zu laden.',
    cursorLimits: 'Cursor-Limits (Quota-Cache)',
    cursorLoading: 'Cursor-Limits aus dem Cache werden geladen…',
    cursorEmpty: 'Keine Cursor-Kontingentfenster im Quota-Cache.',
    cursorStale: 'Cursor-Cache ist veraltet. Aktualisiere ihn in Quota und versuche es erneut.',
    cursorUnavailable: 'Cursor-Limits nicht verfügbar. Prüfe Quota für dieses Profil.',
    cursorReset: time => `Zurücksetzung: ${time}`,
    composition: 'Geschätzte Zusammensetzung',
    compositionNote: 'Kategoriegrößen sind grobe Schätzungen, keine gemessenen Anteile am Fenster.',
    categories: {
      system_prompt: 'System-Prompt', tool_definitions: 'Tool-Definitionen', rules: 'Regeln',
      skills: 'Skills', mcp: 'MCP', subagent_definitions: 'Subagent-Definitionen',
      memory: 'Speicher', conversation: 'Unterhaltung'
    },
    section: count => `Kontextdateien (${count})`,
    fullFile: amount => `~${amount} ganze Datei`,
    note: 'Schätzungen der ganzen Datei vor dem Kürzen, nicht die Tokens der Kontext-Summe.',
    noSession: 'Öffne einen Chat, um seine Kontextdateien zu prüfen.',
    noRoute: 'Die Verbindung dieses Chats ist nicht verfügbar.',
    busy: 'Warte auf das Ende der Antwort, bevor die neuesten Details abgerufen werden…',
    loading: 'Kontextdateien werden geladen…',
    noAgent: 'Sende eine Nachricht, um den Chat zu initialisieren, und öffne das Menü erneut.',
    empty: 'Für diesen Chat wurden keine Kontextdateien berücksichtigt.',
    failed: 'Kontextdateien konnten nicht geladen werden. Prüfe die Verbindung oder versuche es erneut.',
    refresh: 'Aktualisieren',
    pluginSettings: 'Plugin-Einstellungen',
    status: {
      blocked: 'Nicht geladen — von der Prompt-Injection-Prüfung blockiert',
      empty: 'Nicht geladen — leere Datei',
      flagged: 'Geladen — Prompt-Injection-Warnung prüfen',
      loaded: 'Geladen',
      shadowed: 'Nicht geladen — eine höher priorisierte Kontextdatei wurde verwendet',
      suppressed: 'Nicht geladen — Hermes-Installationsverzeichnis',
      truncated: 'Geladen — am Limit für Kontextdateien gekürzt',
      unreadable: 'Nicht geladen — Datei konnte nicht gelesen werden',
      unknown: 'Status nicht verfügbar'
    }
  },
  es: { status: {
    blocked: 'No cargado — bloqueado por el análisis de inyección de prompts',
    empty: 'No cargado — archivo vacío',
    flagged: 'Cargado — revisa la advertencia de inyección de prompts',
    loaded: 'Cargado',
    shadowed: 'No cargado — prevaleció un archivo de contexto con mayor prioridad',
    suppressed: 'No cargado — directorio de instalación de Hermes',
    truncated: 'Cargado — truncado en el límite de archivos de contexto',
    unreadable: 'No cargado — no se pudo leer el archivo'
  } },
  fr: { status: {
    blocked: "Non chargé — bloqué par l'analyse d'injection de prompt",
    empty: 'Non chargé — fichier vide',
    flagged: "Chargé — vérifiez l'avertissement d'injection de prompt",
    loaded: 'Chargé',
    shadowed: 'Non chargé — un fichier de contexte plus prioritaire a été retenu',
    suppressed: "Non chargé — répertoire d'installation de Hermes",
    truncated: 'Chargé — tronqué à la limite des fichiers de contexte',
    unreadable: 'Non chargé — impossible de lire le fichier'
  } },
  ja: { status: {
    blocked: '未読み込み — プロンプトインジェクション検査でブロック',
    empty: '未読み込み — 空のファイル',
    flagged: '読み込み済み — プロンプトインジェクション警告を確認してください',
    loaded: '読み込み済み',
    shadowed: '未読み込み — 優先度の高いコンテキストファイルを使用',
    suppressed: '未読み込み — Hermes のインストールディレクトリ',
    truncated: '読み込み済み — コンテキストファイルの上限で切り詰め',
    unreadable: '未読み込み — ファイルを読み取れませんでした'
  } },
  ru: { status: {
    blocked: 'Не загружен — заблокирован проверкой на инъекцию промпта',
    empty: 'Не загружен — пустой файл',
    flagged: 'Загружен — проверьте предупреждение об инъекции промпта',
    loaded: 'Загружен',
    shadowed: 'Не загружен — выбран файл контекста с более высоким приоритетом',
    suppressed: 'Не загружен — каталог установки Hermes',
    truncated: 'Загружен — обрезан по лимиту файла контекста',
    unreadable: 'Не загружен — файл не удалось прочитать'
  } },
  ar: { status: {
    blocked: 'لم يُحمّل — حظرته عملية فحص حقن التوجيهات',
    empty: 'لم يُحمّل — الملف فارغ',
    flagged: 'تم التحميل — راجع تحذير حقن التوجيهات',
    loaded: 'تم التحميل',
    shadowed: 'لم يُحمّل — تم اختيار ملف سياق ذي أولوية أعلى',
    suppressed: 'لم يُحمّل — مجلد تثبيت Hermes',
    truncated: 'تم التحميل — اقتُطع عند حد ملف السياق',
    unreadable: 'لم يُحمّل — تعذرت قراءة الملف'
  } },
  zh: { status: {
    blocked: '未加载 — 被提示词注入扫描拦截',
    empty: '未加载 — 空文件',
    flagged: '已加载 — 请检查提示词注入警告',
    loaded: '已加载',
    shadowed: '未加载 — 使用了优先级更高的上下文文件',
    suppressed: '未加载 — Hermes 安装目录',
    truncated: '已加载 — 已按上下文文件上限截断',
    unreadable: '未加载 — 无法读取文件'
  } },
  'zh-hant': { status: {
    blocked: '未載入 — 已被提示詞注入掃描阻擋',
    empty: '未載入 — 空白檔案',
    flagged: '已載入 — 請檢查提示詞注入警告',
    loaded: '已載入',
    shadowed: '未載入 — 使用了優先順序更高的上下文檔案',
    suppressed: '未載入 — Hermes 安裝目錄',
    truncated: '已載入 — 已依上下文檔案上限截斷',
    unreadable: '未載入 — 無法讀取檔案'
  } }
}

function formatEstimate(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0
    ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(amount)
    : '?'
}

function fileBasename(value) {
  const text = String(value ?? '')
  const trimmed = text.replace(/[\\/]+$/, '')
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  const name = cut >= 0 ? trimmed.slice(cut + 1) : trimmed
  return name || text
}

const PATH_MODES = new Set(['hidden', 'filename only', 'full path'])
const REFRESH_MODES = new Set(['manual', 'on menu open', 'on menu open and focus'])

function pathDisplay(phase, data) {
  const value = data?.context_file_paths
  if (value === 'full path' && (phase === 'ready' || phase === 'off')) return 'full path'
  if (value === 'hidden' || (value != null && !PATH_MODES.has(value))) return 'hidden'
  if (phase === 'closed') return 'hidden'
  return 'filename only'
}

function FileRow({ source, pathMode, t }) {
  const status = STATUS_KEYS.has(source.status) ? source.status : 'unknown'
  const reveal = pathMode === 'full path'
  const label = reveal || !/[\\/]/.test(String(source.label ?? '')) ? source.label : fileBasename(source.label)
  const pathText = reveal ? source.path : fileBasename(source.path)
  return jsxs('li', {
    'data-status': status,
    className: 'min-w-0 border-t border-(--ui-stroke-tertiary) pt-2',
    children: [
      jsxs('div', {
        className: 'flex min-w-0 flex-wrap items-baseline gap-x-2',
        children: [
          jsx('span', { className: 'min-w-0 break-all font-medium text-foreground', children: label }),
          jsx('span', {
            className: 'text-[0.6875rem] tabular-nums text-(--ui-text-tertiary)',
            children: t('fullFile', formatEstimate(source.est_tokens))
          })
        ]
      }),
      pathMode === 'hidden' ? null : jsx('p', {
        className: 'break-all text-[0.6875rem] text-(--ui-text-tertiary)',
        title: pathText,
        children: pathText
      }),
      jsx('p', { className: 'text-[0.6875rem] text-(--ui-text-secondary)', children: t(`status.${status}`) })
    ]
  })
}

// Hermes agent/context_breakdown.py _CATEGORIES. Remote color is not a CSS value.
const CATEGORY_COLOR = {
  system_prompt: 'var(--context-usage-system)',
  tool_definitions: 'var(--context-usage-tools)',
  rules: 'var(--context-usage-rules)',
  skills: 'var(--context-usage-skills)',
  mcp: 'var(--context-usage-mcp)',
  subagent_definitions: 'var(--context-usage-subagents)',
  memory: 'var(--context-usage-memory)',
  conversation: 'var(--context-usage-conversation)'
}

function categoryColor(id) {
  return Object.hasOwn(CATEGORY_COLOR, id) ? CATEGORY_COLOR[id] : 'var(--ui-stroke-tertiary)'
}

function ContextWindowVisual({ breakdown, usage, showComposition = true, t }) {
  const snapshot = breakdown?.context_max > 0 ? breakdown : usage?.context_max > 0 ? usage : null
  if (!snapshot) return null

  const max = Number(snapshot.context_max)
  const used = Math.min(max, Math.max(0, Number(snapshot.context_used) || 0))
  const percent = Math.min(100, Math.max(0, Math.round(used / max * 100)))
  const categories = Array.isArray(breakdown?.categories) ? breakdown.categories : []
  const categoryTotal = categories.reduce((sum, category) => sum + Math.max(0, Number(category.tokens) || 0), 0)

  return jsxs('section', {
    className: 'flex flex-col gap-2 px-2',
    'aria-label': t('title'),
    children: [
      breakdown?.model ? jsx('p', { className: 'break-all text-[0.6875rem] text-(--ui-text-secondary)', children: breakdown.model }) : null,
      jsxs('div', {
        className: 'flex items-baseline justify-between gap-2',
        children: [
          jsx('strong', { className: 'text-sm tabular-nums text-foreground', children: t('used', percent) }),
          jsx('span', { className: 'text-[0.6875rem] tabular-nums text-(--ui-text-secondary)',
            children: t('tokens', `${snapshot.context_estimated ? '~' : ''}${formatEstimate(used)}`, formatEstimate(max)) })
        ]
      }),
      jsx('div', {
        role: 'progressbar', 'aria-label': t('title'), 'aria-valuemin': 0, 'aria-valuemax': 100,
        'aria-valuenow': percent,
        'aria-valuetext': `${t('used', percent)}${snapshot.context_estimated ? `, ${t('estimated')}` : ''}`,
        className: 'h-2 w-full overflow-hidden rounded-full',
        style: { background: 'var(--ui-stroke-tertiary)' },
        children: jsx('div', { className: 'h-full', style: { width: `${percent}%`, background: 'var(--ui-accent)' } })
      }),
      snapshot.context_estimated ? jsx('p', {
        className: 'text-[0.6875rem] text-(--ui-text-tertiary)', children: t('estimated')
      }) : null,
      showComposition !== false && categories.length && categoryTotal ? jsxs('div', {
        className: 'mt-1 flex flex-col gap-2 border-t border-(--ui-stroke-tertiary) pt-2',
        children: [
          jsx('p', { className: 'font-medium text-foreground', children: t('composition') }),
          jsx('p', { className: 'text-[0.6875rem] leading-snug text-(--ui-text-tertiary)', children: t('compositionNote') }),
          jsx('div', {
            'aria-hidden': true,
            className: 'flex h-2 w-full overflow-hidden rounded-full',
            children: categories.map(category => jsx('span', {
              style: {
                width: `${Math.max(0, Number(category.tokens) || 0) / categoryTotal * 100}%`,
                background: categoryColor(category.id)
              }
            }, category.id))
          }),
          jsx('ul', { className: 'flex flex-col gap-1', children: categories.map(category => jsxs('li', {
            className: 'flex items-center justify-between gap-2',
            children: [
              jsxs('span', { className: 'flex min-w-0 items-center gap-2', children: [
                jsx('span', { 'aria-hidden': true, className: 'size-2 shrink-0 rounded-[2px]',
                  style: { background: categoryColor(category.id) } }),
                jsx('span', { className: 'truncate text-(--ui-text-secondary)',
                  children: t(`categories.${category.id}`) === `categories.${category.id}` ? category.label : t(`categories.${category.id}`) })
              ] }),
              jsx('span', { className: 'tabular-nums text-foreground', children: `~${formatEstimate(category.tokens)}` })
            ]
          }, category.id)) })
        ]
      }) : null
    ]
  })
}

// session.usage is tied to the live agent's provider and credential. Its
// account_lines are English backend-rendered text; only recognize the explicit
// "N% remaining (M% used)" contract, never guess missing token amounts.
function accountLimitRows(lines) {
  if (!Array.isArray(lines)) return { provider: '', windows: [], unavailable: true }
  const provider = lines.find(line => typeof line === 'string' && line.startsWith('Provider: '))?.slice(10) || ''
  const unavailable = lines.some(line => typeof line === 'string' &&
    (line.startsWith('Unavailable: ') || /: unavailable(?: • .*)?$/.test(line)))
  const windows = lines.flatMap(line => {
    if (typeof line !== 'string') return []
    const match = /^([^:]+): (\d+)% remaining \((\d+)% used\)(?: • (.+))?$/.exec(line)
    if (!match) return []
    const remaining = Number(match[2])
    const used = Number(match[3])
    if (remaining > 100 || used > 100 || Math.abs(remaining + used - 100) > 1) return []
    return [{ label: match[1], remaining, detail: match[4] || '' }]
  })
  return { provider, windows, unavailable }
}

const BUILTIN_SETTING_KEYS = ['show_openai_codex', 'show_anthropic', 'show_openrouter', 'show_other']
const SETTING_KEYS = [...BUILTIN_SETTING_KEYS, 'show_cursor']
const PROVIDER_SETTING = {
  'openai-codex': 'show_openai_codex',
  anthropic: 'show_anthropic',
  openrouter: 'show_openrouter'
}
const ALL_VISIBLE = {
  show_openai_codex: true, show_anthropic: true, show_openrouter: true, show_other: true,
  show_cursor: false
}
const DISPLAY_DEFAULTS = {
  account_refresh_mode: 'on menu open',
  context_file_paths: 'filename only',
  show_estimated_composition: true
}

function providerId(label) {
  return String(label || '').replace(/ \([^()]*\)$/, '')
}

function settingsPhase(query) {
  if (query.isPending || query.isFetching) return 'loading'
  if (query.isError) {
    const code = query.error?.code ?? query.error?.error?.code
    return code === -32601 ? 'fallback' : 'closed'
  }
  const data = query.data
  if (!data || BUILTIN_SETTING_KEYS.some(key => typeof data[key] !== 'boolean') ||
      (data.show_cursor !== undefined && typeof data.show_cursor !== 'boolean') ||
      (data.show_estimated_composition !== undefined && typeof data.show_estimated_composition !== 'boolean') ||
      (data.account_refresh_mode !== undefined && !REFRESH_MODES.has(data.account_refresh_mode)) ||
      (data.context_file_paths !== undefined && !PATH_MODES.has(data.context_file_paths))) return 'closed'
  return BUILTIN_SETTING_KEYS.every(key => data[key] === false) && data.show_cursor !== true ? 'off' : 'ready'
}

function accountRefreshMode(phase, data) {
  const value = data?.account_refresh_mode
  if ((phase === 'ready' || phase === 'fallback' || phase === 'off') &&
      (value == null || REFRESH_MODES.has(value))) return value || DISPLAY_DEFAULTS.account_refresh_mode
  return 'manual'
}

function providerShown(lines, phase, data) {
  if (phase === 'fallback') return true
  const id = providerId(accountLimitRows(lines).provider)
  if (!id) return true
  if (id === 'cursor') return data?.show_cursor === true
  const key = PROVIDER_SETTING[id] || 'show_other'
  return data?.[key] === true
}

function flagsFromList(payload, route) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('malformed settings')
  if (payload.profile != null && payload.profile !== route.profile) throw new Error('settings profile mismatch')
  if (payload.connectionId != null && payload.connectionId !== route.connectionId) throw new Error('settings connection mismatch')
  if (!Array.isArray(payload.plugins)) throw new Error('malformed settings')
  const row = payload.plugins.find(plugin => plugin && (plugin.key === ID || plugin.name === ID))
  const schema = row?.settings_schema
  if (!row || !Array.isArray(schema) || !schema.length) return { ...ALL_VISIBLE, ...DISPLAY_DEFAULTS }
  const values = {}
  for (const key of SETTING_KEYS) {
    const entry = schema.find(item => item && item.key === key)
    const stored = entry && entry.value != null ? entry.value : entry?.default
    if (!entry || stored == null) values[key] = ALL_VISIBLE[key]
    else if (typeof stored !== 'boolean') throw new Error('non-boolean provider setting')
    else values[key] = stored
  }
  values.account_refresh_mode = enumFromSchema(schema, 'account_refresh_mode', REFRESH_MODES, DISPLAY_DEFAULTS.account_refresh_mode)
  values.context_file_paths = enumFromSchema(schema, 'context_file_paths', PATH_MODES, DISPLAY_DEFAULTS.context_file_paths)
  const composition = schema.find(item => item && item.key === 'show_estimated_composition')
  const compositionStored = composition && composition.value != null ? composition.value : composition?.default
  if (!composition || compositionStored == null) values.show_estimated_composition = DISPLAY_DEFAULTS.show_estimated_composition
  else if (typeof compositionStored !== 'boolean') throw new Error('non-boolean provider setting')
  else values.show_estimated_composition = compositionStored
  return values
}

function enumFromSchema(schema, key, allow, fallback) {
  const entry = schema.find(item => item && item.key === key)
  if (!entry) return fallback
  const stored = entry.value != null ? entry.value : entry.default
  if (stored == null) return fallback
  if (typeof stored !== 'string' || !allow.has(stored)) throw new Error('invalid ' + key)
  return stored
}

function providerSettings(route) {
  return host.requestProfile(route, 'plugins.manage', { action: 'list', profile: route.profile }, 12_000)
    .then(payload => flagsFromList(payload, route))
}

// The optional Quota plugin owns fetching and credentials. Its --cached CLI
// path reads a local snapshot only. Discard all other provider/account fields
// before returning a value to React Query; do not cache the raw CLI response.
function parseCursorCache(output) {
  if (typeof output !== 'string' || output.length > 48_000) throw new Error('invalid Cursor cache')
  const payload = JSON.parse(output)
  const age = payload?.age_s
  if (typeof age !== 'number' || !Number.isFinite(age) || age < 0 || age > 1800) {
    return { status: 'stale', windows: [] }
  }
  const cursor = payload?.providers?.cursor
  if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor) || cursor.unavailable_reason) {
    return { status: 'unavailable', windows: [] }
  }
  const windows = (Array.isArray(cursor.windows) ? cursor.windows : []).slice(0, 6).flatMap(window => {
    if (!window || typeof window.label !== 'string' ||
        !/^[A-Za-z][A-Za-z0-9 .-]{0,39}$/.test(window.label) ||
        typeof window.used_percent !== 'number' || !Number.isFinite(window.used_percent) ||
        window.used_percent < 0 || window.used_percent > 100) return []
    const reset = window.reset_at
    const resetAt = typeof reset === 'string' && reset.length <= 50 &&
      /^\d{4}-\d\d-\d\dT/.test(reset) && Number.isFinite(Date.parse(reset))
      ? new Date(reset).toISOString() : null
    return [{ label: window.label, remaining: Math.round(100 - window.used_percent), resetAt }]
  })
  return { status: windows.length ? 'ready' : 'empty', windows }
}

async function readCursorCache(route) {
  try {
    const response = await host.requestProfile(route, 'cli.exec', {
      argv: ['--profile', route.targetProfile, 'quota', 'status', '--json', '--cached'],
      timeout: 10
    }, 12_000)
    if (response?.blocked || response?.code !== 0) throw new Error('cache unavailable')
    return parseCursorCache(response.output)
  } catch {
    // Gateway/CLI diagnostics may contain paths or account details. Never
    // render or cache their text, even when the optional plugin is missing.
    throw new Error('Cursor cache unavailable')
  }
}

function AccountLimitsVisual({ account, loading, error, manual, t }) {
  const { provider, windows, unavailable } = accountLimitRows(account?.account_lines)
  return jsxs('section', {
    'aria-label': t('limits'),
    className: 'mx-2 flex flex-col gap-2 border-t border-(--ui-stroke-tertiary) pt-3',
    children: [
      jsx('p', { className: 'font-medium text-foreground', children: t('limits') }),
      provider ? jsx('p', { className: 'text-[0.6875rem] text-(--ui-text-secondary)', children: provider }) : null,
      windows.map((window, index) => jsxs('div', { className: 'flex flex-col gap-1', children: [
        jsxs('div', { className: 'flex items-baseline justify-between gap-2', children: [
          jsx('span', { className: 'text-(--ui-text-secondary)', children: window.label }),
          jsx('span', { className: 'tabular-nums text-foreground', children: t('remaining', window.remaining) })
        ] }),
        jsx('div', {
          role: 'progressbar', 'aria-label': `${window.label} ${t('limits')}`,
          'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': window.remaining,
          className: 'h-2 w-full overflow-hidden rounded-full',
          style: { background: 'var(--ui-stroke-tertiary)' },
          children: jsx('div', { className: 'h-full', style: { width: `${window.remaining}%`, background: 'var(--ui-accent)' } })
        }),
        window.detail ? jsx('p', { className: 'text-[0.6875rem] text-(--ui-text-tertiary)', children: window.detail }) : null
      ] }, `${window.label}:${index}`)),
      !windows.length ? jsx('p', { role: 'status', className: 'text-(--ui-text-secondary)',
        children: manual ? t('limitsManual') : loading ? t('limitsLoading') : error || unavailable ? t('limitsError') : t('limitsEmpty') }) : null
    ]
  })
}

function formatCursorReset(resetAt) {
  if (typeof resetAt !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(resetAt)) return null
  const date = new Date(resetAt)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(date)
}

function CursorLimitsVisual({ data, loading, error, t }) {
  const windows = !loading && !error && data?.status === 'ready' ? data.windows : []
  const message = loading ? t('cursorLoading') : error ? t('cursorUnavailable') :
    data?.status === 'stale' ? t('cursorStale') :
    data?.status === 'unavailable' ? t('cursorUnavailable') : t('cursorEmpty')
  return jsxs('section', {
    'aria-label': t('cursorLimits'),
    className: 'mx-2 flex flex-col gap-2 border-t border-(--ui-stroke-tertiary) pt-3',
    children: [
      jsx('p', { className: 'font-medium text-foreground', children: t('cursorLimits') }),
      ...windows.map((window, index) => {
        const resetTime = formatCursorReset(window.resetAt)
        return jsxs('div', { className: 'flex flex-col gap-1', children: [
          jsxs('div', { className: 'flex items-baseline justify-between gap-2', children: [
            jsx('span', { className: 'text-(--ui-text-secondary)', children: window.label }),
            jsx('span', { className: 'tabular-nums text-foreground', children: t('remaining', window.remaining) })
          ] }),
          jsx('div', {
            role: 'progressbar', 'aria-label': `${window.label} ${t('cursorLimits')}`,
            'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': window.remaining,
            className: 'h-2 w-full overflow-hidden rounded-full',
            style: { background: 'var(--ui-stroke-tertiary)' },
            children: jsx('div', { className: 'h-full',
              style: { width: `${window.remaining}%`, background: 'var(--ui-accent)' } })
          }),
          resetTime ? jsx('p', { className: 'text-[0.6875rem] text-(--ui-text-tertiary)',
            children: t('cursorReset', resetTime) }) : null
        ] }, `${window.label}:${index}`)
      }),
      !windows.length ? jsx('p', { role: 'status', className: 'text-(--ui-text-secondary)', children: message }) : null
    ]
  })
}

function paneOwner(owner) {
  if (!owner || typeof owner.connectionId !== 'string' || !owner.connectionId ||
      typeof owner.profile !== 'string' || !owner.profile) return null
  return { connectionId: owner.connectionId, profile: owner.profile }
}

function useContextData(pane) {
  const focusedSessionId = useValue(host.state.focusedSessionId)
  const focusedOwner = useValue(host.state.focusedSessionOwner)
  const primaryBusy = useValue(host.state.busy)
  const busyBySession = useValue(host.state.busyBySession)
  const focusedUsage = useValue(host.state.focusedUsage)
  const scoped = pane != null
  const sessionId = scoped
    ? (typeof pane.sessionId === 'string' && pane.sessionId ? pane.sessionId : null)
    : focusedSessionId
  const owner = scoped ? paneOwner(pane.owner) : focusedOwner
  // The primary workspace can keep running after focus moves to an idle tile.
  // When its runtime has a state slice, that slice owns the turn flag.
  const busy = scoped
    ? Boolean(pane.busy)
    : (sessionId && Object.prototype.hasOwnProperty.call(busyBySession ?? {}, sessionId)
        ? Boolean(busyBySession[sessionId]) : primaryBusy)
  // Pane usage is the last completed turn, not a live stream. focusedUsage
  // remains the legacy status-bar stream and is ignored for a pane meter.
  const liveUsage = scoped ? (busy || !sessionId || !owner ? null : pane.usage) : focusedUsage
  const identityReady = Boolean(sessionId && owner?.connectionId && owner?.profile)
  // A pane or focused tile can belong to another connection even while the
  // active gateway stays on the foreground profile. Route discovery is async.
  const routes = useQuery({
    queryKey: [ID, 'routes', owner?.connectionId, owner?.profile],
    queryFn: () => host.profileRoutes(),
    enabled: identityReady,
    retry: false,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false
  })
  const matchingRoutes = identityReady && !routes.isError && Array.isArray(routes.data)
    ? routes.data.filter(candidate => candidate.connectionId === owner.connectionId && candidate.profile === owner.profile)
    : []
  const route = matchingRoutes.length === 1 ? matchingRoutes[0] : null
  const enabled = identityReady && Boolean(route) && !busy
  const result = useQuery({
    queryKey: [ID, owner?.connectionId, owner?.profile, sessionId],
    queryFn: () => host.requestProfile(route, 'session.context_breakdown', { session_id: sessionId }, 12_000),
    enabled,
    retry: false,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false
  })
  // A settled snapshot from the preceding turn/compression is not current
  // while this session's fresh read is still in flight.
  const breakdown = enabled && !result.isError && !result.isFetching ? result.data : null
  return { sessionId, owner, busy, liveUsage, routes, route, enabled, result, breakdown, scoped }
}

function FooterMeter({ pane } = {}) {
  const t = usePluginI18n(ID)
  const { busy, liveUsage, breakdown, scoped } = useContextData(pane)
  const settled = breakdown?.context_max > 0 ? breakdown : null
  const streamed = !scoped && busy && liveUsage?.context_max > 0 ? liveUsage : null
  const completed = scoped && !busy && liveUsage?.context_max > 0 ? liveUsage : null
  const snapshot = settled || streamed || completed || null
  const max = Number(snapshot?.context_max) || 0
  const used = max ? Math.min(max, Math.max(0, Number(snapshot.context_used) || 0)) : 0
  const percent = max ? Math.min(100, Math.max(0, Math.round(used / max * 100))) : null
  return jsxs('span', { className: 'inline-flex items-center gap-1.5', children: [
    jsx('span', { children: t(busy ? 'calculating' : 'footer') }),
    jsx('span', {
      role: 'progressbar', 'aria-label': t('title'), 'aria-valuemin': 0, 'aria-valuemax': 100,
      'aria-valuenow': percent === null ? undefined : percent,
      'aria-valuetext': percent === null ? undefined : `${t('used', percent)}${snapshot.context_estimated ? `, ${t('estimated')}` : ''}`,
      className: 'inline-flex h-1.5 w-10 overflow-hidden rounded-full',
      style: { background: 'var(--ui-stroke-tertiary)' },
      children: jsx('span', { className: 'h-full', style: {
        width: `${percent ?? 0}%`, background: 'var(--ui-accent)'
      } })
    }),
    jsx('span', { className: 'tabular-nums', children: percent === null ? '—' : `${snapshot.context_estimated ? '~' : ''}${percent}%` })
  ] })
}

function ContextFilesMenu({ pane } = {}) {
  const t = usePluginI18n(ID)
  const { sessionId, owner, busy, liveUsage, routes, route, enabled, result, breakdown, scoped } = useContextData(pane)
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const files = Array.isArray(breakdown?.context_files) ? breakdown.context_files : []
  // Menu-only. Other plugin rows are dropped inside the request, and the
  // context meter does not wait on this read.
  const settings = useQuery({
    queryKey: [ID, 'provider-settings', owner?.connectionId, owner?.profile],
    queryFn: () => providerSettings(route),
    enabled: Boolean(route),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false
  })
  const phase = route ? settingsPhase(settings) : 'loading'
  // A draft's session.usage falls back to the profile's configured provider,
  // which may differ from the model this chat will ultimately run.
  const eligible = Boolean(sessionId && route && Array.isArray(breakdown?.context_files))
  const builtinsEnabled = phase === 'fallback' || (phase === 'ready' &&
    BUILTIN_SETTING_KEYS.some(key => settings.data?.[key] === true))
  const accountReady = eligible && builtinsEnabled
  const cursorReady = Boolean(sessionId && route && typeof route.targetProfile === 'string' &&
    route.targetProfile.length && phase === 'ready' && settings.data?.show_cursor === true)
  const cursor = useQuery({
    queryKey: [ID, 'cursor-limits', owner?.connectionId, owner?.profile],
    queryFn: () => readCursorCache(route),
    enabled: cursorReady,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false
  })
  const refreshMode = accountRefreshMode(phase, settings.data)
  const account = useQuery({
    queryKey: [ID, 'account-limits', owner?.connectionId, owner?.profile, sessionId, breakdown?.model, refreshMode],
    queryFn: () => host.requestProfile(route, 'session.usage', { session_id: sessionId }, 25_000),
    enabled: accountReady && refreshMode !== 'manual',
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: refreshMode === 'on menu open and focus'
  })

  let message = null
  if (!sessionId) message = t('noSession')
  else if (busy) message = t('busy')
  else if (owner && (routes.isPending || routes.isFetching)) message = t('loading')
  else if (!route) message = t('noRoute')
  else if (!enabled || result.isPending || result.isFetching) message = t('loading')
  else if (result.isError) message = t('failed')
  else if (!breakdown?.context_max) message = t('noAgent')

  const waitingForManual = accountReady && refreshMode === 'manual' && !account.isFetched
  const settledAccount = accountReady && !waitingForManual && !account.isError && !account.isFetching && !account.isPending
    ? account.data : null
  const showAccount = accountReady && !(settledAccount && !providerShown(settledAccount.account_lines, phase, settings.data))

  return jsxs('div', {
    className: 'flex w-80 max-w-[min(80vw,24rem)] flex-col gap-2 p-2 text-xs',
    children: [
      jsxs('div', {
        'data-slot': 'context-menu-header',
        className: 'flex items-center justify-between gap-2 px-2',
        children: [
          jsx('span', { className: 'font-medium text-foreground', children: t('title') }),
          jsx(DropdownMenuItem, {
            'aria-label': t('pluginSettings'),
            className: 'size-8 shrink-0 justify-center p-0',
            onSelect: () => {
              host.navigate('/capabilities?tab=plugins&plugin=' + encodeURIComponent(ID))
            },
            children: jsx(Codicon, { name: 'settings-gear', 'aria-hidden': true })
          })
        ]
      }),
      jsx(ContextWindowVisual, {
        breakdown, usage: scoped || !busy ? null : liveUsage,
        showComposition: settings.data?.show_estimated_composition !== false, t
      }),
      message ? jsx('p', { className: 'px-2 text-(--ui-text-secondary)', role: 'status', children: message }) : null,
      showAccount ? jsx(AccountLimitsVisual, {
        account: settledAccount,
        loading: !waitingForManual && (account.isPending || account.isFetching),
        error: !waitingForManual && account.isError,
        manual: waitingForManual,
        t
      }) : null,
      cursorReady ? jsx(CursorLimitsVisual, {
        data: cursor.isFetching || cursor.isPending || cursor.isError ? null : cursor.data,
        loading: cursor.isPending || cursor.isFetching, error: cursor.isError, t
      }) : null,
      files.length && !message ? jsx(DropdownMenuItem, {
        'aria-controls': detailsId,
        'aria-expanded': open,
        onSelect: event => { event.preventDefault(); setOpen(value => !value) },
        children: t('section', files.length)
      }) : null,
      files.length && !message && open ? jsxs('div', {
        id: detailsId,
        className: 'max-h-[min(60vh,28rem)] overflow-y-auto px-2',
        children: [
          jsx('p', { className: 'pb-2 text-[0.6875rem] leading-snug text-(--ui-text-tertiary)', children: t('note') }),
          jsx('ul', { className: 'flex flex-col gap-2', children: files.map((source, index) =>
            jsx(FileRow, { source, pathMode: pathDisplay(phase, settings.data), t }, `${index}:${source.label}`)) })
        ]
      }) : null,
      jsx(DropdownMenuItem, {
        disabled: !enabled,
        onSelect: event => {
          event.preventDefault()
          void result.refetch()
          if (accountReady) void account.refetch()
          if (cursorReady) void cursor.refetch()
        },
        children: t('refresh')
      })
    ]
  })
}

export default {
  id: ID,
  name: 'Context Window Visualizer',
  defaultEnabled: true,
  register(ctx) {
    ctx.i18n.register(translations)
    // Compression and reclaim change context without a busy transition. The
    // public event tap carries the source route, so reset only that session's
    // cached reads. resetQueries evicts old values and refetches active reads.
    for (const type of ['session.info', 'session.reclaimed']) {
      ctx.onEvent(type, event => {
        // session.reclaimed is a broadcast: the envelope has no session ID,
        // while the reclaimed runtime ID lives in its payload.
        const sessionId = event?.session_id || event?.payload?.session_id
        const connectionId = event?.connectionId || host.state.connectionId.get()
        const profile = event?.profile || host.state.profile.get()
        if (!sessionId || !connectionId || !profile) return
        void queryClient.resetQueries({ queryKey: [ID, connectionId, profile, sessionId], exact: true })
        void queryClient.resetQueries({ queryKey: [ID, 'account-limits', connectionId, profile, sessionId] })
      })
    }
    const paneArea = typeof sdk.CHAT_PANE_FOOTER_AREA === 'string' ? sdk.CHAT_PANE_FOOTER_AREA : ''
    if (paneArea && typeof DropdownMenu === 'function') {
      ctx.register({
        id: 'pane-status',
        area: paneArea,
        order: 110,
        data: { render: PaneFooter }
      })
      return
    }
    ctx.register({
      id: 'status',
      area: STATUSBAR_AREAS.right,
      order: 110,
      data: {
        id: `${ID}:status`,
        label: jsx(FooterMeter, {}),
        title: 'Visualize the focused chat’s model context window',
        toggleLabel: 'Context window',
        variant: 'menu',
        menuAlign: 'end',
        menuClassName: 'w-80',
        menuContent: () => jsx(ContextFilesMenu, {})
      }
    })
  }
}

function PaneFooter(pane) {
  const [open, setOpen] = useState(false)
  return jsxs(DropdownMenu, {
    open, onOpenChange: setOpen,
    children: [
      jsx(DropdownMenuTrigger, {
        asChild: true,
        children: jsx('button', {
          type: 'button',
          'data-slot': 'context-pane-meter',
          className: 'inline-flex items-center',
          children: jsx(FooterMeter, { pane })
        })
      }),
      open ? jsx(DropdownMenuContent, {
        align: 'end',
        className: 'w-80',
        children: jsx(ContextFilesMenu, { pane })
      }) : null
    ]
  })
}
