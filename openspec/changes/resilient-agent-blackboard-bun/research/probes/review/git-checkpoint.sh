#!/usr/bin/env bash
# Probe: git stash create coverage, restore residue, hooks on host, worktree isolation.
set -u
D=$(mktemp -d); cd "$D"; git init -q -b main; git config user.email p@p; git config user.name p
echo base > tracked.txt; echo .env > .gitignore; git add -A; git commit -qm base
echo "clean-tree stash create: '$(git stash create)'"
echo user-edit >> tracked.txt; echo u > user-untracked.txt; echo SECRET=1 > .env
S=$(git stash create); echo "dirty stash create files: $(git ls-tree -r --name-only $S | tr '\n' ' ')"
printf '#!/bin/sh\necho HOOK-RAN-ON-HOST > %s/hook-marker\n' "$D" > .git/hooks/pre-commit; chmod +x .git/hooks/pre-commit
git worktree add -q ../wt-$$ -b titan/run-1 2>/dev/null; cd ../wt-$$; echo agent > agent-new.txt; git add -A; git commit -qm cp1
echo "hook after commit in worktree: $(cat $D/hook-marker 2>/dev/null || echo none)"; rm -f $D/hook-marker
echo x >> agent-new.txt; git -c core.hooksPath=/dev/null commit -qam cp2
echo "hook with hooksPath=/dev/null: $(cat $D/hook-marker 2>/dev/null || echo none)"
cd "$D"; echo "user tree after worktree commits: $(git status --porcelain | tr '\n' ' ')"
