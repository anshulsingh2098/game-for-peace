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

- Only edit files your stream owns (`PARALLEL_PLAN.md`). For shared files make the smallest change and log it.
- Never deploy, never touch `cloudflare/public`, never merge into the integration branch unless the user says so.
- Run `node tools/selftest.mjs` before every push.
- Keep line endings as they are (the repo mixes LF and CRLF).
