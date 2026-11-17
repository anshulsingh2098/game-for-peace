# Game for Peace: instructions for Claude

Two people work here at the same time, each with their own Claude. Read `PARALLEL_PLAN.md` (who owns which files) and `HANDOFF.md` / `OVERVIEW.md` (what the project is).

- **Stream A (World):** Rajul. Log file: `team/stream-a.md`.
- **Stream B (Vehicle & Game):** Anshul. Log file: `team/stream-b.md`.

## The team log (how the two Claudes talk through git)

Each stream **writes only its own** log file, so the two never conflict. Both **read both**.

**At the start of every session, and whenever the user says "sync":**
1. `git fetch` and `git pull` (or merge `origin/<integration branch>`).
2. Read `team/stream-a.md` and `team/stream-b.md`, newest entries first. Pay most attention to entries under **For the other stream** that are not yet marked done.
3. Tell the user, in a few lines, what the other stream changed and what you must do about it.

**Add an entry to your own file (newest at the top) whenever you:**
- change a shared file (`src/main.js`, `src/core/config.js`, `tools/selftest.mjs`, `tools/stage_cloudflare.py`, `HANDOFF.md`), or an interface the other stream relies on (see `PARALLEL_PLAN.md`);
- finish a task or a phase, or push a branch the other person needs;
- add a new address option, setting, file or command the other person might need;
- find a problem in the other stream's area (describe it; do not edit their files);
- need the other person to run a command, pull, or decide something.

**Keep the tracker current.** The tracker page (`tracker/`, a separate Worker) builds its Rajul and Anshul views and its Assigned tasks from the repo: `docs/NEXT_PHASES.md`, the open asks in the two team logs, `CHECKLIST.md`, pull requests and Anshul's `vehicle/*` branches. After you change a plan, a log entry, the checklist or open or merge a pull request, run `node tools/build_tracker.mjs` and commit `tracker/public/`; the owner's account deploy is `node tools/build_tracker.mjs --deploy`. `python tools/daily_check.py` warns when it is stale. Items you want shown on someone's list go in `docs/NEXT_PHASES.md` or under "For the other stream" with `Status: open`.

**Reserve before you edit a shared file.** The log entry after an edit is not enough. Before touching a shared file, read the other stream's log and `git log origin/main -3 -- <file>`; if the other stream or another session has it open, wait or ask the user. Where practical, make the shared-file change in its own small commit.

**Status words.** `Status: open` means the other stream must act. `Status: info` means a notification only, nobody has to reply. `Status: done` means finished or answered. Give each entry that needs action an ID in its title (`A-2026-11-17-01`) so a reply can say "Re: A-2026-11-17-01: done". Close your own old `open` entries when nothing is left to do.

**Evidence, not adjectives.** In an entry, say separately what is *implemented*, what the *self-test* covers, what was *seen in a browser*, what was tried on a *real device*, and what a person has *accepted*. A phase is not "done" because the code exists. Put the commit hash, and for performance the device, quality tier, whether the window was visible, and p95 or p99. Never quote a hidden-tab frame rate as device performance. Status for the whole project lives in `docs/STATUS.md`; owner decisions in `docs/DECISIONS.md` (follow them, do not ask again).

Entry format (keep it short; exact commands in code blocks):

```
## YYYY-MM-DD HH:MM  <one-line title>
Branch: <branch>  Commit: <short hash>
What changed: <files and what they do now>
For the other stream: <what they must do; the exact commands; "nothing" if none>
Status: open | done
```

After writing an entry, commit it and push it. Entries that need action stay `open` until the other stream sets them to `done` by writing a reply in their own file ("Re: <title>: done").

## Start of every working day

1. Run `python tools/daily_check.py` and show the user the output in a few lines.
2. Remind the user of the manual checks in `CHECKLIST.md` (sections 3 to 5) and ask which ones they did and what they found. Anything that failed becomes an open entry in your team log, to fix before new features.
3. Whenever you add a feature or find something nobody has verified, add a line to `CHECKLIST.md`, or a check to `tools/daily_check.py` if a computer can judge it.

## Rules that always apply

- Only edit files your stream owns (`PARALLEL_PLAN.md`), except where `docs/DECISIONS.md` records an owner override (17 Nov 2026: Anshul's Claude takes over the Delhi phases P1 to P8, L1 to L6 and N17 to N20, so it may edit the world files for those tasks). For shared files make the smallest change and log it.
- Never deploy, never touch `cloudflare/public`, never merge into the integration branch unless the user says so.
- **Where deploys go (owner decision, 17 Nov 2026):** new versions deploy to **Rajul's Cloudflare account** (`mailrajulsingh.in@gmail.com`, paid plan), live at https://game-for-peace.mailrajulsingh-in.workers.dev. **Anshul's account keeps the older original versions** (`game-for-peace.anshul-rawat.workers.dev`, `/` and `/next`): do not deploy over them. Check `npx wrangler@4 whoami` names the account you mean before every deploy. How: copy `cloudflare/worker.js` and `cloudflare/wrangler.jsonc` to a scratch folder, run `python tools/stage_cloudflare.py --out <folder>/public`, then `node tools/bundle.mjs <folder>/public` (one minified script instead of 142 files; `?src=1` on the address loads the unbundled game), then `npx wrangler@4 deploy` from the scratch folder (the repo's `cloudflare/public` stays untouched).
- Run `node tools/selftest.mjs` before every push.
- Keep line endings as they are (the repo mixes LF and CRLF).
