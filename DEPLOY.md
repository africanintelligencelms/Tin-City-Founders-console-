# Deploying Tin City Founders on the existing VPS

## Confirmed production layout

| Item | Value |
|---|---|
| Website | https://console.tincityfounders.com |
| VPS IPv4 | 194.164.76.213 |
| Repository directory | `/root/apps/tincity` |
| PM2 application | `tincity` |
| PM2 working directory | `/root/apps/tincity` |
| Entry point | `/root/apps/tincity/dist/server.cjs` |
| Repository | `africanintelligencelms/Tin-City-Founders-console-` |

These paths match the production PM2 output after the September 9, 2026 move.
`~/apps/tincity` resolves to `/root/apps/tincity` when logged in as root.
The former `/apps/tincity` and `/srv/tcf/app` locations are obsolete.

The move was verified with an HTTPS 200 response and an unauthenticated host
check returning `{"success":true,"ok":false}`. `pm2 save` was run after the move.
PM2's `exec cwd` and script path are authoritative; an inherited `PWD` variable
may still show the old path without changing the process's working directory.

Migration backups are in `/root/tincity-migration-backups`, including the
pre-move app archive, final data archive, and saved PM2 configuration. Keep
these private: they can contain phone numbers and application secrets. The
routine deployment helper below uses `/root/tincity-backups` separately.

The VPS hosts multiple applications, some using different GitHub accounts.
Run the commands below as the existing deployment user in the same environment
that manages the `tincity` process. The supplied PM2 listing uses root.

## Keep this deployment scoped to Tin City

- Preserve this checkout's existing `origin` URL and authentication. An SSH host
  alias may deliberately select a different GitHub account for this repository.
- Do not change global Git configuration, credential helpers, GitHub CLI login,
  shared SSH defaults, or other applications' remotes or keys.
- If authentication fails, stop and inspect this repository's existing setup.
  Any later credential adjustment must be repository-specific; do not replace
  the shared `github.com` identity or overwrite an existing private key.
- Restart only `tincity`. Do not use PM2 commands targeting `all`, kill the PM2
  daemon, or recreate its startup service as part of an app update.
- Preserve the existing Node installation, assigned port, environment/secrets,
  nginx configuration, firewall, DNS and certificate. A routine code update
  does not require system upgrades, a reboot, or a new reverse proxy.

## Inspect before updating

```bash
cd /root/apps/tincity
pwd
git status --short
git remote get-url origin
pm2 describe tincity
```

Confirm that the remote identifies the repository above and that PM2 shows the
working directory and entry point in the table. Do not paste credentials if a
remote URL happens to contain them. If tracked files have local changes, resolve
those changes before updating; do not discard them with a hard reset.

The server saves state in `.data/room_state.json`, relative to the PM2 working
directory. Preserve the existing directory or symlink exactly as it is:

```bash
ls -ld /root/apps/tincity/.data
readlink -f /root/apps/tincity/.data
test -s /root/apps/tincity/.data/room_state.json
```

Do not create a replacement empty data directory if this check fails. Establish
where the running app's data is stored first. Profiles, recovery phone numbers,
votes and squad commitments are part of this state. Backups contain private data.
Keep one application instance: state is held in memory and saved to disk, so
multiple instances would disagree.

## Update from main during a maintenance window

Merge the intended PR on GitHub first. The script below updates only this
checkout from its existing `origin/main`, using its existing authentication.
It does not merge PRs or change GitHub accounts.

Save the following as `/root/tincity-deploy.sh` if you want a repeatable helper.
Read it before running it. Replace any earlier helper that still targets the
former app directory; do not run that old helper after the move.
The backup directory is dedicated to Tin City and outside its checkout.

```bash
#!/usr/bin/env bash
set -euo pipefail
APP=/root/apps/tincity
BACKUPS=/root/tincity-backups
cd "$APP"

[ "$(git rev-parse --show-toplevel)" = "$APP" ] || { echo 'Wrong repository directory'; exit 1; }
[ "$(git branch --show-current)" = main ] || { echo 'Expected main; inspect the checkout first'; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo 'Tracked changes need review'; exit 1; }
REMOTE=$(git remote get-url origin)
case "$REMOTE" in
  */africanintelligencelms/Tin-City-Founders-console-|*/africanintelligencelms/Tin-City-Founders-console-.git|*:africanintelligencelms/Tin-City-Founders-console-|*:africanintelligencelms/Tin-City-Founders-console-.git) ;;
  *) echo 'Unexpected origin repository; preserve credentials and inspect it'; exit 1 ;;
esac

# Read PM2 metadata without printing its environment or secrets.
pm2 jlist | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const matches = JSON.parse(input).filter(p => p.name === "tincity");
  const env = matches[0]?.pm2_env;
  if (matches.length !== 1 || env.pm_cwd !== "/root/apps/tincity" ||
      env.pm_exec_path !== "/root/apps/tincity/dist/server.cjs" || env.status !== "online") {
    console.error("Expected one online tincity process at /root/apps/tincity; inspect PM2 first");
    process.exit(1);
  }
});'

[ -s "$APP/.data/room_state.json" ] || { echo 'Existing room state missing; stop and investigate'; exit 1; }
git fetch origin main
git merge-base --is-ancestor HEAD origin/main || { echo 'Local branch has diverged; resolve before deploying'; exit 1; }
PREVIOUS=$(git rev-parse HEAD)
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
umask 077
mkdir -p "$BACKUPS"
chmod 700 "$BACKUPS"

# Stop just this application so no votes or profiles change during the backup.
# On failure, leave it stopped for inspection; do not restart a partial build.
pm2 stop tincity
trap 'echo "Deployment failed. Tin City remains stopped. Follow the rollback section using the saved commit and backup."' ERR
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
pm2 restart tincity
trap - ERR
pm2 describe tincity
curl --fail --silent --show-error --retry 5 --retry-delay 2 --retry-connrefused \
  https://console.tincityfounders.com/api/host/verify
printf '\nDeployed commit: '
git rev-parse --short HEAD
```

The final host check should report `ok: false` without a host key. A successful
HTTP response alone does not prove the host gate is enabled. Confirm the homepage
loads, the profile flow works, and the browser reconnects to live updates.

This is an in-place build with deliberate downtime for Tin City. Other PM2 apps
remain running. Do not run during an active vote or mixer. A public health check
failure after restart needs inspection; it does not automatically roll back.

### If npm ci fails

Do not delete `package-lock.json` or change the global Node/npm installation.
Inspect the error first. For a confirmed missing optional native dependency, a
scoped recovery attempt from `/root/apps/tincity` is:

```bash
cd /root/apps/tincity
npm install --include=dev --package-lock=false
npm run lint
npm run build
```

This preserves the tracked lockfile, but dependency resolution can differ from
`npm ci`; verify the result before restarting `tincity`. Fix and commit the
lockfile separately if a reproducible install needs repair. Do not automatically
run this fallback after unrelated errors such as failed authentication or disk
exhaustion.

## Rollback and data preservation

If a build fails before restart, the application remains stopped. Read the saved
`commit-<timestamp>.txt`, inspect the checkout, and restore that exact commit in
`/root/apps/tincity` using `git switch --detach <saved-commit>`. Then run `npm ci
--include=dev`, `npm run build`, and `pm2 restart tincity`. Substitute the actual
saved commit; do not paste angle-bracket placeholders literally. This leaves a
detached checkout that must be reconciled with `main` before the next deployment.

A code rollback should normally preserve `.data/room_state.json`. If a data
restore is required, stop only `tincity`, retain a copy of the current state, and
restore a specifically selected backup to the existing resolved data location
before restarting. Do not restore old data merely because a frontend build failed.

A state file saved before the 9 September 2026 session-memory change has no
`memberContacts` map, so every attendee row it carries is unowned. On an unowned
row the check-in handler's ownership test is skipped, and the first request to
post that attendee's `id` claims the profile and its voting identity — the ids
are public in `GET /api/attendees`. After restoring any such backup, clear the
attendee list with `DELETE /api/attendees/:id` and have people check in again.
Rows created after that change carry their own owner and are not affected.

Do not run `reset:room` or `seed:room` during a normal deployment: those commands
replace community data. Do not reboot this shared VPS to test one app's update.

## Existing nginx, IPv6 and HTTPS

Routine application updates leave nginx untouched. If diagnosing routing, inspect
only the Tin City site configuration at
`/etc/nginx/sites-available/console.tincityfounders.com` and its enabled link.
Keep the existing upstream port; do not assume it is 3000 on this shared server.

The September 5 deployment notes record an active AAAA record and an IPv6 routing
fix. When an AAAA record is present, the appropriate nginx server blocks must
listen on IPv6 as well as IPv4 (`listen [::]:80` and the matching existing TLS
listener). Do not remove the AAAA record simply because an old guide said to
expect an empty answer. Preserve certbot's TLS configuration.

The `/api/live/stream` location needs buffering and caching disabled and a long
read timeout. Preserve `X-Forwarded-Proto`, which allows secure voter cookies.
Only if a site-specific nginx change is actually needed, validate with `nginx -t`
before a reload. Do not replace the global nginx config or another site's block.

## Join QR and host access

`print/join-qr.png` is the PR's join QR for the production domain. Scan it before
printing and confirm it reaches `console.tincityfounders.com`.

The host opens the site with their existing host key once per browser. The app
stores it locally and removes it from the URL. The local
`/root/apps/tincity/ecosystem.config.cjs` now contains the running environment
preserved during migration. Keep it untracked, private (mode 600), and out of
Git commits and shared output. Preserve it during pulls and builds.

Preserve the deployed key and its
existing environment source during routine updates; do not rotate it or introduce
a second secrets file. Never commit keys to this repository.

`render.yaml` remains a historical fallback. Switching hosting or DNS is a
separate migration, not part of this update procedure.
