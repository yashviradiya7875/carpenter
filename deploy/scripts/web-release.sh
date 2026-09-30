#!/usr/bin/env bash
#
# Server-side release manager for the static bundle. Uploaded by CI to
# /var/www/namelessos.cloud/bin/web-release.sh and invoked over SSH.
#
#   web-release.sh activate <release-id>
#   web-release.sh rollback
#   web-release.sh prune [keep=5]
#   web-release.sh status
#
# The API ships from its own repository and manages /opt/surus-api — nothing
# here touches the service, the database or the systemd unit.
#
# Layout it maintains:
#   /var/www/namelessos.cloud/releases/<id>/   index.html + assets/
#   /var/www/namelessos.cloud/current  -> releases/<id>   (nginx root)
#   /var/www/namelessos.cloud/previous -> releases/<id>   (rollback target)
set -euo pipefail

WEB_ROOT="${WEB_ROOT:-/var/www/namelessos.cloud}"
SITE_HOST="${SITE_HOST:-namelessos.cloud}"

log()  { printf '\033[1;34m[web-release]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[web-release]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[web-release]\033[0m %s\n' "$*" >&2; exit 1; }

# A static bundle has no process to poll, so "healthy" means nginx actually
# serves the app shell out of the directory the symlink now points at.
#
# This has to go through TLS. certbot rewrites the :80 vhost to `return 301`,
# so a plain Host-header request to 127.0.0.1 only ever gets the 178-byte
# redirect body back — the app shell is never in it, and the check fails every
# release including the one it just rolled back to.
#
# --resolve pins the connection to this box while keeping the real hostname for
# SNI and certificate validation, so the probe tests the actual serving path
# without leaving the server or depending on public DNS.
serves_app_shell() {
  if curl -fsS --max-time 10 --resolve "${SITE_HOST}:443:127.0.0.1" \
       "https://${SITE_HOST}/index.html" 2>/dev/null | grep -qi '<div id="root"'; then
    return 0
  fi
  # No certificate yet — a box provisioned before certbot has run still serves
  # the bundle on :80 without a redirect.
  curl -fsS --max-time 10 -H "Host: ${SITE_HOST}" \
    "http://127.0.0.1/index.html" 2>/dev/null | grep -qi '<div id="root"'
}

activate() {
  local id="${1:?release id required}"
  local release="${WEB_ROOT}/releases/${id}"

  [ -d "$release" ]              || die "release not found: $release"
  [ -f "${release}/index.html" ] || die "release has no index.html: $release"

  local prior
  prior="$(readlink -f "${WEB_ROOT}/current" 2>/dev/null || true)"

  log "switching symlink to ${id}"
  ln -sfn "$release" "${WEB_ROOT}/current"

  # nginx resolves `root` per request, so no reload is needed — but it does
  # cache open file descriptors, so give it a moment before checking.
  sleep 1

  if ! serves_app_shell; then
    warn "release ${id} does not serve the app shell — restoring the previous release"
    if [ -n "$prior" ] && [ -d "$prior" ]; then
      ln -sfn "$prior" "${WEB_ROOT}/current"
      serves_app_shell && log "restored $(basename "$prior")" \
        || warn "restored release is ALSO not serving — check: nginx -t; tail /var/log/nginx/${SITE_HOST}.error.log"
    else
      warn "no earlier release to restore (this was the first deploy)"
    fi
    # `previous` is deliberately NOT updated: a failed release must never
    # become the thing a later `rollback` returns to.
    die "activation aborted: ${id} is not serving"
  fi

  [ -n "$prior" ] && ln -sfn "$prior" "${WEB_ROOT}/previous"

  log "release ${id} is live"
}

rollback() {
  local target current
  [ -L "${WEB_ROOT}/previous" ] || die "no previous release recorded — nothing to roll back to"
  target="$(readlink -f "${WEB_ROOT}/previous")"
  [ -d "$target" ] || die "previous release directory is gone: $target"

  # Idempotent: activate() already restores itself on failure, so a rollback
  # called afterwards must not walk a second release backwards.
  current="$(readlink -f "${WEB_ROOT}/current" 2>/dev/null || true)"
  if [ "$current" = "$target" ]; then
    log "already serving $(basename "$target") — nothing to roll back"
    return 0
  fi

  log "rolling back to $(basename "$target")"
  ln -sfn "$target" "${WEB_ROOT}/current"
  sleep 1

  if serves_app_shell; then
    log "rollback complete"
  else
    die "rolled back but the site is still not serving — check: nginx -t"
  fi
}

prune() {
  local keep="${1:-5}"
  local root="${WEB_ROOT}/releases"
  [ -d "$root" ] || return 0

  # Never delete whatever current/previous point at, however old they are.
  local current previous
  current="$(readlink -f "${WEB_ROOT}/current" 2>/dev/null || true)"
  previous="$(readlink -f "${WEB_ROOT}/previous" 2>/dev/null || true)"

  local dir full
  for dir in $(ls -1 "$root" | sort -r | tail -n "+$((keep + 1))"); do
    full="${root}/${dir}"
    if [ "$full" = "$current" ] || [ "$full" = "$previous" ]; then continue; fi
    log "pruning releases/${dir}"
    rm -rf "$full"
  done
}

status() {
  echo "current:  $(readlink -f "${WEB_ROOT}/current" 2>/dev/null || echo none)"
  echo "previous: $(readlink -f "${WEB_ROOT}/previous" 2>/dev/null || echo none)"
  echo -n "serving:  "
  serves_app_shell && echo "app shell OK" || echo "NOT serving the app shell"
}

case "${1:-}" in
  activate) shift; activate "$@" ;;
  rollback) rollback ;;
  prune)    shift; prune "$@" ;;
  status)   status ;;
  *) die "usage: web-release.sh {activate <id>|rollback|prune [keep]|status}" ;;
esac
