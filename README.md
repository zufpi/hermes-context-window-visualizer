# Context Window Visualizer for Hermes Desktop

See how full **each visible chat’s model context window** is. Per-pane footer placement requires a Desktop build that exports and mounts `CHAT_PANE_FOOTER_AREA`. That slot is a local, uncommitted customization of Hermes Desktop, not released upstream. Installing this plugin from Git alone, or updating stock Desktop, keeps one focused status-bar chip. Users cannot obtain per-pane placement from a stock release until that core SDK surface is published. Where that local footer is mounted, one **Context** meter sits in the lower-right footer of that pane — one pane, or each side of a split — and the popup describes that pane. There is no second, window-wide Context chip. Open **Context** for an estimated breakdown, optional context-file details, account-limit windows Hermes reports for that chat, and opt-in cached Cursor allowance from the separate Quota plugin. This Desktop-only community plugin does not fetch or refresh Cursor quotas itself and does not replace Hermes’s built-in Context Usage control.

## Contents

- [Install](#install)
- [Reading the display](#reading-the-display)
- [Data sources and provider support](#data-sources-and-provider-support)
- [Provider visibility](#provider-visibility)
- [Cursor via Quota cache](#cursor-via-quota-cache)
- [Focused chats, profiles, and remote gateways](#focused-chats-profiles-and-remote-gateways)
- [Privacy and safety](#privacy-and-safety)
- [Troubleshooting](#troubleshooting)
- [To do](#to-do)
- [Development and compatibility](#development-and-compatibility)

## Install

**Requirements:** Hermes Desktop with a compatible backend and Desktop Plugin SDK. The manifest declares `requires_hermes: ">=0.21.5"`; older backends may not provide `session.context_breakdown`. The **visualization** runs only in Desktop (not the CLI, TUI, or web dashboard), but provider-visibility settings can also be changed with `hermes config`. No Python package, API key, build step, or separate service is required for the plugin.

### Install from Git

From Hermes Desktop:

1. In Hermes Desktop, open **Capabilities → Plugins → Install from Git**.
2. Enter `https://github.com/zufpi/hermes-context-window-visualizer`. Keep **Agent plugin** selected for the chat’s owning backend/profile (it supplies the `plugin.yaml` settings schema), and **Desktop UI** selected for the machine running the app. The install dialog defaults to both; review both destinations before confirming. If the chat uses a remote backend, the Agent component goes there while the Desktop UI stays local.
3. Check that **Context Window Visualizer** is enabled in the **Desktop** column of **Capabilities → Plugins**. Per-pane meters appear only when Desktop exports and mounts `CHAT_PANE_FOOTER_AREA`. That slot is a local, uncommitted customization of Hermes Desktop, not an upstream release and not something a Git install of this plugin adds. Updating stock Desktop does not add it either. Use **Cmd/Ctrl+K → Reload desktop plugins** after you install or update this package. Where that local footer is already mounted, each visible chat pane shows one **Context** meter at its lower right. Inactive tabs do not. On stock Desktop you keep one **Context** item in the bottom status bar; right-click the bar and use **Show in status bar** if it is hidden.

A Git install is a custom-source install, **not a reviewed catalog install or an immutable catalog pin**. Inspect the code you install. If the menu does not appear after installation, use **Cmd/Ctrl+K → Reload desktop plugins**. A plugin that you previously disabled remains disabled until you re-enable it.

### Install with the Hermes CLI

On the machine running Hermes Desktop, use the repository URL (the plugin is not in the catalog, so its name alone will not resolve):

```sh
hermes plugins install https://github.com/zufpi/hermes-context-window-visualizer --enable
```

This installs the package under `$HERMES_HOME/plugins/context-window-visualizer`. The CLI enables the package; the **Desktop UI** is a separate switch. In Desktop, run **Cmd/Ctrl+K → Reload desktop plugins**, then enable **Context Window Visualizer** in the Desktop column of **Capabilities → Plugins** if it is off. No gateway restart is needed for this Desktop-only plugin, even if the CLI prints its generic restart reminder. Reloading plugins does not add `CHAT_PANE_FOOTER_AREA`. That slot is a local, uncommitted Desktop customization, not a stock upgrade. Without it, this install keeps the one focused status-bar chip.

If you previously copied `plugin.js` into `$HERMES_HOME/desktop-plugins/context-window-visualizer/` by hand, move that folder **outside** `desktop-plugins/` before using the CLI-managed install. Desktop deliberately preserves a manual copy instead of overwriting it with a package copy; otherwise you may keep running the old file. For remote gateways, install the Desktop half on the machine running the app, not solely on the remote backend.

To validate the installed package, run `hermes plugins validate "${HERMES_HOME:-$HOME/.hermes}/plugins/context-window-visualizer" --install-deps`. `hermes plugins doctor` currently expects a Python `__init__.py` and reports an error for this Desktop-only package; it is not the validation command for this case.

### Local developer install

From a checkout of this repository on macOS or Linux, copy the single uncompiled ESM file to the Desktop plugin loader’s directory:

```sh
: "${HERMES_HOME:=$HOME/.hermes}"
mkdir -p "$HERMES_HOME/desktop-plugins/context-window-visualizer"
cp desktop/plugin.js "$HERMES_HOME/desktop-plugins/context-window-visualizer/plugin.js"
```

Run these commands from the repository root. If you use a custom Hermes home, set `HERMES_HOME` to the home **used by Desktop** before running them. On Windows, copy the file to the equivalent `desktop-plugins/context-window-visualizer/plugin.js` directory under Desktop’s Hermes home. The directory name must match the exported plugin ID. The loader watches for saves and normally hot-reloads; **Reload desktop plugins** in the command palette is the fallback. For local development, repeat the copy after editing the source, or edit the installed copy directly. This manual copy is separate from Git installation and does not install a backend component. It also has no `plugin.yaml`, so the owning backend has no settings schema and the **Capabilities → Plugins row's settings gear** is not shown. The icon-only gear in the Context popup still opens that page, but cannot expose switches without the package on the backend. Until the unified package is installed on that backend, account limits stay visible for every returned provider, account refresh stays **on menu open**, context-file paths stay **filename only**, estimated composition stays visible, and Cursor stays off. See [Provider visibility](#provider-visibility).

To remove a manual copy, disable it in **Capabilities → Plugins** and remove its `desktop-plugins/context-window-visualizer` directory from Desktop’s Hermes home. Use Hermes’s Plugins UI to manage a Git-installed copy instead.

## Reading the display

- **Per-pane footer:** Where Desktop exports and mounts `CHAT_PANE_FOOTER_AREA`, **Context** is a button in that pane’s lower-right footer. It shows a bar and a rounded percentage for **that** pane: its own settled breakdown, or, while idle and the breakdown is not ready, that pane’s last completed usage. A dash means no usable window is available yet; it is not zero usage. The occupancy is capped at the displayed window size. A leading `~` marks an estimated occupancy. While that pane is busy, the label is **Calculating...** and the meter does not show a percentage. The pane’s usage field is updated per completed turn, so it is not treated as a live stream.
- **Older status bar:** Desktop builds without the pane footer keep one **Context** chip in the window status bar for the focused chat. During that focused chat’s turn, this fallback can still show streamed usage. It is not added beside the per-pane meters.
- **Context menu:** Click the chip for the backend-reported model name (when available), compact used/max token figures, and a larger occupancy bar. Hermes’s `session.context_breakdown` supplies the settled snapshot. When provider-anchored usage is available, Hermes uses it; otherwise occupancy is estimated and labeled **Estimated occupancy**. These are context-window figures, **not** the provider’s account allowance or a promise of how many more turns fit.
- **Estimated composition:** A *separate* normalized bar and rough token estimates for the categories Hermes returns, such as system prompt, tool definitions, rules, skills, MCP, subagent definitions, memory, and conversation. The rough category figures are not measured shares of the occupancy meter and should not be added to infer an exact used-token total. Categories are shown only when a breakdown with usable category values is available. `show_estimated_composition` defaults to **true**. Set it to false to hide that bar, the category rows, and the note. Context occupancy, the model name, account bars, file statuses, and the footer meter stay visible.
- **Context files:** If the backend reports any, expand **Context files** to see each file’s name, load/skip status, and approximate **whole-file** token size. The size is estimated *before truncation* and is not that file’s contribution to current usage. Statuses can include loaded, truncated, flagged, blocked, shadowed, suppressed, empty, or unreadable; a newer unknown status is shown as unavailable. There is no disclosure when no files are reported. `context_file_paths` defaults to **filename only**: the menu shows the file name and does not put the parent path in the row text, title, or other accessible name. **hidden** omits the path element. **full path** is the explicit choice that shows the breakdown path in the row and its title, which was the previous display. Until settings have settled on that choice, the menu does not show a full path.
- **Plugin settings:** The icon-only gear at the **top right** of the Context popup opens **Capabilities → Plugins** and highlights the **Context Window Visualizer** row. Click the gear on that row to edit the provider switches, account refresh, context-file paths, and estimated composition. Hermes renders `type: str` with choices as a dropdown and `type: bool` as a checkbox. The popup button does not expand the settings form or change the profile selected in Capabilities. The Capabilities profile selector should name the open menu’s owning profile. If that chat is on a remote gateway or another profile, switch the selector to that profile. The package must be installed on the owning backend; otherwise the highlighted row has no settings gear.
- **Account limits:** When a settled breakdown is available, at least one of the four Hermes-provider switches is on, and account refresh is not **manual**, opening the menu calls `session.usage` once for the runtime session represented by that menu (the focused chat on older builds). The default **on menu open** does not call it again when the window gains focus. **on menu open and focus** does. **manual** does not call it on open or focus; the section says **Select Refresh to load account limits** instead of spinning or showing a zero balance. The menu displays the provider label and only valid remaining-percentage windows in Hermes’s `account_lines`, with any returned reset detail. These bars are **remaining provider allowance**, not context occupancy or absolute remaining tokens. A provider might report a weekly window but no shorter one; the plugin never fabricates a missing window, token balance, or quota. If that returned provider’s switch is off, the whole account section, including its label, is omitted. The context meter stays. If Hermes cannot provide the data, the menu reports that it is unavailable or that no windows were reported. Other text lines from `session.usage` are not rendered. Account rows drop when that menu’s owner changes, until the new owner’s read settles. On the older status-bar fallback, the menu follows the focused chat, so a focus switch drops those rows. Opening one pane’s menu does not clear account rows in another pane’s menu.
- **Cursor limits (Quota cache):** A separate, default-off section shows only validated percentage windows from the optional Quota plugin's cached Cursor entry on that pane's owning profile (the focused chat's profile on older builds). It is independent of the chat's model, Hermes account limits, and the context meter. The menu's **Refresh** button re-reads Quota's cache; it does not cause a Quota refresh or contact Cursor. See [Cursor via Quota cache](#cursor-via-quota-cache).

Send a first message to initialize a new chat if its context is unavailable. On the per-pane footer, a busy pane shows **Calculating...** and no percentage, and its popup waits instead of showing the last completed usage or the previous composition. The older status-bar fallback can still show the focused session’s streamed usage during a turn. In both cases the categorized breakdown waits until the turn finishes. **Refresh** re-reads the context breakdown, and, when at least one of the four Hermes-provider switches is on, it also re-reads Hermes account limits, including in **manual** mode. It re-reads the Cursor cache only when that switch is on. There is **no timed background poll**. Reopening the menu can re-query context. With the default **on menu open**, window focus does not re-query `session.usage`. **on menu open and focus** does, while the menu is mounted. Focus does not re-query Cursor. Relevant session events reset cached context and account reads for that session. A Hermes account-limit lookup may cause Hermes to contact that chat’s provider account endpoint; it does **not** send a model prompt. The Cursor cache read itself does not contact Cursor. All four Hermes-provider switches off skips `session.usage` even on **Refresh**.

The backend’s context-file manifest was added in [#91272](https://github.com/NousResearch/hermes-agent/pull/91272) and its built-in presentation proposed in [#126219](https://github.com/NousResearch/hermes-agent/pull/126219).

## Data sources and provider support

This plugin has no provider credentials of its own. It uses two Hermes session RPCs for the pane being viewed (the focused chat, on the older status-bar fallback), and—only with the Cursor switch enabled—a cached CLI read from the optional Quota plugin. The per-pane footer does not read the window-wide focused usage while painting a pane. During a turn it waits. The status-bar fallback can still use Desktop’s streamed focused usage.

| Display | Hermes source | Provider coverage |
| --- | --- | --- |
| Context occupancy, model, estimated composition, and context files | `session.context_breakdown` for that pane. Idle footer may show that pane’s last completed usage until the breakdown is ready. Status-bar fallback: `focusedUsage` during a turn | Provider-neutral when the backend reports a usable model context window. |
| Account-limit bars | `session.usage` → `account_lines` | Any provider for which Hermes returns a percentage-based allowance window in its account-usage response. |
| Cursor allowance bars (opt-in) | `cli.exec` → `quota status --json --cached` → `providers.cursor.windows` | Only when Quota is installed and has a fresh Cursor cache entry on that menu's owning profile. Other cached provider data is discarded before React Query storage. |

In the supported Hermes backend, built-in account-usage fetchers cover **OpenAI Codex**, **Anthropic**, and **OpenRouter**. Provider profiles can also implement Hermes's `fetch_account_usage` hook. This plugin renders their reported percentage windows without maintaining a separate provider list. OpenRouter may report only a credit balance; that detail is **not** a percentage window and is not shown here. Similarly, a provider or account with no reported windows gets no fabricated bar. Provider-reported percentages and reset times are account allowances, not remaining context tokens.

The context display has been exercised locally with an OpenAI chat. The Quota CLI cache schema was checked locally without recording personal usage values; Cursor rendering tests use synthetic RPC responses. Live end-to-end Desktop interaction and the other provider account-limit paths have not been verified by this project.

## Provider visibility

Five booleans in `plugin.yaml` control provider visibility. The four Hermes-provider switches default to true; the independent Cursor-via-Quota switch defaults to **false**. They do not change the context meter, choose a model/provider for the chat, or fill in missing windows. Three more settings control account refresh, context-file paths, and estimated composition. They are scoped to that menu's chat-owning profile.

| Switch | Effect |
| --- | --- |
| `show_openai_codex` | Show Hermes account limits when the returned provider id is `openai-codex`. |
| `show_anthropic` | Show Hermes account limits when the returned provider id is `anthropic`. |
| `show_openrouter` | Show Hermes account limits when the returned provider id is `openrouter`. |
| `show_other` | Show Hermes account limits for any other id **except exact `cursor`**, including `nous` and custom `fetch_account_usage` providers. |
| `show_cursor` | Show a **separate** Cursor cache section; also control visibility if Hermes itself returns exact provider id `cursor` in a `session.usage` response already requested for that menu’s chat. This switch does not cause another `session.usage` request. Default: false. |
| `account_refresh_mode` | `manual`, `on menu open` (default), or `on menu open and focus`. See [Account limits](#reading-the-display) above. A missing or older schema uses **on menu open**. A value outside those three fails closed: no automatic `session.usage` call. |
| `context_file_paths` | `hidden`, `filename only` (default), or `full path`. A missing or older schema uses **filename only**. Any other supplied value, a settings error, or settings that are still loading omit the full path. |
| `show_estimated_composition` | Show the estimated composition block. Default: true. `false` hides only that block. |

Hermes may render `Provider: <id> (<plan>)`. The plan suffix is ignored; the id is compared exactly. An id that only contains one of those names stays on `show_other`; exact `cursor` uses `show_cursor`. When all **four Hermes-provider switches** are off, the menu does not call `session.usage`, even when `show_cursor` is on. When only one of those four is disabled and another remains enabled, `session.usage` still queries the chat represented by that menu before hiding that bar. While settings load or the settings read fails closed, it does not query either source. If `plugins.manage` is unknown or the package has no schema, the four existing account switches retain their on fallback, but **Cursor cache display stays off**.

The values live at `plugins.entries.context-window-visualizer.settings.<key>` on the Hermes home of the profile that owns the chat. The provider switches and `show_estimated_composition` are booleans. The two display choices are strings and must be one of the manifest choices. Run the command on that machine. For a non-default profile, prefix `hermes -p <profile>`. Quote any value that contains a space.

```sh
hermes config get plugins.entries.context-window-visualizer.settings.show_openai_codex
hermes config set plugins.entries.context-window-visualizer.settings.show_openai_codex false
hermes config set plugins.entries.context-window-visualizer.settings.show_anthropic true
hermes config set plugins.entries.context-window-visualizer.settings.show_cursor true
hermes config unset plugins.entries.context-window-visualizer.settings.show_other
hermes config set plugins.entries.context-window-visualizer.settings.account_refresh_mode "on menu open"
hermes config set plugins.entries.context-window-visualizer.settings.account_refresh_mode "on menu open and focus"
hermes config set plugins.entries.context-window-visualizer.settings.account_refresh_mode manual
hermes config set plugins.entries.context-window-visualizer.settings.context_file_paths "filename only"
hermes config set plugins.entries.context-window-visualizer.settings.context_file_paths hidden
hermes config set plugins.entries.context-window-visualizer.settings.context_file_paths "full path"
hermes config set plugins.entries.context-window-visualizer.settings.show_estimated_composition false
```

`false`, `no`, and `off` store false. `true`, `yes`, and `on` store true. `unset` removes the stored override. `get` prints only an explicitly stored value. An unset or missing key prints `Config key not set`. Desktop applies the manifest default when unset: true for the first four provider switches, **false for Cursor**, **on menu open**, **filename only**, and **true** for estimated composition.

On a Git or CLI install of the unified package, Desktop shows the same switches:

1. Open **Capabilities → Plugins** for the profile that owns the chat. The icon-only gear at the **top right** of the **Context** popup jumps to that tab and highlights this plugin’s row. It does not expand the form, and it leaves the Capabilities profile selector unchanged. That selector should name the open menu’s owning profile. If that chat is on a remote gateway or another profile, change the selector to that profile so the highlighted row is the package on that backend.
2. On the highlighted **Context Window Visualizer** row, click the gear.
3. Four Hermes-provider switches are on by default: OpenAI Codex, Anthropic, OpenRouter, and other providers. **Cursor (via Quota cache)** is off by default; turn it on to display the independent Cursor section. **Account refresh** defaults to **on menu open**. **Context-file paths** defaults to **filename only**. **Estimated composition** defaults to on.
4. Turn one provider switch off, then reopen the **Context** menu on a chat whose `session.usage` provider matches that switch. The same form is where the dropdowns and the composition checkbox are edited. The popup gear only navigates here.

The occupancy bar remains. That provider’s account limits do not. Another provider’s limits still appear. With one of the four Hermes switches off and any other still on, reopening the menu still calls `session.usage` for the chat represented by that menu before hiding that bar. On the older status-bar fallback, that chat is the focused chat. All four off skips that call, including when only Cursor is on. Reload desktop plugins after installing the package so the Desktop half matches it.

The **settings gear on the Capabilities → Plugins row** exists only when that backend has this package on disk and `plugins.manage` list returns a `settings_schema`. That list sends the profile’s complete plugin inventory over the existing authenticated Hermes gateway connection into the renderer. The inventory may include other plugins’ install paths and non-secret settings; secret fields are an env name and a presence flag. Before caching, this plugin retains only its five provider booleans, the account-refresh choice, the context-file path choice, and the composition boolean. It does not log or persist other rows. It does not add a direct credential read, third-party endpoint, telemetry, or auth storage. A manual copy of `plugin.js` into the Desktop loader has no `plugin.yaml`, so that backend has no schema, the **row's** settings gear is not rendered, and CLI keys written without the package are invisible to the list. The **popup's** gear remains a navigation shortcut. With no schema the menu uses the display defaults: account limits stay available on menu open, paths stay **filename only** (never a full path), estimated composition stays visible, and Cursor stays off. This plugin does not add a second settings form.

A remote chat’s settings and `session.usage` both come from the owning backend. Install the unified package on that backend’s profile, not only on the Desktop machine. The Desktop half stays app-level and still has to be enabled locally.

## Cursor via Quota cache

Cursor has no documented public personal-allowance API. This plugin **does not** read Cursor login data, call an undocumented Cursor endpoint, or refresh quotas. Instead, after `show_cursor` is explicitly enabled it asks Hermes to run the optional [Quota plugin](https://github.com/rarf/hermes-quota-plugin)'s `quota status --json --cached` command on that menu's chat-owning backend/profile, only while the Context menu is open. The read-only `--cached` path uses Quota's existing snapshot. The popup shows at most six valid Cursor percentage windows and their reset timestamps, separately from model context and the provider allowance of the chat represented by that menu (the focused chat on the older status-bar fallback). It shows stale/unavailable/empty status instead of inventing zero or current data. The cache must be no older than 30 minutes.

Install and enable Quota **on the backend/profile that owns the chat represented by the menu**, and let Quota manage its own cache refresh. Quota's [install instructions](https://github.com/rarf/hermes-quota-plugin#install) call for a complete Desktop restart after installing its backend and a first `hermes quota refresh` for each profile. Quota itself may read a local Cursor login and call an **undocumented Cursor endpoint** when *it* refreshes; review its separate source, settings, and privacy policy before enabling that behavior. This checkbox controls only display here—it does **not** opt Quota into or out of credential use, network access, or scheduled refresh. No Quota installation is needed when the checkbox stays off. To populate a missing or stale cache, use Quota's own refresh control, then reopen Context; the Context menu's **Refresh** only re-reads the snapshot. If Quota is missing, disabled, incompatible, or its cached Cursor entry is unavailable, the popup reports unavailability rather than a percentage.

Cursor reset timestamps appear as a readable date and time in your Desktop's local time zone, with the time-zone abbreviation or offset shown. The cached timestamp remains the source; the display does not calculate a new reset time.

## Focused chats, profiles, and remote gateways

The Desktop contribution is **app-level**: installing the Desktop UI once in the Desktop loader makes the meter available as you switch profiles, tabs, split chat tiles, or registered gateways. It does not install a plugin on each backend or aggregate usage across accounts. Where Desktop exports and mounts `CHAT_PANE_FOOTER_AREA`, each **visible** pane shows its own meter and popup, including a pane that does not have focus. Hidden keep-alive tabs are not mounted, so they are not queried. A single visible pane has one meter. On an older build, the status-bar chip follows the **currently focused chat tile**, not necessarily the active gateway’s home profile or the last chat that sent a turn.

For RPC reads, it resolves that pane’s `{ connectionId, profile }` owner (the focused session’s owner, on the older fallback) through the Desktop SDK’s asynchronous `profileRoutes()` and calls `requestProfile(...)` on the unique matching route. If that owner or route is missing or ambiguous, it shows an unavailable state rather than querying a different connection, and it does not read settings or account limits on a guessed route. A remote chat’s model, context files, account limits, and these settings come from **that remote backend** and its session/provider credential. The breakdown can include remote paths; the menu shows a full path only when that profile’s setting is **full path**. The unified package must be installed on the owning backend’s profile. The Desktop plugin itself remains installed on your Desktop machine. A remote backend must support the relevant session RPCs and its connection must be available.

## Privacy and safety

- While the Context menu is open, `plugins.manage` list sends the owning profile’s complete plugin inventory over the existing authenticated Hermes gateway connection into the renderer. That inventory may include other plugins’ install paths and non-secret settings. Secret fields on the list are an env name and a presence flag. Before caching, this plugin retains only its five provider booleans, account-refresh choice, context-file path choice, and composition boolean for that menu's owning profile. It does not log or persist other plugins’ rows, and it does not read the full config document. This package does not read credentials directly, contact a third-party endpoint, add telemetry, or store auth data.
- `session.context_breakdown` and `session.usage` use that same connection. Hermes’s backend may read instruction files for its context-file manifest, and it may call that menu’s chat provider account-usage endpoint when the chat is already eligible, at least one provider switch is enabled, and account refresh is not manual. The default **on menu open** reads account limits when the menu mounts and does not read them again on window focus. **on menu open and focus** also reads on focus. **manual** waits for **Refresh**. An idle, visible pane with a runtime session and one resolved owner route requests `session.context_breakdown` while its meter is mounted, even when its popup is closed; a busy or unresolved pane does not start that request. Full paths in that breakdown cross the authenticated gateway and remain in the in-memory query for as long as the pane is mounted. When only one switch is disabled and any other remains enabled, `session.usage` still queries the provider of the chat represented by that menu before the menu hides its bar. On the older status-bar fallback, that chat is the focused chat. All four off skips the call, including on **Refresh**. Hiding one provider does not look up a different provider. These reads are not a new token read and do not include the provider credential. There is no timer and no extra provider request.
- **Only if Cursor is enabled:** `cli.exec` starts the installed Quota CLI subprocess on the menu’s owning backend/profile while that menu is open, with `--cached`. Quota's **entire cached provider JSON**, potentially including other providers' balances, plan names, and details, briefly crosses the authenticated gateway connection into the Desktop renderer. This plugin parses it there and keeps only validated Cursor window labels, percentages, and reset times in its menu-only, in-memory query cache; the raw payload is not logged, stored in plugin storage, or persisted by this plugin. The CLI returns a snapshot; this package never calls `quota refresh` or reads Cursor's login. Quota's **own** separately configured refresh may read a local credential and contact Cursor's undocumented endpoint. The checkbox does not stop that other plugin.
- Expanding **Context files** shows file names by default. **full path** is an explicit opt-in and can show a remote path in the Desktop window, including its title tooltip. **hidden** and **filename only** reduce on-screen DOM exposure, including during screen sharing. They do not reduce transport or renderer-memory exposure: the backend still sends the full path inside `session.context_breakdown`, and that payload stays in the in-memory query while the pane is mounted, even when the popup is closed. The menu does not show file contents. A settings load, settings error, malformed path value, or Desktop-only copy with no schema does not show a full path.
- This code has no telemetry, stored credentials, persistent plugin storage, background process, Python backend, agent tools, hooks, or middleware. The opt-in `cli.exec` RPC **does** run the Quota CLI in a subprocess; it passes a fixed argv array whose profile is `route.targetProfile`, not a shell command string. SDK queries use Desktop’s in-memory React Query cache. Account-limit and sanitized Cursor rows are not kept in that cache after the Context menu unmounts. It does not change model context, override Hermes internals, or update itself.
- As with any Desktop plugin, installed JavaScript runs in the Desktop renderer with the app’s authority: SDK access is **not a sandbox**. Only install source you trust. A custom Git installation has not undergone catalog review. The notes above describe what this package requests and retains. They are not a privacy guarantee about Hermes, other plugins, or the renderer process.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No **Context** chip | Confirm the Desktop plugin is enabled in **Capabilities → Plugins** and the local file is at the matching plugin-ID path. Per-pane meters need a Desktop build that exports and mounts `CHAT_PANE_FOOTER_AREA`. That slot is a local, uncommitted customization, not a stock Desktop upgrade. On stock Desktop, show the status-bar item via **Show in status bar**. Then **Cmd/Ctrl+K → Reload desktop plugins**. A load-error toast gives the reason. |
| Dash, **Open a chat**, or **Send a message** | Focus a chat and send a first turn. Until a valid context maximum is returned, the plugin does not invent a percentage. |
| **Waiting for the response to finish before fetching the latest details** | The settled breakdown is paused during that pane’s turn. The per-pane meter shows **Calculating...** without a percentage until the turn finishes. The older status-bar fallback can still show streamed occupancy for the focused chat. Reopen the menu after the turn. |
| **Connection is unavailable** or context could not load | Check that the gateway/profile for the pane whose menu is open is connected and its backend is compatible. On the older status-bar fallback, that pane is the focused chat. A missing or ambiguous owner route fails closed. Try **Refresh** once available. |
| Account limits empty or unavailable | `session.usage` may have no reportable windows for this provider/session, or its lookup may fail. This is not a zero balance. Try **Refresh**; check the backend’s provider/account-usage support and connection. A draft without an initialized chat does not trigger an account lookup. |
| Account limits absent while **Context** remains | The owning profile may have that provider’s switch off, or all four switches off. See [Provider visibility](#provider-visibility). A manual `plugin.js` copy cannot show the **settings gear on the Capabilities row**; the popup gear only navigates there. |
| Cursor section absent | `show_cursor` defaults off. Install the unified package on the backend/profile that owns the pane whose menu is open, open its gear in **Capabilities → Plugins**, and enable **Cursor (via Quota cache)**. On the older status-bar fallback, that pane is the focused chat. A manual Desktop-only copy does not enable it. |
| Cursor section says stale, empty, or unavailable | Install/enable Quota on that same backend/profile and use **Quota's own refresh** to populate its Cursor cache. A missing credential, unsupported Quota version, unavailable backend, or cache older than 30 minutes is not zero allowance. The Context menu's **Refresh** only rereads the cache. |
| Categories do not add up to occupancy | Expected: the composition figures are rough estimates on their own scale; occupancy can be provider-anchored. Full-file sizes are before truncation. |

For loader errors, see the [Desktop Plugin SDK troubleshooting guide](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk). The app’s own Context Usage control remains available independently.

## To do

- [ ] Implement and test the plugin on Windows.

## Development and compatibility

Source is `desktop/plugin.js`: plain ESM using only `@hermes/plugin-sdk`, `react`, and `react/jsx-runtime`. `plugin.yaml` declares the compatibility floor and no agent-facing tools, hooks, middleware, or required environment variables. Quota is an **optional** runtime dependency for the default-off Cursor display, not required for the context meter. The [Desktop Plugin SDK](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk) describes the public surface. Behavior also depends on the backend providing `session.context_breakdown`, `session.usage`, `cli.exec` for Cursor, and the Desktop build exposing session-owner routing; the version floor alone is not a guarantee for an arbitrarily mixed Desktop/backend installation. Per-pane footer placement also requires that build to export and mount `CHAT_PANE_FOOTER_AREA`. That core patch is a local, uncommitted customization of Hermes Desktop, not released upstream. Installing this plugin from Git, or updating stock Desktop, does not provide it.

Run the syntax check and rendering tests from the repository root. Tests use a Hermes checkout with its workspace Node dependencies installed; they mock SDK/RPC data and do not call a provider:

```sh
node --check desktop/plugin.js
HERMES_DESKTOP_ROOT=/path/to/hermes-agent/apps/desktop node --experimental-vm-modules --test tests/plugin.test.mjs
```

For a Hermes installation with the validation command available, validate this **trusted local checkout** from its parent directory:

```sh
hermes plugins validate /path/to/hermes-context-window-visualizer --install-deps
```

The repository’s [GitHub Actions workflow](https://github.com/zufpi/hermes-context-window-visualizer/actions/workflows/test.yml) runs syntax, rendering, and plugin-validation checks on push/PR. It checks out Hermes at the configured `v2026.9.24` tag, an older SDK, and uses a SHA-pinned validation action; inspect the workflow’s latest run for its **actual** result. That pin proves the status-bar fallback, not live per-pane UI. Rendering tests use a mocked SDK and synthetic RPC responses, not live provider accounts and not the Desktop GUI. There is no live GUI verification in this repository: local visual behavior comes from user reports, not independent automation. They do not show that a real chat pane painted the meter.

**Catalog status:** This is a standalone community repository, **not** an approved or listed Hermes catalog plugin. Catalog submission, review, and SHA-pinned distribution are separate processes; see [Hermes’s catalog rules](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins/catalog-submission). No catalog submission is implied here.

## License

MIT; see [LICENSE](LICENSE).
