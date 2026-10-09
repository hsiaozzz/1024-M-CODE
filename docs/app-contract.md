# Application integration contract

This document describes the current frontend, game API and MCP gateway contract. The public application guide is [APP_GUIDE.md](APP_GUIDE.md); implementation limits and verification are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Shared data and identity

Frontend and API use `lib/types.ts`. All money in game profiles, missions, normalized products and quotes is an integer number of cents. The UI displays yuan; official menu prices are normalized from yuan while `calculate-price` monetary fields are cents. Nutritional values remain numeric kcal and grams, with unknown totals represented as `null`.

The timezone is `Asia/Shanghai`. There are exactly three persisted missions per profile and Beijing date: `breakfast`, `lunch`, `dinner`. IDs and seeds are deterministic from profile identity, date and slot. Updating a profile does not reroll today's already generated missions; a future date snapshots the new budget, preferences and nutrient targets. Profile budget limits are 500–100000 cents, calorieTarget 200–2500 and proteinTarget 0–100.

`GET /api/game/bootstrap` establishes a personal profile and a signed cookie `mc_user=<uuid>.<HMAC>`, with `HttpOnly`, `SameSite=Strict`, `Path=/`, a one-year lifetime and `Secure` on HTTPS. `lib/user.ts` validates the signature; the HMAC secret is stored in the gitignored data directory. Other personal endpoints require the bootstrap identity; shared challenge reads and evaluation are anonymous and grant no XP or transactions. Game POST and MCP routes check same-origin requests. This is browser identity, not cross-device account authentication.

Default mode is `demo`; an explicit personal Token connection selects `live`. Tokens and SDK clients exist only in per-user server memory. SQLite stores profiles, missions, quotes, completions, snapshots, rooms, simulated account state, tool observations and confirmation state. Data is in `MCMISSIONS_DATA_DIR` or `./data`; use a persistent directory for a deployed single Node service. Connection-specific observation and menu/store caches include `connectionKey(user)` so reconnection cannot reuse another account's upstream selections.

## Game endpoints

| Endpoint | Input / output |
| --- | --- |
| `GET /api/game/bootstrap` | `Bootstrap`; sets or renews the signed profile cookie |
| `POST /api/game/profile` | `{name,city,location,budgets,preferences,calorieTarget,proteinTarget}` → `Bootstrap` |
| `POST /api/game/persona` | `{}` → a fresh profile and cookie, initially in demo mode |
| `GET /api/game/stores` | Query `city`, `keyword`, `beType=1` or `5` → `{stores: Store[],source: Mode}` |
| `POST /api/game/menu` | `{store: Store}` → `{products: MenuProduct[],coupons: unknown[],source: Mode,store: Store}` |
| `POST /api/game/solve` | `{missionId,store}` → `{solutions: Solution[],searched: number,message: string}` |
| `POST /api/game/quote` | `{missionId,store,items: CartItem[]}` → `Quote` |
| `POST /api/game/complete` | `{missionId,quoteId}` → `{bootstrap: Bootstrap,reward: number}` |
| `GET /api/game/events` | `{events: {date,title,description}[],source: Mode}` |
| `POST /api/game/checkout` | `{quoteId,takeWayCode}` → create-order preview for pickup/drive-through; no write occurs yet |
| `GET /api/game/challenge` | Query `missionId` → `{version,challengeCode,mission,mode,shareUrl,notice}`; persists a frozen menu and algorithm baseline; replaces private mission ID with `shared-<code>`, omits seed, resets reward to 0 and status to available |
| `GET /api/game/shared` | Query `code` → `{code,mission,products,source,baseline}` frozen challenge |
| `POST /api/game/shared/evaluate` | `{code,items}` → `{price,evaluation,baseline,beatAI}` based only on stored menu prices; no official quote or XP |
| `POST /api/game/rooms` | `{name?}` → room with invite ID and first member |
| `GET /api/game/rooms` | Query `id` → shared room metadata; invite holders can read this room |
| `POST /api/game/rooms/join` | `{id}` → room with current profile included, maximum 12 members |

Unknown routes return 404; missing identity on game GET routes returns 401. Validation/query errors are returned as `{error:string}` with a non-2xx status, currently generally 400. All responses disable caching. Room membership is basic metadata; it is not a collaborative multiplayer cart or multi-person optimizer.

A Store submitted to the game API must match a recent server-side result for the current connection and channel. Game menus cache briefly; game cart entries are limited to 1–20 distinct rows with each quantity 1–20. Game quote generation reads meal details, attaches eligible store coupons, calls the price service and evaluates menu values on the server. Client-supplied price, nutrition or pass flags cannot supply the official quotation.

The solver searches one main, one drink, optional side/dessert, then quotes a bounded shortlist. `officialVerified` is true only for a live official quote. Demo solutions may have a valid `quote` with source `demo` while `officialVerified` remains false; render this as a successful demo quotation, not an official quote. An empty shortlist has a useful `message` and must remain empty rather than inventing replacements.

A quote is private to its profile, mission and MCP connection session, valid for five minutes, and cannot be consumed across data modes or reconnects. The repository stores a private session key alongside the quote; it is not exposed in the Quote object. Completion uses only the stored quote, rejects failed evaluation or old dates, and grants each mission's server reward once. Cart changes invalidate the displayed quote.

Shared challenges freeze only public task/menu data and a deterministic solver baseline. The selected menu cache belongs to the current connection; another Token's old menu cannot be reused. If no menu has been loaded, generation falls back to demo products and marks the source. Friends access `/challenge/<code>` on this server and submit items for server-side snapshot evaluation. This is menu-price gameplay, not official quotation, transferable wallet rights, original mission completion or a global leaderboard. Links require the current instance's saved SQLite snapshot; no cross-server import endpoint exists.

## MCP module and endpoints

`lib/mcp.ts` provides `callTool(user,name,args)`, `listTools(user)`, `connectionStatus(user)`, `connectionKey(user)`, `connectUser(user,token)`, `disconnectUser(user)`, `validateToolArgs` and observation helpers. `callTool` permits read tools only and returns an unwrapped business response such as `{code:200,data:...,_source:'demo'|'live'}`. Errors propagate instead of being converted to empty data. JSON, structured content and TOON are parsed as data; remote prose cannot execute instructions. Use `businessData(raw)` when accessing a `data` field that may itself contain serialized JSON/TOON.

Live tool schemas come from the official connection, filtered to the supported 35 names. Demo uses `lib/tool-catalog.ts` schemas and consistent fixtures in `lib/demo-tools.ts`. All modes validate inputSchema and dependent selections. The seven write tool names are `auto-bind-coupons`, `delivery-create-address`, `create-order`, `cancel-order`, `mall-create-order`, `party-order-create` and `draw-lottery`.

`lib/mcd-normalize.ts` exports `businessData`, `parseDataText`, `normalizeStores(raw,beType)`, `normalizeMenu(raw,nutritionRaw)`, `normalizeEvents(raw)` and `normalizePrice(raw)`. Menu nutrition matches exact names and preserves unknown values. A modified cart or changed combo composition is not treated as nutritionally complete.

| Endpoint | Contract |
| --- | --- |
| `GET /api/mcp/status` | `{mode,label,toolCount}` |
| `POST /api/mcp/connect` | `{token}` → status; no Token in response |
| `POST /api/mcp/disconnect` | `{}` → demo status |
| `GET /api/mcp/tools` | `{tools:ToolDefinition[]}` |
| `POST /api/mcp/read` | `{name,args}` → `{result}`; rejects write tools |
| `POST /api/mcp/preview` | `{name,args}` → `{confirmationId,name,summary,consumption?,expiresAt,args}` |
| `POST /api/mcp/execute` | `{confirmationId}` → `{result}` |
| `GET /api/mcp/actions` | `{actions: {confirmationId,name,summary,state,error,createdAt}[]}` |

Confirmed actions are private to the profile and exact connection session. Preview and execution both validate schemas and current preconditions. Before execution, the persisted confirmation is claimed atomically and an account write lock is set. The gateway rechecks price, points or chance consumption; changed consumption invalidates the preview. Success can be read again without resubmitting. Transport failures or unreadable mutation results become `uncertain` and keep the lock; the app does not automatically retry. There is no self-service unlock endpoint yet.

Preview reuses a matching pending confirmation. A recently successful `create-order` also reuses the confirmation to prevent duplicate cart submission. Other successful writes may create a new confirmation when the user explicitly previews another operation; this still requires a separate execute request and never auto-runs consecutive lottery draws or redemptions. Executing the same successful confirmation always returns its recorded result.

`lib/actions.ts` exports `previewAction`, `executeAction` and `actionHistory`. Lottery consumes the current `drawDecision.nextConsumption` after verifying `resourceEligible`. Mall and party SKU selection must be observed; party city, store, date and session values must come from the same progressive chain. Pickup `takeWayCode` comes from the latest price result. Delivery orders additionally require an observed address and a store serving that address. Group ordering (`beType=6`) requires an enabled `gmServiceCode` from meal assistance.

Payment is not a local API action. Show the HTTPS official payment URL returned in a successful business response and let the user open it; a created order is not proof of payment. Demo orders return `demoPayment` and no real payment link. Query status through `query-order` or the relevant mall detail tool.

## Frontend scenes and response containers

`app/page.tsx` renders the three-task dashboard, local SVG/CSS city, cart builder, solver, profile and connection settings. `components/ScenePanel.tsx` renders named user scenes and progressive forms using current schemas, then calls only read/preview/execute endpoints. Definition names are canonicalized when matching live tools.

Result selection must handle arrays and actual containers: address lists use `addresses`, SKU lists use `skuList`, group services use `mealAssistanceItems`, price responses use `takeWayList`, and order/mall lists may use `list`. Menu responses use `categories[].meals` plus the `meals` dictionary; merge the dictionary entry into the selected row to retain names and codes. Select and carry upstream city coordinates, store business codes, dates, session identity/times/availability and SKU identity into later forms. Do not infer one code from another or reuse a prior scene's incompatible channel.

User-facing results distinguish demo and live at every scene. A write displays the exact preview summary and consumption before its separate confirmation control. Raw business data may be available under an advanced disclosure; the main interaction is organized by coupon, meal, delivery, group, points, party, lottery and order scenes. Virtual XP and badges are always distinct from official points, coupons and prizes.
