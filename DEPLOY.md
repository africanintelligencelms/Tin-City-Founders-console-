# Deploying the room

One long-running service: it serves the built frontend, the API, and the SSE
live stream from a single process. No separate backend, no database.

## Why one machine, deliberately

Room state lives in memory and is persisted to `.data/room_state.json`. A
second machine would hold its own divergent copy — two people voting could hit
different instances and see different rooms. **Do not scale past one instance**
without moving state to a shared store first.

This is also why the app cannot run on Vercel or any serverless platform:
`app.listen()` never runs there, the filesystem is read-only, and SSE clients
are held in one instance's memory.

## First deploy

```bash
fly launch --no-deploy    # reuses the committed fly.toml
fly volumes create tcf_data --region jnb --size 1
fly secrets set GEMINI_API_KEY=...
fly secrets set HOST_KEY="$(openssl rand -hex 24)"   # see "Host access" below
fly deploy
```

`primary_region` is `jnb` (Johannesburg), the closest Fly region to Jos. Change
it in `fly.toml` if you deploy elsewhere, and create the volume in the same
region — a volume is tied to one region.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | for AI plans | Set with `fly secrets set`, never in `fly.toml` |
| `PORT` | no | Defaults to 3000; Fly sets it |
| `NODE_ENV` | no | `production` is set in `fly.toml` |
| `HOST_KEY` | **yes, on a public URL** | Shared secret for the stage console. Unset = every host route is open to anyone |
| `APP_URL` | no | Public URL. Only used in the startup console log — it does **not** feed the join QR |
| `SEED_ROOM` | no | `1` boots with demo content instead of an empty room |

## Host access

Every host action — changing the stage phase, broadcasting to every phone,
opening or closing a round, deleting an attendee, editing trustee scores, and
the Gemini plan generator that spends `GEMINI_API_KEY` — is gated on a shared
secret, `HOST_KEY`. Requests must carry it as the `x-tcf-host` header;
without it the server answers `403 {"success":false,"error":"Host key required."}`.

Audience routes are untouched: check-in, all voting and ballots, problem
submission, nominations, comments, join-squad, reactions and every `GET`
work with no header at all.

**If `HOST_KEY` is unset the gate is disabled and every host route is open.**
That is deliberate — it keeps local dev frictionless — but it means the
variable is mandatory on a public URL.

Generate one:

```bash
openssl rand -hex 24
fly secrets set HOST_KEY=<that value>
```

The host opens the console **once**, on the host laptop:

```
https://<domain>/?host=<key>
```

The key is saved to `localStorage` under `tcf_host_key` and immediately
stripped from the address bar (`history.replaceState`), so it never sits on a
projector. After that the host just visits `https://<domain>/` as normal.

On load the client calls `GET /api/host/verify`, which returns
`{success:true, ok:<boolean>}` and never echoes the key. If `ok` is false the
app forces itself into audience mode, so removing `?mode=audience` from the URL
no longer reveals the console. The client gate is only a courtesy — the server
gate is the one that matters.

To revoke: `fly secrets set HOST_KEY=<new value>` and restart. Every old
browser holding the previous key drops back to audience mode.

## Running the room

The room starts **empty** and fills as people scan the QR.

```bash
npm run reset:room   # clear between events
npm run seed:room    # restore the demo content from seed/
```

On Fly, run these against the machine:

```bash
fly ssh console -C "rm -f /app/.data/room_state.json"
fly machine restart
```

## Room backup & restore (the failsafe)

The room lives in memory and is mirrored to `.data/room_state.json`. **On a host
with no persistent disk — Render's free tier, for example — that file dies with
the process.** Any platform restart, deploy, or idle-spin-down takes the whole
evening with it. The backup below is the only thing standing between a restart
and a lost room, so take one after every round that matters.

### Taking a backup

Press **Download room backup** in the stage conductor bar (host console only).
It saves `room_state-<timestamp>.json`.

Or from a terminal:

```bash
curl -H "x-tcf-host: $HOST_KEY" https://<domain>/api/admin/state -o room_state.json
```

`GET /api/admin/state` is host-gated (`403` without the key) and returns exactly
the object the server writes to disk — the download **is** a state file, not an
export format.

### Restoring onto the backup laptop

```bash
# on the laptop, in the repo
mkdir -p .data
cp ~/Downloads/room_state-2026-09-04T18-40-12.json .data/room_state.json
npm run build
NODE_ENV=production HOST_KEY=<key> APP_URL=http://<laptop-lan-ip>:3000 npm start
```

The server reads `.data/room_state.json` on boot, so the room comes back with
every attendee, problem, vote and archived round intact. Copy the file **before**
starting the server — it is only read at startup, and the first write from the
running room overwrites it.

Then repoint the phones: the join QR is generated from whatever origin the phone
loaded, so re-show the QR from the laptop's console (`http://<laptop-lan-ip>:3000/?host=<key>`)
and have the room rescan.

Two details worth knowing:

- A round that was mid-reveal when the process died is archived on boot instead
  of coming back as a live reveal. Its reveal timer only existed in memory, so
  restoring it would pin a stale results screen on every phone in the room until
  the host cleared it by hand. The result is still in `roundHistory`, and the
  idle screen shows it as "Last round result".
- Individual ballots are dropped once a round is archived; the per-option tally
  in `round.results` is what survives.

## Before the event

- [ ] `fly deploy` and open the URL
- [ ] Confirm `HOST_KEY` is set: `fly secrets list`
- [ ] Open `https://<domain>/?host=<key>` on the host laptop and check the console appears
- [ ] Open `https://<domain>/` on a phone and confirm it gets the audience view, not the console
- [ ] Check the volume is mounted: `fly ssh console -C "ls -la /app/.data"`
- [ ] Scan the QR from a phone on mobile data, confirm the room loads
- [ ] Open a test round, vote from two phones, close it, confirm results
- [ ] Press **Download room backup** once and confirm a JSON file lands
- [ ] `npm run reset:room` to clear the test

## The venue-internet caveat

Every check-in broadcasts a ~74 KB room snapshot to every connected phone.
With 100 people arriving, that is roughly 740 MB pulled through the venue's
uplink. On a solid connection this is fine. If the venue wifi is uncertain,
running the server on a laptop on the local network removes both the uplink
dependency and the failure mode of losing the room when the internet drops.

To run locally on the night:

```bash
npm run build
NODE_ENV=production HOST_KEY=<key> APP_URL=http://<laptop-lan-ip>:3000 npm start
```

Phones join over the venue wifi; nothing leaves the room.
