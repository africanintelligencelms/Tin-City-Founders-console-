# Runbook — deploy session memory and clear the test accounts

One-off runbook for the 9 September 2026 deployment. Run every command on the
VPS as the user that owns the `tincity` PM2 process (root, per `DEPLOY.md`).
The general procedure lives in `DEPLOY.md`; this file is the specific sequence
for this deployment and can be deleted once it is done.

## What is being deployed

Commit `d6fac7c`, "Added the ability to remember sessions" — profile recovery by
WhatsApp number, so a member on a new device inherits their original voter
identity and keeps their votes and squad membership.

It is merged to `main` but has never been deployed: `/api/profile/me` currently
returns the SPA's HTML instead of JSON, which is the tell.

Verified on `main` at `f169aba` before writing this: `npm run lint` clean,
`npm run build` clean, `tests/profile-recovery.mjs` passing.

## Why the accounts get cleared afterwards

The check-in handler's ownership test is:

```ts
if (contact && contact.voterId !== req.voterId) return res.status(403).json(...)
```

Attendee rows created before this change have no `contact` record, so the guard
is skipped: the first request to post that attendee's `id` claims the profile
and inherits its voting identity. The ids are public in `GET /api/attendees`.

All four rows in the room today predate the change, so all four are claimable
the moment this deploys. They are test accounts. Deleting them empties the
affected class — rows created after the deploy carry their own owner.

**Order matters.** Clearing before deploying does nothing: the replacements
would be created by the old code and land unowned all over again.

## 1. Check the helper is the current one

An older copy may still target the pre-move `/apps/tincity`.

```bash
head -5 /root/tincity-deploy.sh 2>/dev/null; grep -c '/root/apps/tincity' /root/tincity-deploy.sh 2>/dev/null
```

If the file is missing, or still references `/apps/tincity`, rewrite it from the
script block in `DEPLOY.md` before going further. Do not run an old helper.

## 2. Deploy

```bash
bash /root/tincity-deploy.sh
```

The helper stops `tincity` before building, so the console is down for a minute
or two. That is deliberate: no votes or profiles change while the state backup
is taken, and a failed build leaves the app stopped rather than restarting
something half-built.

Your room state is copied to `/root/tincity-backups/room-state-<stamp>.json`
first, and the previous commit to `commit-<stamp>.txt`, so both the data and the
code are recoverable. The helper finishes by curling `/api/host/verify`.

## 3. Confirm the new build is actually live

```bash
curl -s https://console.tincityfounders.com/api/profile/me
```

Expect `{"attendee":null}`.

**If this returns HTML, stop.** The old build is still running and clearing the
accounts now would recreate unowned rows. Investigate before continuing.

## 4. Clear the test accounts

Load the host key into the shell without printing it:

```bash
set -a; . /etc/tcf/tcf.env; set +a; [ -n "$HOST_KEY" ] && echo "key loaded" || echo "no key — check the env file path"
```

If that reports no key, find where the environment file actually lives before
continuing; do not paste the key inline, it stays in shell history.

```bash
for id in $(curl -s https://console.tincityfounders.com/api/attendees | node -pe 'JSON.parse(require("fs").readFileSync(0)).attendees.map(a=>a.id).join("\n")'); do curl -s -o /dev/null -w "$id %{http_code}\n" -X DELETE -H "x-tcf-host: $HOST_KEY" "https://console.tincityfounders.com/api/attendees/$id"; done
```

Four lines, all `200`. A `403` means the key did not load.

## 5. Confirm the room is empty

```bash
curl -s https://console.tincityfounders.com/api/attendees
```

Expect `{"success":true,"attendees":[]}`.

Then check in once from a phone and add a WhatsApp number in Your Profile. That
row is owned, and recovering it on a second device is the end-to-end proof that
the feature works in production — which nothing has done yet.

## If it goes wrong

Follow the rollback section of `DEPLOY.md`. The two things you need are in
`/root/tincity-backups`: the previous commit in `commit-<stamp>.txt` and the
room state in `room-state-<stamp>.json`.

A deleted attendee is recoverable from that state backup. Note the warning in
`DEPLOY.md`: restoring a state file saved before this change leaves every
attendee row in it unowned, so clear the attendee list again after any such
restore.
