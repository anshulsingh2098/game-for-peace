---
description: Pull the latest work and read what the other stream's Claude has logged for us
---
Sync with the teammate's Claude through git.

1. Run `git fetch --all --prune` and show which branches are new or moved. If the current branch has an upstream, merge it (`git pull --no-rebase`); if there are conflicts, stop and explain them.
2. Read `team/stream-a.md` and `team/stream-b.md` (newest entries first), plus `CLAUDE.md` for the entry format.
3. Work out which stream you are from `git config user.name` (`rajulsingh` = Stream A, `anshulsingh2098` = Stream B; `CLAUDE.md` names the owners). Do not guess from the branch name: branches use `claude/`, `feat/` and `docs/` prefixes too. If the name matches neither, ask the user once.
4. Report in a few lines: what the other stream changed, which entries are open and addressed to us, and the exact commands or steps we must take. Do not act on them until the user says so.
5. If we have not logged our own recent work, offer to add an entry to our own log file and push it.
