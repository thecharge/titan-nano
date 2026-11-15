#!/bin/sh
# Start script for a computer that may not have Bun yet. Needs only sh.
# Usage: sh install.sh [--install-bun] [--harness codex|claude|both] [--project PATH] [TARGET_FOLDER]
MINIMUM_BUN="1.3.10"
BUN_URL="https://bun.sh"
missing=0
install_bun=0
target=""
harness=""
project=$PWD
project_selected=0
while [ "$#" -gt 0 ]; do
  argument=$1
  shift
  case "$argument" in
    --install-bun) install_bun=1 ;;
    --harness|--project)
      [ "$#" -gt 0 ] && [ -n "$1" ] || { printf '%s\n' "Missing value for $argument." >&2; exit 2; }
      if [ "$argument" = --harness ]; then
        [ -z "$harness" ] || { printf '%s\n' 'Choose one agent selection.' >&2; exit 2; }
        harness=$1
      else
        [ "$project_selected" = 0 ] || { printf '%s\n' 'Choose one project folder.' >&2; exit 2; }
        project=$1
        project_selected=1
      fi
      shift ;;
    --help|-h)
      printf '%s\n' 'Usage: sh install.sh [--install-bun] [--harness codex|claude|both] [--project PATH] [TARGET_FOLDER]' 'The default folder is ~/titan. Agent setup uses the current project unless --project selects another folder.' 'The command is linked in ~/.local/bin. Start with titan guide.'
      exit 0 ;;
    -*) printf '%s\n' "Unknown option: $argument" >&2; exit 2 ;;
    *)
      [ -z "$target" ] || { printf '%s\n' 'Choose one installation folder.' >&2; exit 2; }
      target="$argument" ;;
  esac
done
case "$harness" in
  ''|codex|claude|both) ;;
  *) printf '%s\n' 'Choose codex, claude or both for --harness.' >&2; exit 2 ;;
esac
[ "$project_selected" = 0 ] || [ -n "$harness" ] || { printf '%s\n' '--project requires --harness.' >&2; exit 2; }
if [ -n "$harness" ]; then
  case "$project" in
    /*) ;;
    *) project=$PWD/$project ;;
  esac
  project=$(cd "$project" && pwd) || exit 2
fi
case "$0" in
  */*) here=$(cd "${0%/*}" && pwd) ;;
  *) here=$PWD ;;
esac
[ -n "$target" ] || target="$HOME/titan"
case "$target" in
  /*) ;;
  *) target=$PWD/$target ;;
esac

bun_ready() {
  command -v bun >/dev/null 2>&1 || return 1
  found=$(bun --version 2>/dev/null) || return 1
  case "$found" in
    ''|*[!0-9.]*) return 1 ;;
  esac
  old_ifs=$IFS
  IFS=.
  set -- $found
  have_major=${1:-0}; have_minor=${2:-0}; have_patch=${3:-0}
  [ "$#" = 3 ] && [ -n "$1" ] && [ -n "$2" ] && [ -n "$3" ] || { IFS=$old_ifs; return 1; }
  set -- $MINIMUM_BUN
  need_major=$1; need_minor=$2; need_patch=$3
  IFS=$old_ifs
  [ "$have_major" -gt "$need_major" ] && return 0
  [ "$have_major" -lt "$need_major" ] && return 1
  [ "$have_minor" -gt "$need_minor" ] && return 0
  [ "$have_minor" -lt "$need_minor" ] && return 1
  [ "$have_patch" -ge "$need_patch" ]
}

if [ "$install_bun" = 1 ] && ! bun_ready; then
  echo "Running the official Bun installer from $BUN_URL because you passed --install-bun."
  curl -fsSL "$BUN_URL/install" | sh || exit 2
  PATH="$HOME/.bun/bin:$PATH"
fi

if ! bun_ready; then
  echo "Missing required tool: bun $MINIMUM_BUN or newer."
  echo "Install it from $BUN_URL, or run this script again with --install-bun."
  missing=1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "Missing required tool: git."
  echo "Install Git with your system package manager."
  missing=1
fi
[ "$missing" = 0 ] || exit 2

cd "$here" || exit 1
bun install --frozen-lockfile || exit 1
if [ -n "$harness" ]; then
  exec bun "$here/tooling/scripts/bootstrap-install.ts" "$target" "$here" "$HOME/.local/bin/titan" "$project" "$harness"
fi
exec bun "$here/tooling/scripts/bootstrap-install.ts" "$target" "$here" "$HOME/.local/bin/titan"
