# Deploying the room

One long-running process serves the built frontend, the API and the SSE live
stream from a single origin. There is no separate frontend deployment and no
database.

**Production is a Hostinger VPS.** `render.yaml` is kept as a fallback only.

## Why one machine, deliberately

Room state lives in memory and is persisted to `.data/room_state.json`. A second
instance would hold its own divergent copy — two people voting could land on
different processes and see different tallies, and an SSE client only receives
broadcasts from the process it connected to.

**Do not run a second instance** without moving state to a shared store first.
The port is hardcoded (`server.ts:9`), so a second copy cannot start by
accident. That is a feature.

This is also why the app cannot run on Vercel or any serverless platform:
`app.listen()` never runs there, the filesystem is read-only, and SSE clients
are held in one process's memory.

---

## Placeholders

Substitute once and stay consistent.

| Placeholder | Meaning |
|---|---|
| `console.example.com` | the hostname you will serve on |
| `203.0.113.10` | your VPS IPv4 |

`#` = as root. `$ (tcf)` = as the service user.

---

## 1. Before touching the server

**Check the VPS region.** hPanel → VPS → overview. If the box is in the US and
your audience is in Jos, every SSE frame crosses the Atlantic twice. Changing a
Hostinger VPS location **rebuilds the machine from scratch** — decide now.

**Use a subdomain, not the apex.** The apex may already serve a site and cannot
hold a CNAME if you ever need one.

**Check RAM.** `free -h`. `vite build` on under 2 GB with no swap can be
OOM-killed mid-build, leaving a half-written `dist/`. Add swap in step 2 if so.

**Deploy a tag, not a dirty tree.** On your laptop:

```bash
git checkout main && git pull
git tag vps-cutover-1 && git push origin vps-cutover-1
```

---

## 2. Base box

```bash
ssh root@203.0.113.10
apt update && apt upgrade -y
timedatectl set-timezone Africa/Lagos
```

Swap, only if `free -h` showed under 2 GB:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**Stop unattended upgrades rebooting mid-event:**

```bash
grep -r "Automatic-Reboot" /etc/apt/apt.conf.d/
```

If any line says `"true"`, edit it to `"false"`. Patches still install; the box
just will not reboot itself at 19:40 on event night.

Service user — owns the app, no sudo:

```bash
adduser --system --group --shell /bin/bash --home /srv/tcf tcf
```

---

## 3. Node 24

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs git
node -v      # expect v24.x
```

`engines` only demands ≥20 and the server would run on it. Install **24**
anyway: the SQLite tooling in `db/` imports `node:sqlite`, which does not exist
in 20 and needs `--experimental-sqlite` in 22. On 24 it runs unflagged.

---

## 4. Data directory and secrets

Data lives **outside** the code directory — that is the whole point.

```bash
mkdir -p /var/lib/tcf/data /var/lib/tcf/backups
chown -R tcf:tcf /var/lib/tcf
chmod 750 /var/lib/tcf

mkdir -p /etc/tcf && touch /etc/tcf/tcf.env
chown root:tcf /etc/tcf/tcf.env && chmod 640 /etc/tcf/tcf.env
openssl rand -hex 24      # copy this
```

`nano /etc/tcf/tcf.env`:

```ini
NODE_ENV=production
APP_URL=https://console.example.com
HOST_KEY=<the openssl output>
GEMINI_API_KEY=<your key>
```

systemd's parser is **not a shell**: no `export`, no quotes, no spaces around
`=`, and no trailing comments — `HOST_KEY=abc # key` makes the key literally
`abc # key`.

**Do not create a `.env` in the app directory.** `server.ts` imports
`dotenv/config`, so a stray `.env` would be read as a second, invisible source
of truth.

**An unset `HOST_KEY` disables the host gate entirely** (`server.ts:75`). On a
public URL that means anyone with curl can close a round, broadcast to every
phone, or burn your Gemini quota.

---

## 5. Code and first build

```bash
sudo -u tcf -H git clone <repo-url> /srv/tcf/app
```

Private repo? Generate a deploy key rather than typing a password:
`sudo -u tcf -H ssh-keygen -t ed25519 -f /srv/tcf/.ssh/id_ed25519 -N ""`, then
add the `.pub` to the repo's Settings → Deploy keys as read-only.

**The load-bearing symlink:**

```bash
sudo -u tcf -H ln -s /var/lib/tcf/data /srv/tcf/app/.data
ls -la /srv/tcf/app/.data     # expect .data -> /var/lib/tcf/data
```

Why this matters: `server.ts:91` computes `.data/` from `process.cwd()` and
**creates it if missing**. If the symlink is ever absent the app does not error
— it silently makes an empty real `.data/` inside the checkout, the room comes
up blank, and your actual state sits untouched in `/var/lib/tcf/data`. A "we
lost the room" panic with nothing lost. The deploy script asserts on this.

```bash
sudo -u tcf -H bash -lc 'cd /srv/tcf/app && git checkout vps-cutover-1 && npm ci --include=dev && npm run build'
ls /srv/tcf/app/dist          # expect index.html, assets/, server.cjs
```

**`--include=dev` is mandatory** — vite, esbuild, tsx and typescript are all
devDependencies. And **never `export NODE_ENV=production` in a build shell**;
npm would skip them and the build dies on "vite: not found".

---

## 6. systemd

`nano /etc/systemd/system/tcf.service`:

```ini
[Unit]
Description=Tin City Founders console
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=tcf
Group=tcf

# LOAD-BEARING. process.cwd() decides where BOTH .data/ (server.ts:91) and
# dist/ (server.ts:2154) resolve. Wrong value = empty room AND a blank page.
WorkingDirectory=/srv/tcf/app

EnvironmentFile=/etc/tcf/tcf.env
ExecStart=/usr/bin/node /srv/tcf/app/dist/server.cjs

Restart=always
RestartSec=3
TimeoutStopSec=10
SyslogIdentifier=tcf

NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full
ProtectHome=yes
ReadWritePaths=/var/lib/tcf/data

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now tcf
curl -s localhost:3000/api/host/verify    # expect {"success":true,"ok":false}
```

`ok:false` is **correct** — it proves `HOST_KEY` reached the process and the
gate is armed.

No `PORT` here: the port is hardcoded to 3000 (`server.ts:9`).

---

## 7. Deploy script

`nano /usr/local/sbin/tcf-deploy`, then `chmod 700`:

```bash
#!/usr/bin/env bash
set -euo pipefail
APP=/srv/tcf/app; DATA=/var/lib/tcf/data; BACKUPS=/var/lib/tcf/backups
REF="${1:-main}"

[ -L "$APP/.data" ] || { echo "FATAL: .data is not a symlink"; exit 1; }
[ "$(readlink -f "$APP/.data")" = "$DATA" ] || { echo "FATAL: .data points elsewhere"; exit 1; }

[ -f "$DATA/room_state.json" ] && cp -a "$DATA/room_state.json" \
  "$BACKUPS/room_state-$(date -u +%Y%m%dT%H%M%SZ).json"
find "$BACKUPS" -name 'room_state-*.json' -mtime +60 -delete 2>/dev/null || true

sudo -u tcf -H git -C "$APP" fetch --all --tags --prune
sudo -u tcf -H git -C "$APP" checkout "$REF"
sudo -u tcf -H bash -lc "cd $APP && unset NODE_ENV && npm ci --include=dev && npm run build"
[ -f "$APP/dist/index.html" ] && [ -f "$APP/dist/server.cjs" ] || { echo "FATAL: build incomplete"; exit 1; }

systemctl restart tcf && sleep 3
systemctl is-active --quiet tcf || { journalctl -u tcf -n 40 --no-pager; exit 1; }
curl -fsS localhost:3000/api/host/verify >/dev/null && echo "  api ok"
echo "==> Deployed $(sudo -u tcf -H git -C "$APP" rev-parse --short HEAD)"
```

It cannot wipe data: the only writes are inside `/srv/tcf/app`, where `.data` is
a symlink out. Even `rm -rf` on the app directory would delete the link, not its
target. A backup is taken before every deploy regardless.

**Do not deploy while the room is live.** `vite build` empties and rewrites
`dist/`, which `express.static` reads on every request. For the 20–40s of the
build, anyone loading the page gets broken assets.

---

## 8. Caddy

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

`nano /etc/caddy/Caddyfile` — replace the whole file:

```caddyfile
console.example.com {
	@sse path /api/live/stream
	reverse_proxy @sse 127.0.0.1:3000 {
		flush_interval -1
	}
	reverse_proxy 127.0.0.1:3000
	log {
		output file /var/log/caddy/tcf.log
		roll_size 20MiB
		roll_keep 5
	}
}
```

```bash
caddy validate --config /etc/caddy/Caddyfile
```

**Do not start Caddy yet** — DNS is not pointed at the box and failed
certificate attempts are rate-limited.

**Why Caddy, not nginx.** nginx has `proxy_buffering on` by default, so the one
small `event: PING` the app writes every 15s piles up and arrives in bursts, or
the connection appears to hang. It fails *silently* — the socket is open, the
data just is not moving.

**Three things not to add:**
1. **No `encode gzip`/`zstd`.** Compression and SSE are a classic silent
   breakage. The app sends `Cache-Control: no-transform` to discourage it.
2. **No global write timeout.** Caddy has none by default, which is what lets a
   stream live for a whole event. Add one and every phone drops on that exact
   interval — several minutes in, i.e. mid-event.
3. **No manual `X-Forwarded-Proto`.** Caddy sets it, and `server.ts:48` already
   reads it to decide the `Secure` cookie flag.

---

## 9. Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp      # Let's Encrypt HTTP-01 + the redirect
ufw allow 443/tcp
ufw enable
ufw status verbose
```

Expect 22, 80, 443 — and **nothing for 3000**. That omission is the security
control: the app binds `0.0.0.0`, so without it `http://203.0.113.10:3000`
serves the whole room in plaintext, bypassing your certificate and handing out
`tcf_vid` cookies without `Secure`.

Keep `0.0.0.0` — it is what makes the laptop-on-LAN failsafe work.

**Also check hPanel → VPS → Firewall.** A panel firewall applies *before* ufw,
and mismatched rules are a classic "the site is down and both look fine".

---

## 10. DNS — two visits

Done at your registrar, not on the server.

**Visit 1, at least 24h before cutover:** lower the existing record's TTL to
**300**. Change nothing else. This is what buys you a fast rollback later.

**Visit 2, cutover — not on event day:**

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `console` | `203.0.113.10` | 300 |

- **Delete the old CNAME.** A name cannot hold both.
- **Check for an AAAA record.** If one points elsewhere, every visitor on IPv6
  — a real share of Nigerian mobile — reaches the wrong server while your
  laptop on IPv4 shows everything working.

Verify from your laptop, not the box:

```bash
dig +short A console.example.com @1.1.1.1
dig +short A console.example.com @8.8.8.8
dig +short AAAA console.example.com @1.1.1.1   # expect empty
```

Only when both agree:

```bash
systemctl enable --now caddy
journalctl -u caddy -f      # watch for "certificate obtained successfully"
```

---

## 11. Verification after cutover

```bash
curl -sI http://console.example.com | head -3        # 308 -> https
curl -sI https://console.example.com/ | head -3      # HTTP/2 200
curl -s https://console.example.com/api/live/sync | head -c 120
```

**Proxy headers reached Node:**

```bash
curl -sI https://console.example.com/api/host/verify | grep -i set-cookie
```

Must include `Secure`. If it does not, `x-forwarded-proto` is not arriving.

**Host gate:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://console.example.com/api/admin/state          # 403
curl -s -o /dev/null -w '%{http_code}\n' -H "x-tcf-host: <KEY>" \
     https://console.example.com/api/admin/state                                              # 200
```

**The SSE soak — the test that matters:**

```bash
curl -N -H 'Accept: text/event-stream' https://console.example.com/api/live/stream
```

Success is specific, and "it connected" is not enough:

1. `retry: 3000` then a large `INIT_SYNC` block **immediately**
2. then `event: PING` **once every 15s, one at a time**
3. leave it running **at least 30 minutes**

Pings arriving in clumps after a minute of silence means buffering. A drop at a
round number (60s, 300s) means a write timeout. Both are invisible in a
20-second test and fatal in a 90-minute event.

**Data survives a reboot — the test that proves the whole exercise:**

```bash
# check in from a phone first, then:
reboot
# wait ~40s, SSH back
systemctl is-active tcf
journalctl -u tcf -n 20 --no-pager | grep "Loaded room state"
```

**Survives a hard kill:**

```bash
systemctl kill -s KILL tcf && sleep 5 && systemctl status tcf
```

A phone with the page open recovers on its own in ~3s.

**The bypass is closed** — run from your laptop:

```bash
curl -m 5 http://203.0.113.10:3000/api/live/sync    # must TIME OUT
```

**Regenerate the printed QR.** The old one encodes the Render URL and will send
everyone to a dead host with nothing on screen looking wrong. Reprint and scan
it with a real phone.

**Clear test data before the event:**

```bash
sudo -u tcf -H bash -lc 'cd /srv/tcf/app && npm run reset:room'
systemctl restart tcf
```

---

## Host access

The console is gated by `HOST_KEY`. Open it once per browser at:

```
https://console.example.com/?host=<key>
```

The key is stored in that browser and stripped from the address bar, so it is
never on screen at a projector. After that the plain URL gives *you* the
console; everyone else gets the audience view and cannot escape it.

It is per browser and per device. Clearing site data wipes it — so if you clear
the projector's storage, re-enter with `?host=` afterwards.

Rotating it: edit `/etc/tcf/tcf.env`, `systemctl restart tcf`. Every browser
holding the old key drops to audience mode.

---

## Room backup and restore

```bash
npm run reset:room    # clear between events
npm run seed:room     # restore the demo content
```

During an event, download a backup from the console's **Download room backup**
button, or:

```bash
curl -H "x-tcf-host: <KEY>" https://console.example.com/api/admin/state -o room_state.json
```

---

## Rollback

**Rolling back to Render restores the app but not the room** — Render's free
tier has no disk, which is why you left. Flipping DNS back gives you a working
URL with an *empty* room.

| Tier | Situation | Action |
|---|---|---|
| 1 | Bad code deploy | `tcf-deploy <previous-tag>` — data untouched |
| 2 | App broken, box fine | `systemctl stop tcf`, copy a backup over `room_state.json`, `chown tcf:tcf`, `systemctl start tcf`. **Order matters** — the file is read once at startup |
| 3 | VPS gone, mid-event | The laptop. Download state, `cp` into `.data/room_state.json`, `npm run build && NODE_ENV=production HOST_KEY=<key> npm start`, show the new QR and have the room rescan |
| 4 | DNS back to Render | Slowest, empty room. Between events only |

Keep the Render service alive until you have run one full live event on the VPS.

---

## The venue-internet caveat

Every check-in broadcasts a ~74 KB room snapshot to every connected phone. One
hundred arrivals is roughly 740 MB through the venue's uplink. **This migration
does not change that.** If the venue wifi is uncertain, the laptop-on-LAN mode
is the answer — and that is a decision to make before doors open, not during.

---

## Before the event

- [ ] The 30-minute SSE soak
- [ ] A full `reboot`, confirming `Loaded room state from disk cache` in the log
- [ ] `systemctl kill -s KILL tcf` with a phone connected, watching it recover
- [ ] `tcf-deploy` twice back to back, confirming the room survives both
- [ ] Console opened once with the real key, then a plain visit confirming it persisted
- [ ] A phone on **mobile data**, not just venue wifi — this catches a stray AAAA record
- [ ] Two phones voting in one round, then closing it and confirming results agree
- [ ] **Download room backup** pressed, and the file restored onto the laptop end to end
- [ ] The reprinted QR scanned with a real phone
- [ ] `npm run reset:room` last, so the room starts clean

---

## Fallback: Render

`render.yaml` is kept for this. Free plan, no persistent disk, sleeps after
~15 min idle. It encodes two hard-won details: `--include=dev` in the build
command, and no `healthCheckPath` — the check caused intermittent
`x-render-routing: no-server` 404s on roughly a third of requests while the
page still loaded fine.

Delete the Render service only after a successful live event on the VPS.
