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

Merge the intended PR on GitHub first. The script updates only this
checkout from its existing `origin/main`, using its existing authentication.
It does not merge PRs or change GitHub accounts.

The script is `scripts/deploy.sh` in this repository, so it arrives with the
code it deploys and there is only one copy to keep correct. Read it before
running it. It does not need to be installed anywhere:

```bash
bash /root/apps/tincity/scripts/deploy.sh
```

It refuses to run rather than guess, and every refusal below has cost a real
deployment at least once: a checkout that is not this repository, not on `main`,
has uncommitted tracked changes, points at an unexpected origin, has diverged
from `origin/main`, has no `.data/room_state.json`, or whose PM2 process is not
a single online `tincity` running from this directory. `process.cwd()` decides
both where the room persists and whether `dist/` is served at all, so a process
running from the wrong directory reports healthy and serves nothing.

If the checkout is already at `origin/main` it says so and exits without
stopping anything — a no-op deploy should not take the site down for a rebuild.

Otherwise it stops only `tincity`, copies the room state and the previous commit
into `/root/tincity-backups`, fast-forwards, runs `npm ci --include=dev`, the
typecheck and the build, restarts, and waits on a health check. If any step
fails the app is left stopped for inspection rather than restarted on a partial
build; follow the rollback section below using the saved commit and backup.

`APP`, `BACKUPS`, `PM2_APP` and `HEALTHCHECK` can be overridden in the
environment; `tests/deploy-script.mjs` uses that to exercise the guards against
throwaway checkouts.

The script re-executes itself from a private copy before touching git. It lives
inside the repository it updates, and bash reads a script incrementally from
disk — without the copy, a merge that rewrote the file mid-run would leave bash
reading the new file from its old byte offset.

Delete any older `/root/tincity-deploy.sh`: it is a separate copy that will
drift, and an early version targeted the pre-move `/apps/tincity`.

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
