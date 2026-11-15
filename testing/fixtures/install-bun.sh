#!/bin/sh
case "$1" in
  --version) printf '%s\n' "$TITAN_TEST_BUN_VERSION" ;;
  install) [ "$TITAN_TEST_INSTALL_CASE" != build-failure ] ;;
  run)
    case "$TITAN_TEST_INSTALL_CASE" in
      killed-*)
        printf '%s\n' "$$" > "$TITAN_TEST_INSTALL_RECORD"
        exec "$TITAN_TEST_INSTALL_RUNTIME" --eval 'setTimeout(() => {}, 60000)' ;;
    esac
    [ "$2" = pack:preview ] && [ -d "$3" ] || exit 1
    [ "$3" != "$PWD/dist" ] || exit 1
    printf package > "$3/titan-cli-test.tgz"
    if [ "$TITAN_TEST_INSTALL_CASE" = multiple-archives ]; then
      printf package > "$3/titan-cli-other.tgz"
    fi ;;
  add)
    [ "$2" = --ignore-scripts ] || exit 1
    [ "$TITAN_TEST_INSTALL_CASE" != add-failure ] || exit 1
    mkdir -p node_modules/.bin || exit 1
    cp "$TITAN_TEST_INSTALL_DOCTOR" node_modules/.bin/titan || exit 1
    chmod +x node_modules/.bin/titan ;;
  */tooling/scripts/bootstrap-install.ts) exec "$TITAN_TEST_INSTALL_RUNTIME" "$@" ;;
  *) exit 1 ;;
esac
