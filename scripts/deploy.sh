#!/usr/bin/env bash
#
# Deploy Tin City Founders console from origin/main on the VPS.
#
#   bash /root/apps/tincity/scripts/deploy.sh
#
# Merge the intended PR on GitHub first. This updates only this checkout from
# its existing origin/main using its existing credentials; it never merges PRs
# and never touches another app on the box.
#
# Override APP or BACKUPS in the environment to run it against a different
# checkout — used by tests/deploy-script.mjs to exercise the guards.
set -euo pipefail

# This script lives INSIDE the repository it updates, and bash reads a script
# incrementally from disk as it runs. If the merge below rewrites this file
# mid-execution, bash carries on reading the NEW file from its OLD byte offset
# and executes whatever lands there. So re-exec from a private copy first; the
# copy deletes itself on the way out.
if [ "${TCF_DEPLOY_DETACHED:-}" != "1" ]; then
  self_copy=$(mktemp "${TMPDIR:-/tmp}/tincity-deploy.XXXXXX")
  cat "$0" > "$self_copy"
  chmod 700 "$self_copy"
  TCF_DEPLOY_DETACHED=1 TCF_DEPLOY_SELF_COPY="$self_copy" exec /usr/bin/env bash "$self_copy" "$@"
fi
trap 'rm -f "${TCF_DEPLOY_SELF_COPY:-}"' EXIT

APP=${APP:-/root/apps/tincity}
BACKUPS=${BACKUPS:-/root/tincity-backups}
HEALTHCHECK=${HEALTHCHECK:-https://console.tincityfounders.com/api/host/verify}
PM2_APP=${PM2_APP:-tincity}

cd "$APP"

# git rev-parse hands back a fully resolved path, so compare like with like.
# DEPLOY.md warns that .data may be a symlink on this box and the app directory
# itself has moved once; a comparison that trips over a symlink would refuse a
# perfectly good checkout.
APP_REAL=$(pwd -P)

# ---- Preconditions. Every one of these has cost a real deployment. ----
git rev-parse --show-toplevel >/dev/null 2>&1 || { echo "Not a git repository: $APP"; exit 1; }
[ "$(cd "$(git rev-parse --show-toplevel)" && pwd -P)" = "$APP_REAL" ] || { echo "Wrong repository directory: $APP"; exit 1; }
[ "$(git branch --show-current)" = main ] || { echo 'Expected main; inspect the checkout first'; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo 'Tracked changes need review'; exit 1; }

REMOTE=$(git remote get-url origin)
case "$REMOTE" in
  */africanintelligencelms/Tin-City-Founders-console-|*/africanintelligencelms/Tin-City-Founders-console-.git|*:africanintelligencelms/Tin-City-Founders-console-|*:africanintelligencelms/Tin-City-Founders-console-.git) ;;
  *) echo 'Unexpected origin repository; preserve credentials and inspect it'; exit 1 ;;
esac

# Read PM2 metadata without printing its environment or secrets. process.cwd()
# decides both where .data lives and whether dist/ is served, so a process
# running from the wrong directory looks healthy and serves nothing.
pm2 jlist | PM2_APP="$PM2_APP" APP="$APP" node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const matches = JSON.parse(input).filter(p => p.name === process.env.PM2_APP);
  const env = matches[0]?.pm2_env;
  if (matches.length !== 1 || env.pm_cwd !== process.env.APP ||
      env.pm_exec_path !== process.env.APP + "/dist/server.cjs" || env.status !== "online") {
    console.error(`Expected one online ${process.env.PM2_APP} process at ${process.env.APP}; inspect PM2 first`);
    process.exit(1);
  }
});'

[ -s "$APP/.data/room_state.json" ] || { echo 'Existing room state missing; stop and investigate'; exit 1; }

git fetch origin main
git merge-base --is-ancestor HEAD origin/main || { echo 'Local branch has diverged; resolve before deploying'; exit 1; }
if git merge-base --is-ancestor origin/main HEAD; then
  echo "Already at origin/main ($(git rev-parse --short HEAD)); nothing to deploy."
  exit 0
fi

PREVIOUS=$(git rev-parse HEAD)
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
umask 077
mkdir -p "$BACKUPS"
chmod 700 "$BACKUPS"

# ---- Stop, back up, build, restart. ----
# Stop just this application so no votes or profiles change during the backup.
# On failure leave it stopped for inspection; never restart a partial build.
pm2 stop "$PM2_APP"
trap 'echo "Deployment failed. Tin City remains stopped. Follow the rollback section of DEPLOY.md using the saved commit and backup."; rm -f "${TCF_DEPLOY_SELF_COPY:-}"' ERR

cp -p "$APP/.data/room_state.json" "$BACKUPS/room-state-$STAMP.json"
chmod 600 "$BACKUPS/room-state-$STAMP.json"
printf '%s\n' "$PREVIOUS" > "$BACKUPS/commit-$STAMP.txt"
echo "Backup: $BACKUPS/room-state-$STAMP.json; previous commit: $PREVIOUS"

git merge --ff-only origin/main
# Keep the tracked lockfile. If installation fails, stop instead of silently
# deleting it and deploying a different dependency set.
npm ci --include=dev
npm run lint
npm run build
test -s "$APP/dist/index.html"
test -s "$APP/dist/server.cjs"

# Reuse the saved PM2 environment, including this app's assigned port and keys.
pm2 restart "$PM2_APP"
trap 'rm -f "${TCF_DEPLOY_SELF_COPY:-}"' ERR
pm2 describe "$PM2_APP"
curl --fail --silent --show-error --retry 5 --retry-delay 2 --retry-connrefused "$HEALTHCHECK" > /dev/null
printf 'Health check OK. Deployed commit: '
git rev-parse --short HEAD
