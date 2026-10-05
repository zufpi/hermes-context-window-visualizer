# Context Window Visualizer for Hermes Desktop

See how full the **focused chat’s model context window** is in the Hermes Desktop status bar. Open the **Context** menu for an estimated breakdown of what occupies it, optional context-file details, and any account-limit windows Hermes reports for that chat. This is a small, Desktop-only community plugin—not a quota manager or a replacement for Hermes’s built-in Context Usage control.

## Contents

- [Install](#install)
- [Reading the display](#reading-the-display)
- [Data sources and provider support](#data-sources-and-provider-support)
- [Focused chats, profiles, and remote gateways](#focused-chats-profiles-and-remote-gateways)
- [Privacy and safety](#privacy-and-safety)
- [Troubleshooting](#troubleshooting)
- [To do](#to-do)
- [Development and compatibility](#development-and-compatibility)

## Install

**Requirements:** Hermes Desktop with a compatible backend and Desktop Plugin SDK. The manifest declares `requires_hermes: ">=0.21.5"`; older backends may not provide `session.context_breakdown`. The plugin does not run in the CLI, TUI, or web dashboard. No Python package, API key, build step, or separate service is required for the plugin.

### Install from Git

From Hermes Desktop:

1. In Hermes Desktop, open **Capabilities → Plugins → Install from Git**.
2. Enter `https://github.com/zufpi/hermes-context-window-visualizer` and select the **Desktop UI** component. Review the source and destination in the confirmation screen before installing.
3. Check that **Context Window Visualizer** is enabled in the **Desktop** column of **Capabilities → Plugins**. Its **Context** item appears in the bottom status bar; right-click the bar and use **Show in status bar** if the item is hidden.

A Git install is a custom-source install, **not a reviewed catalog install or an immutable catalog pin**. Inspect the code you install. If the menu does not appear after installation, use **Cmd/Ctrl+K → Reload desktop plugins**. A plugin that you previously disabled remains disabled until you re-enable it.

### Install with the Hermes CLI

On the machine running Hermes Desktop, use the repository URL (the plugin is not in the catalog, so its name alone will not resolve):

```sh
hermes plugins install https://github.com/zufpi/hermes-context-window-visualizer --enable
```

This installs the package under `$HERMES_HOME/plugins/context-window-visualizer`. The CLI enables the package; the **Desktop UI** is a separate switch. In Desktop, run **Cmd/Ctrl+K → Reload desktop plugins**, then enable **Context Window Visualizer** in the Desktop column of **Capabilities → Plugins** if it is off. No gateway restart is needed for this Desktop-only plugin, even if the CLI prints its generic restart reminder.

If you previously copied `plugin.js` into `$HERMES_HOME/desktop-plugins/context-window-visualizer/` by hand, move that folder **outside** `desktop-plugins/` before using the CLI-managed install. Desktop deliberately preserves a manual copy instead of overwriting it with a package copy; otherwise you may keep running the old file. For remote gateways, install the Desktop half on the machine running the app, not solely on the remote backend.

To validate the installed package, run `hermes plugins validate "${HERMES_HOME:-$HOME/.hermes}/plugins/context-window-visualizer" --install-deps`. `hermes plugins doctor` currently expects a Python `__init__.py` and reports an error for this Desktop-only package; it is not the validation command for this case.

### Local developer install

From a checkout of this repository on macOS or Linux, copy the single uncompiled ESM file to the Desktop plugin loader’s directory:

```sh
: "${HERMES_HOME:=$HOME/.hermes}"
mkdir -p "$HERMES_HOME/desktop-plugins/context-window-visualizer"
cp desktop/plugin.js "$HERMES_HOME/desktop-plugins/context-window-visualizer/plugin.js"
```

Run these commands from the repository root. If you use a custom Hermes home, set `HERMES_HOME` to the home **used by Desktop** before running them. On Windows, copy the file to the equivalent `desktop-plugins/context-window-visualizer/plugin.js` directory under Desktop’s Hermes home. The directory name must match the exported plugin ID. The loader watches for saves and normally hot-reloads; **Reload desktop plugins** in the command palette is the fallback. For local development, repeat the copy after editing the source, or edit the installed copy directly. This manual copy is separate from Git installation and does not install a backend component.

To remove a manual copy, disable it in **Capabilities → Plugins** and remove its `desktop-plugins/context-window-visualizer` directory from Desktop’s Hermes home. Use Hermes’s Plugins UI to manage a Git-installed copy instead.

## Reading the display

- **Status bar:** **Context** shows a bar and a rounded percentage of the focused session’s used context against its reported model window. A dash means no usable window is available yet; it is not zero usage. The occupancy is capped at the displayed window size. A leading `~` marks an estimated occupancy.
- **Context menu:** Click the chip for the backend-reported model name (when available), compact used/max token figures, and a larger occupancy bar. Hermes’s `session.context_breakdown` supplies the settled snapshot. When provider-anchored usage is available, Hermes uses it; otherwise occupancy is estimated and labeled **Estimated occupancy**. These are context-window figures, **not** the provider’s account allowance or a promise of how many more turns fit.
- **Estimated composition:** A *separate* normalized bar and rough token estimates for the categories Hermes returns, such as system prompt, tool definitions, rules, skills, MCP, subagent definitions, memory, and conversation. The rough category figures are not measured shares of the occupancy meter and should not be added to infer an exact used-token total. Categories are shown only when a breakdown with usable category values is available.
- **Context files:** If the backend reports any, expand **Context files** to see each file’s label, path, load/skip status, and approximate **whole-file** token size. The size is estimated *before truncation* and is not that file’s contribution to current usage. Statuses can include loaded, truncated, flagged, blocked, shadowed, suppressed, empty, or unreadable; a newer unknown status is shown as unavailable. There is no disclosure when no files are reported.
- **Account limits:** When a settled breakdown is available, opening the menu calls `session.usage` for the same focused runtime session. The menu displays the provider label and only valid remaining-percentage windows in Hermes’s `account_lines`, with any returned reset detail. These bars are **remaining provider allowance**, not context occupancy or absolute remaining tokens. A provider might report a weekly window but no shorter one; the plugin never fabricates a missing window, token balance, or quota. If Hermes cannot provide the data, the menu reports that it is unavailable or that no windows were reported. Other text lines from `session.usage` are not rendered.

Send a first message to initialize a new chat if its context is unavailable. While a turn is in progress, the chip and menu may show the focused session’s streamed usage instead of a stale breakdown; the categorized breakdown waits until the turn finishes. **Refresh** re-reads the context breakdown and, when eligible, account limits. There is **no timed background poll**: reopening the menu can re-query limits, window focus can re-query while the menu is mounted, and relevant session events reset cached reads. An account-limit lookup may cause Hermes to contact the provider’s account endpoint; it does **not** send a model prompt.

The backend’s context-file manifest was added in [#91272](https://github.com/NousResearch/hermes-agent/pull/91272) and its built-in presentation proposed in [#126219](https://github.com/NousResearch/hermes-agent/pull/126219).

## Data sources and provider support

This plugin has no provider-specific integration or credentials of its own. It uses two Hermes session RPCs for the focused chat, plus Desktop's live usage state during a turn:

| Display | Hermes source | Provider coverage |
| --- | --- | --- |
| Context occupancy, model, estimated composition, and context files | `session.context_breakdown`; `focusedUsage` during a turn | Provider-neutral when the backend reports a usable model context window. |
| Account-limit bars | `session.usage` → `account_lines` | Any provider for which Hermes returns a percentage-based allowance window in its account-usage response. |

In the supported Hermes backend, built-in account-usage fetchers cover **OpenAI Codex**, **Anthropic**, and **OpenRouter**. Provider profiles can also implement Hermes's `fetch_account_usage` hook. This plugin renders their reported percentage windows without maintaining a separate provider list. OpenRouter may report only a credit balance; that detail is **not** a percentage window and is not shown here. Similarly, a provider or account with no reported windows gets no fabricated bar. Provider-reported percentages and reset times are account allowances, not remaining context tokens.

The context display has been exercised locally with an OpenAI chat; the other provider account-limit paths have not been tested end to end by this project. The rendering tests use synthetic RPC responses, not live provider accounts.

## Focused chats, profiles, and remote gateways

The Desktop contribution is **app-level**: installing the Desktop UI once in the Desktop loader makes the chip available as you switch profiles, tabs, split chat tiles, or registered gateways. It does not install a plugin on each backend or aggregate usage across accounts. What it displays belongs to the **currently focused chat tile**, not necessarily the active gateway’s home profile or the last chat that sent a turn.

For RPC reads, it resolves the focused session’s `{ connectionId, profile }` owner through the Desktop SDK’s asynchronous `profileRoutes()` and calls `requestProfile(...)` on the unique matching route. If that owner or route is missing or ambiguous, it shows an unavailable state rather than querying a different connection. A remote chat’s model, context files, and account limits come from **that remote backend** and its session/provider credential; file paths in the menu may therefore be remote paths. The Desktop plugin itself remains installed on your Desktop machine. A remote backend must support the relevant session RPCs and its connection must be available.

## Privacy and safety

- The plugin uses the existing authenticated Hermes connection for `session.context_breakdown` and `session.usage`. Hermes’s backend may read instruction files for its context-file manifest and may call the configured provider’s account-usage endpoint. The plugin makes no direct third-party requests and never receives the provider credential.
- Expanding **Context files** shows complete file **paths** in your Desktop window, including paths from a remote backend. It does not show file contents. Take care with screen sharing or screenshots.
- This code has no telemetry, stored credentials, persistent plugin storage, shell execution, background process, Python backend, agent tools, hooks, or middleware. Its SDK queries use Desktop’s in-memory React Query cache. It does not change model context, override Hermes internals, or update itself.
- As with any Desktop plugin, installed JavaScript runs in the Desktop renderer with the app’s authority: SDK access is **not a sandbox**. Only install source you trust. A custom Git installation has not undergone catalog review.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No **Context** chip | Confirm the Desktop plugin is enabled in **Capabilities → Plugins**, the status-bar item is visible via **Show in status bar**, and the local file is at the matching plugin-ID path. Try **Cmd/Ctrl+K → Reload desktop plugins**. A load-error toast gives the reason. |
| Dash, **Open a chat**, or **Send a message** | Focus a chat and send a first turn. Until a valid context maximum is returned, the plugin does not invent a percentage. |
| **Waiting for this turn to finish** | The settled breakdown is paused during the focused chat’s turn; streamed occupancy can still appear. Reopen the menu after the turn. |
| **Connection is unavailable** or context could not load | Check that the focused chat’s gateway/profile is connected and its backend is compatible. A missing or ambiguous owner route fails closed. Try **Refresh** once available. |
| Account limits empty or unavailable | `session.usage` may have no reportable windows for this provider/session, or its lookup may fail. This is not a zero balance. Try **Refresh**; check the backend’s provider/account-usage support and connection. A draft without an initialized chat does not trigger an account lookup. |
| Categories do not add up to occupancy | Expected: the composition figures are rough estimates on their own scale; occupancy can be provider-anchored. Full-file sizes are before truncation. |

For loader errors, see the [Desktop Plugin SDK troubleshooting guide](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk). The app’s own Context Usage control remains available independently.

## To do

- [ ] Implement and test the plugin on Windows.

## Development and compatibility

Source is `desktop/plugin.js`: plain ESM using only `@hermes/plugin-sdk`, `react`, and `react/jsx-runtime`. `plugin.yaml` declares the compatibility floor and no agent-facing tools, hooks, middleware, or required environment variables. The [Desktop Plugin SDK](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk) describes the public surface. Behavior also depends on the backend providing `session.context_breakdown`, `session.usage`, and the Desktop build exposing focused-session owner routing; the version floor alone is not a guarantee for an arbitrarily mixed Desktop/backend installation.

Run the syntax check and rendering tests from the repository root. Tests use a Hermes checkout with its workspace Node dependencies installed; they mock SDK/RPC data and do not call a provider:

```sh
node --check desktop/plugin.js
HERMES_DESKTOP_ROOT=/path/to/hermes-agent/apps/desktop node --experimental-vm-modules --test tests/plugin.test.mjs
```

For a Hermes installation with the validation command available, validate this **trusted local checkout** from its parent directory:

```sh
hermes plugins validate /path/to/hermes-context-window-visualizer --install-deps
```

The repository’s GitHub Actions workflow is configured to run syntax, rendering, and plugin-validation checks against pinned Hermes sources on push/PR; that configuration is **not evidence of a completed CI run**. Test actual Desktop UI behavior, especially focus switching and remote routes, on a compatible build—mock rendering tests are not an end-to-end provider test.

**Catalog status:** This is a standalone community repository, **not** an approved or listed Hermes catalog plugin. Catalog submission, review, and SHA-pinned distribution are separate processes; see [Hermes’s catalog rules](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins/catalog-submission). No catalog submission is implied here.

## License

MIT; see [LICENSE](LICENSE).
