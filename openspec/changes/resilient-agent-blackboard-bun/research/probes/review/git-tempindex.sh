#!/bin/sh
# Probe: checkpoint the user's tree into a commit via a temporary index, without touching the user's
# HEAD, index or files; then run the agent in a separate worktree based on that commit.
set -eu
D=$(mktemp -d); cd "$D"; git init -q repo; cd repo
git config user.email p@p; git config user.name p
printf 'secret\n' > .env; printf '.env\n' > .gitignore; echo v1 > tracked.txt; git add -A; git commit -qm base
echo "user-wip" >> tracked.txt; echo u > user-untracked.txt
mkdir -p .git/hooks; printf '#!/bin/sh\necho HOOK-RAN > /tmp/titan-hook-marker-$$\n' > .git/hooks/pre-commit; chmod +x .git/hooks/pre-commit
before_status=$(git status --porcelain | tr '\n' ';'); before_index=$(git ls-files -s | sha256sum | cut -c1-12); before_head=$(git rev-parse HEAD)
snap() { # $1 = work tree
  TI=$(mktemp -u); GIT_INDEX_FILE=$TI git -C "$1" read-tree HEAD; GIT_INDEX_FILE=$TI git -C "$1" add -A
  T=$(GIT_INDEX_FILE=$TI git -C "$1" write-tree); rm -f $TI
  git -C "$1" -c core.hooksPath=/dev/null commit-tree "$T" -p HEAD -m "titan checkpoint"; }
C0=$(snap .); git update-ref refs/titan/run1/checkpoint/0 "$C0"
echo "checkpoint 0 files: $(git ls-tree -r --name-only $C0 | tr '\n' ' ')"
echo "user status unchanged: $([ "$before_status" = "$(git status --porcelain | tr '\n' ';')" ] && echo yes || echo NO)"
echo "user index unchanged: $([ "$before_index" = "$(git ls-files -s | sha256sum | cut -c1-12)" ] && echo yes || echo NO)"
echo "user HEAD unchanged: $([ "$before_head" = "$(git rev-parse HEAD)" ] && echo yes || echo NO)"
mkdir -p .git/titan/worktrees
git -c core.hooksPath=/dev/null worktree add -q --detach .git/titan/worktrees/run1 "$C0"
W=.git/titan/worktrees/run1
echo "worktree inside .git created: $(test -f $W/user-untracked.txt && echo yes)"
echo "user status after worktree add: $(git status --porcelain | tr '\n' ';')"
echo agent >> $W/tracked.txt; echo x > $W/agent-new.txt
C1=$(snap $W); git update-ref refs/titan/run1/checkpoint/1 "$C1"
echo "checkpoint 1 adds: $(git diff --name-status $C0 $C1 | tr '\n' ' ')"
echo bad > $W/tracked.txt; echo junk > $W/agent-junk.txt
git -C $W -c core.hooksPath=/dev/null reset -q --hard "$C1"; git -C $W clean -qfd
echo "restore to cp1 diff: '$(git -C $W diff $C1 --stat)' untracked: '$(git -C $W ls-files --others --exclude-standard)'"
TI=$(mktemp -u); E=$(mktemp -d); C2=$(GIT_INDEX_FILE=$TI git -C "$E" --git-dir="$PWD/.git" -c core.hooksPath=/dev/null commit-tree "$(git mktree </dev/null)" -m e 2>&1 | tail -1); rm -rf "$E"
echo "clean-tree snapshot still yields a sha: $(C=$(snap $W); echo ${#C} chars)"
echo "hook marker files: $(ls /tmp/titan-hook-marker-* 2>/dev/null | wc -l)"
echo "user tree still: $(git status --porcelain | tr '\n' ';')"
echo "user .env intact: $(cat .env)"
rm -rf "$D"
