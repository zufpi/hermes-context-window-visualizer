import {
  DropdownMenuItem,
  STATUSBAR_AREAS,
  host,
  queryClient,
  usePluginI18n,
  useQuery,
  useValue
} from '@hermes/plugin-sdk'
import { useId, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const ID = 'context-window-visualizer'
const STATUS_KEYS = new Set(['blocked', 'empty', 'flagged', 'loaded', 'shadowed', 'suppressed', 'truncated', 'unreadable'])

const translations = {
  en: {
    title: 'Context window',
    footer: 'Context',
    used: percent => `${percent}% used`,
    tokens: (used, max) => `${used} / ${max} tokens`,
    estimated: 'Estimated occupancy',
    limits: 'Account limits',
    remaining: percent => `${percent}% remaining`,
    limitsEmpty: 'No account-limit windows reported for this chat.',
    limitsLoading: 'Loading account limits…',
    limitsError: 'Account limits unavailable. Try Refresh.',
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
    busy: 'Waiting for this turn to finish…',
    loading: 'Loading context files…',
    noAgent: 'Send a message to initialize this chat, then reopen this menu.',
    empty: 'No context files were considered for this chat.',
    failed: 'Could not load the context-file breakdown. Check the connection or try again.',
    refresh: 'Refresh',
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
    used: percent => `${percent}% belegt`,
    tokens: (used, max) => `${used} / ${max} Tokens`,
    estimated: 'Geschätzte Auslastung',
    limits: 'Kontolimits',
    remaining: percent => `${percent}% verbleibend`,
    limitsEmpty: 'Für diesen Chat wurden keine Kontolimits gemeldet.',
    limitsLoading: 'Kontolimits werden geladen…',
    limitsError: 'Kontolimits nicht verfügbar. Bitte aktualisieren.',
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
    busy: 'Warte auf das Ende dieses Durchlaufs…',
    loading: 'Kontextdateien werden geladen…',
    noAgent: 'Sende eine Nachricht, um den Chat zu initialisieren, und öffne das Menü erneut.',
    empty: 'Für diesen Chat wurden keine Kontextdateien berücksichtigt.',
    failed: 'Kontextdateien konnten nicht geladen werden. Prüfe die Verbindung oder versuche es erneut.',
    refresh: 'Aktualisieren',
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

function FileRow({ source, t }) {
  const status = STATUS_KEYS.has(source.status) ? source.status : 'unknown'
  return jsxs('li', {
    'data-status': status,
    className: 'min-w-0 border-t border-(--ui-stroke-tertiary) pt-2',
    children: [
      jsxs('div', {
        className: 'flex min-w-0 flex-wrap items-baseline gap-x-2',
        children: [
          jsx('span', { className: 'min-w-0 break-all font-medium text-foreground', children: source.label }),
          jsx('span', {
            className: 'text-[0.6875rem] tabular-nums text-(--ui-text-tertiary)',
            children: t('fullFile', formatEstimate(source.est_tokens))
          })
        ]
      }),
      jsx('p', { className: 'break-all text-[0.6875rem] text-(--ui-text-tertiary)', title: source.path, children: source.path }),
      jsx('p', { className: 'text-[0.6875rem] text-(--ui-text-secondary)', children: t(`status.${status}`) })
    ]
  })
}

function ContextWindowVisual({ breakdown, usage, t }) {
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
      categories.length && categoryTotal ? jsxs('div', {
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
                background: category.color
              }
            }, category.id))
          }),
          jsx('ul', { className: 'flex flex-col gap-1', children: categories.map(category => jsxs('li', {
            className: 'flex items-center justify-between gap-2',
            children: [
              jsxs('span', { className: 'flex min-w-0 items-center gap-2', children: [
                jsx('span', { 'aria-hidden': true, className: 'size-2 shrink-0 rounded-[2px]',
                  style: { background: category.color } }),
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

function AccountLimitsVisual({ account, loading, error, t }) {
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
        children: loading ? t('limitsLoading') : error || unavailable ? t('limitsError') : t('limitsEmpty') }) : null
    ]
  })
}

function useFocusedContextData() {
  const sessionId = useValue(host.state.focusedSessionId)
  const owner = useValue(host.state.focusedSessionOwner)
  const primaryBusy = useValue(host.state.busy)
  const busyBySession = useValue(host.state.busyBySession)
  // The primary workspace can keep running after focus moves to an idle tile.
  // When its runtime has a state slice, that slice owns the turn flag.
  const busy = sessionId && Object.prototype.hasOwnProperty.call(busyBySession ?? {}, sessionId)
    ? Boolean(busyBySession[sessionId]) : primaryBusy
  const focusedUsage = useValue(host.state.focusedUsage)
  // A focused split tile can belong to another connection even while the
  // active gateway stays on the foreground profile. Route discovery is async.
  const routes = useQuery({
    queryKey: [ID, 'routes', owner?.connectionId, owner?.profile],
    queryFn: () => host.profileRoutes(),
    enabled: Boolean(sessionId && owner),
    retry: false,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false
  })
  const matchingRoutes = owner && !routes.isError && Array.isArray(routes.data)
    ? routes.data.filter(candidate => candidate.connectionId === owner.connectionId && candidate.profile === owner.profile)
    : []
  const route = matchingRoutes.length === 1 ? matchingRoutes[0] : null
  const enabled = Boolean(sessionId && route) && !busy
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
  return { sessionId, owner, busy, focusedUsage, routes, route, enabled, result, breakdown }
}

function FooterMeter() {
  const t = usePluginI18n(ID)
  const { busy, focusedUsage, breakdown } = useFocusedContextData()
  const snapshot = breakdown?.context_max > 0 ? breakdown : busy && focusedUsage?.context_max > 0 ? focusedUsage : null
  const max = Number(snapshot?.context_max) || 0
  const used = max ? Math.min(max, Math.max(0, Number(snapshot.context_used) || 0)) : 0
  const percent = max ? Math.min(100, Math.max(0, Math.round(used / max * 100))) : null
  return jsxs('span', { className: 'inline-flex items-center gap-1.5', children: [
    jsx('span', { children: t('footer') }),
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

function ContextFilesMenu() {
  const t = usePluginI18n(ID)
  const { sessionId, owner, busy, focusedUsage, routes, route, enabled, result, breakdown } = useFocusedContextData()
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const files = Array.isArray(breakdown?.context_files) ? breakdown.context_files : []
  // A draft's session.usage falls back to the profile's configured provider,
  // which may differ from the model this chat will ultimately run.
  const accountReady = Boolean(sessionId && route && Array.isArray(breakdown?.context_files))
  const account = useQuery({
    queryKey: [ID, 'account-limits', owner?.connectionId, owner?.profile, sessionId, breakdown?.model],
    queryFn: () => host.requestProfile(route, 'session.usage', { session_id: sessionId }, 25_000),
    enabled: accountReady,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  })

  let message = null
  if (!sessionId) message = t('noSession')
  else if (busy) message = t('busy')
  else if (owner && (routes.isPending || routes.isFetching)) message = t('loading')
  else if (!route) message = t('noRoute')
  else if (!enabled || result.isPending || result.isFetching) message = t('loading')
  else if (result.isError) message = t('failed')
  else if (!breakdown?.context_max) message = t('noAgent')

  return jsxs('div', {
    className: 'flex w-80 max-w-[min(80vw,24rem)] flex-col gap-2 p-2 text-xs',
    children: [
      jsx('div', { className: 'px-2 font-medium text-foreground', children: t('title') }),
      jsx(ContextWindowVisual, { breakdown, usage: busy ? focusedUsage : null, t }),
      message ? jsx('p', { className: 'px-2 text-(--ui-text-secondary)', role: 'status', children: message }) : null,
      accountReady ? jsx(AccountLimitsVisual, {
        account: account.isError || account.isFetching ? null : account.data,
        loading: account.isPending || account.isFetching, error: account.isError, t
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
            jsx(FileRow, { source, t }, `${source.path}:${source.label}:${index}`)) })
        ]
      }) : null,
      jsx(DropdownMenuItem, {
        disabled: !enabled,
        onSelect: event => { event.preventDefault(); void result.refetch(); if (accountReady) void account.refetch() },
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
