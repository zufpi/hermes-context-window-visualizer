# Provider visibility settings

**Historical first-phase plan.** The four-switch scope and Cursor deferral below describe the original implementation decision, not the current feature set. The plugin now also offers a default-off `show_cursor` switch backed by the optional Quota plugin's cached data, plus an icon-only gear in the popup header. See the [current README](../README.md#cursor-via-quota-cache) for the implementation, consent boundary, and privacy disclosures. No catalog submission is implied.

Implementation plan for the standalone Context Window Visualizer. This phase adds four reversible visibility switches for the account-limit section. It does not change the context meter, Hermes core, or Cursor usage.

## Product scope

The status-bar **Context** meter stays provider-neutral. It keeps reading the focused chat's context window only.

The account-limit section stays a display filter on the one `session.usage` result Hermes already returns for that same focused chat. The plugin does not choose a provider, call a second provider, or fill in missing windows, token balances, or reset times.

Scope is the focused chat and its owning `{ connectionId, profile }` route. A setting edited on another profile or connection does not apply. An ambiguous or missing owner still fails closed: no breakdown read and no usage read on a guessed route.

Cursor usage was deferred in this phase. See [Cursor (original deferral)](#cursor-original-deferral) and the current README for the later opt-in implementation.

## Settings

Declare these keys in `plugin.yaml` `config_schema`. Each is `type: bool`, `default: true`, with a short label and description. Absent keys mean true.

| Key | Hides the account section when the returned provider id is |
| --- | --- |
| `show_openai_codex` | `openai-codex` |
| `show_anthropic` | `anthropic` |
| `show_openrouter` | `openrouter` |
| `show_other` | any other id, including custom `fetch_account_usage` providers and `nous` |

Match the provider id only. Hermes renders `Provider: <id>` or `Provider: <id> (<plan>)`. Strip one trailing ` (<plan>)` suffix, then compare the id as an exact string. `openai-codex (Pro)` is `show_openai_codex`. A custom id is never promoted into the three built-in buckets, and a model name on the breakdown is never used as a provider id.

No `show_account_limits` key. The four booleans already cover the useful states, including "show nothing" when all four are false. A fifth switch can disagree with them and does not describe a different data source.

Stored at `plugins.entries.context-window-visualizer.settings.<key>` on the Hermes home of the profile that owns the chat. The Desktop gear and `hermes config set` use that same writer. Values are ordinary booleans, not secrets.

## What the user sees

Context occupancy, model name, composition, and context files do not change when a switch is off.

When the returned provider's switch is false, omit the whole account-limit section, including its provider label. Do not replace it with an error or an empty-state line. When the switch is true, keep today's parser: only valid `N% remaining (M% used)` windows, no invented shorter window, no credit-balance bar.

A payload with no provider id is not `show_other`. Any no-id payload keeps the existing empty, error, or unavailable account status even when `show_other` is false. All four switches off still skips `session.usage` and omits the section.

### CLI

Run the command on the machine whose Hermes home owns the chat. For a non-default profile, prefix `hermes -p <profile>`.

```sh
hermes config get plugins.entries.context-window-visualizer.settings.show_openai_codex
hermes config set plugins.entries.context-window-visualizer.settings.show_openai_codex false
hermes config set plugins.entries.context-window-visualizer.settings.show_anthropic true
hermes config unset plugins.entries.context-window-visualizer.settings.show_other
```

`false`, `no`, and `off` store a boolean false. `true`, `yes`, and `on` store true. `unset` removes the stored override. `get` prints only an explicitly stored `true` or `false`. An unset or missing key prints `Config key not set`. Desktop still applies the manifest default (true) when the key is unset.

The gateway `config.get` RPC is a different, fixed key list. It rejects this path. The plugin must not call it, and must not request the full config document.

### Desktop

For a Git or CLI install of the unified package on the owning backend:

1. Open **Capabilities → Plugins** for the profile that owns the chat.
2. On **Context Window Visualizer**, open the gear.
3. Four switches are on by default: OpenAI Codex, Anthropic, OpenRouter, and other providers.
4. Turn one off, then reopen the **Context** menu on a chat whose `session.usage` provider matches that switch.

The occupancy bar remains. That provider's account limits do not. Another provider's limits still appear. Reload desktop plugins after installing the package so the Desktop half matches the package.

## Sequence

1. Resolve the focused owner to one route, as today. Zero or several matches: stop. No settings read and no `session.usage`.
2. The context breakdown and the footer meter proceed as today. They do not wait on settings.
3. Only while the **Context** menu is mounted, and only on that same route, call `plugins.manage` `{ action: "list", profile: <owner profile> }`. Keep the four booleans from this plugin's row (`key` or `name` `context-window-visualizer`). Drop every other row inside the request function so they are not cached or rendered.
4. Decide the account request:
   - **Ready:** a boolean set for this route, and at least one switch is true. Call `session.usage` once, and only if the chat is already eligible (focused runtime session, unique route, settled breakdown whose `context_files` is an array, not mid-turn).
   - **All four false:** do not call `session.usage`.
   - **Settings still loading:** do not call `session.usage` yet.
   - **Settings unavailable:** the method is unknown (`-32601`), or the list succeeds but this package has no settings schema on that backend. Treat every switch as true and keep the existing eligible `session.usage` call.
   - **Fail closed:** timeout, any other settings error, a non-boolean stored value, or a payload that belongs to a different connection or profile. Do not call `session.usage`. Do not reuse another profile's booleans.
5. From the one usage payload, classify the provider id and apply that switch. If it is false, omit the section. If there is no provider id, keep the existing account status instead of applying `show_other`. Do not issue another usage call.

Refresh repeats the same decision. It does not poll in the background.

## Installation and the open issue

The gear exists only when the backend that serves **Capabilities → Plugins** has this package on disk and `plugins.manage` list returns a `settings_schema`. That is a normal Git or `hermes plugins install <git-url> --enable` install, followed by enabling the Desktop column. `hermes plugins validate <checkout> --install-deps` remains the package check. `hermes plugins doctor` still expects a Python `__init__.py` and is not the check for this Desktop-only package.

A remote chat's settings and `session.usage` both come from the owning backend. The unified package must be installed on that backend's profile, not only copied onto the Desktop machine. The Desktop half stays app-level and still has to be enabled locally.

**Open issue:** a manual copy of `plugin.js` into the Desktop loader directory cannot show this GUI. That copy has no `plugin.yaml`, so the backend has no schema and the gear is not rendered. CLI keys written without the package installed on that backend are also invisible to `plugins.manage`. This phase does not add an in-menu settings form or a second config channel. Manual-copy users keep today's always-visible account section (the settings-unavailable fallback) until they install the unified package on the owning backend.

No catalog submission.

## Cursor (original deferral)

Not in this original phase. A personal live Cursor allowance has no documented public API to call. The comparison point is a reference plugin that uses an undocumented, credential-bound endpoint. This plugin must not read tokens, copy that client, or ship a guessed URL or payload. A later opt-in implementation reads Quota's cache through its CLI and retains **only sanitized Cursor windows**; the full cache briefly reaches the renderer. It still does not read credentials or call Cursor directly. See the current README for its limits.

## Feature commit and rollback

Land this plan in its own commit. Land the feature in one later commit that can be reverted by itself:

- `plugin.yaml`: the four-key `config_schema`, and a version bump from `0.2.0` to `0.3.0`
- `desktop/plugin.js`: menu-only settings read, provider filter, and the account-request gate
- `tests/plugin.test.mjs`: the cases below
- `README.md`: the CLI, the gear, the manual-copy limitation, and the remote-package requirement

No Hermes core change, no installed-home edit, and no migration. Revert that commit to restore the previous behavior. Keys left in config are ignored by the reverted plugin. Remove them with `hermes config unset` on each of the four paths if you want the file clean.

## Acceptance tests

Extend the existing rendered-plugin tests. Keep using synthetic RPC data.

- Default and explicit true: Codex, Anthropic, and OpenRouter windows still render; the footer still shows occupancy; `session.usage` is issued once to the focused route.
- `show_openai_codex: false` with `Provider: openai-codex (Pro)` omits the account section and does not issue a second usage call. The occupancy bar remains. An Anthropic payload in the same session still renders.
- The Anthropic and OpenRouter flags behave the same way, each matching only its own id.
- `show_other: false` hides `nous` and a custom hook id, and still shows `openai-codex`.
- `show_other: false` with no provider id still shows the existing unavailable or empty account status, including a nonempty `account_lines` list that has no `Provider:` line. All four false still does not call `session.usage`.
- A provider id that merely contains one of the three names stays under `show_other`.
- All four false: the usage query is disabled even when the chat would otherwise be eligible.
- Settings in flight: no usage call yet. After a matching true result, one call.
- Unknown `plugins.manage` method: usage still runs when eligible, and windows still render.
- Successful list with no schema row for this plugin: same fallback.
- Timeout, non-boolean value, or a settings result keyed to another connection or profile: no usage call, no account section, footer occupancy still rendered from the focused breakdown.
- Ambiguous or missing route: no settings call and no usage call.
- A weekly-only payload still does not grow an hourly or token bar after filtering.
- Refresh does not call usage when the active decision is all-false or fail-closed.

## Privacy

The plugin still has no credential of its own. `session.usage` may cause Hermes to contact the provider account endpoint only when the chat is already eligible and this profile's settings leave at least one provider visible. Hiding every provider skips that call. Hiding one provider does not look up a different provider.

The settings read is the owning profile's `plugins.manage` list. Reduce it to this plugin's four booleans before caching. Do not log, display, or persist other plugins' rows. Do not read the full config document.

Context-file paths stay as they are today: visible in the menu, not sent anywhere by this plugin.

## Validation before the feature commit

From the repository root, syntax-check `desktop/plugin.js` and run `tests/plugin.test.mjs` with the desktop test root the README already documents. Validate the checkout with `hermes plugins validate`. On a Desktop build, confirm the gear on an installed package and confirm a manual `plugin.js` copy still has no gear. Do not use a live provider account for the automated tests.
