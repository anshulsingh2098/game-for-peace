# Game for Peace Tracker (a page for the owner, on Cloudflare)

`public/index.html` is the whole page (checkboxes, status, remarks, comments on every item of the plan: status, phases, N0 to N20, backlog, done, limits, technicals, docs, the owner's requests).
`worker.js` serves it and keeps the shared state in KV behind one password. The same `index.html` is also published as a claude.ai Artifact, where the state is kept by the Artifact's own store; on Cloudflare it uses the Worker.

**Status: not deployed.** Deploying is Anshul's job (CLAUDE.md, HANDOFF.md): the Cloudflare account is `rawatanshul525@gmail.com`; `npx wrangler whoami` must say that (or the account the owner names for this page). This is a separate Worker, `game-for-peace-tracker`; it does not touch the game's site or `cloudflare/public`.

## Deploy (once)

```bash
cd tracker
npx wrangler whoami                          # check the account first
npx wrangler kv namespace create TRACKER     # prints an id: paste it into wrangler.jsonc (kv_namespaces[0].id)
npx wrangler secret put TRACKER_PASSWORD     # type the shared password
npx wrangler deploy                          # prints the page's address
```

Open the address, enter the password. Reading and writing both need it. The page is `noindex`; nothing in the repo holds the password.

## Keeping it up to date

The content is the arrays at the top of the script in `public/index.html` (`ITEMS`, `PRS`, `FACTS`, `TABS`): edit the statuses there after a pull request merges or a phase item finishes, then
1. republish the Artifact from this file (same URL), and
2. `cd tracker && npx wrangler deploy` for the Cloudflare copy.
A person's ticks, remarks and comments live in the store and survive both. An item's `s` in the file is only its starting status; the stored status wins. A new item needs a new unique id.
