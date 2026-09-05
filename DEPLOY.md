# Deploying the room

One long-running process serves the built frontend, the API and the SSE live
stream from a single origin. There is no separate frontend deployment and no
database.

**Production is a Hostinger VPS that already hosts ~45 other sites**, served by
nginx and managed by PM2. This app slots in alongside them: its own nginx site
file, its own PM2 process, its own port. It does not touch shared config.

`render.yaml` is kept as a fallback only.

> **Do not install Caddy on this box.** nginx already owns 80/443; a second web
> server would take every other site down.
>
> **Do not run `ufw enable`.** The firewall is currently inactive, so every
> other app's port is open. Enabling it with rules for this app alone would cut
> off the rest, and possibly your SSH session. Firewall policy on a box running
> 45 sites is a separate decision, not part of this deploy.

## Why one machine, deliberately

Room state lives in memory and is persisted to `.data/room_state.json`. A second
instance would hold its own divergent copy — two people voting could land on
different processes and see different tallies, and an SSE client only receives
broadcasts from the process it connected to.

**Do not run a second instance** without moving state to a shared store first.
The port is hardcoded (`server.ts:11`), so a second copy cannot start by
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

**An unset `HOST_KEY` disables the host gate entirely** (`server.ts:77`). On a
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

Why this matters: `server.ts:93` computes `.data/` from `process.cwd()` and
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

## 6. PM2

The box already runs ~21 Node apps under PM2 as root, with `pm2-logrotate`
installed. Follow that convention rather than introducing systemd alongside it.

`nano /srv/tcf/app/ecosystem.config.cjs`:

```js
module.exports = {
  apps: [{
    name: 'tincity',
    script: 'dist/server.cjs',
    // LOAD-BEARING. process.cwd() resolves BOTH .data/ (server.ts:93) and
    // dist/ (server.ts:2156). Wrong cwd = empty room AND a blank page.
    cwd: '/srv/tcf/app',
    instances: 1,          // never more than one: state is in-process memory
    autorestart: true,
    max_restarts: 0,       // 0 = unlimited; never give up mid-event
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      APP_URL: 'https://console.example.com'
    }
  }]
};
```

Secrets do **not** go in this file — it is in the repo. Put `HOST_KEY` and
`GEMINI_API_KEY` in `/etc/tcf/tcf.env` and load them at start:

```bash
cd /srv/tcf/app
set -a && . /etc/tcf/tcf.env && set +a
pm2 start ecosystem.config.cjs --update-env
pm2 save                 # persist the process list across reboots
pm2 startup              # only if `systemctl is-enabled pm2-root` says disabled
pm2 logs tincity --lines 30
curl -s localhost:3000/api/host/verify    # expect {"success":true,"ok":false}
```

`ok:false` is **correct** — it proves `HOST_KEY` reached the process and the
gate is armed. `ok:true` means the key did not load and the console is open to
anyone.

`pm2 save` is the step people forget. Without it the app does not come back
after a reboot, even though PM2 itself does.

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

pm2 restart tincity --update-env && sleep 3
pm2 describe tincity | grep -q 'status.*online' || { pm2 logs tincity --lines 40 --nostream; exit 1; }
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

## 8. nginx

nginx already serves every other site here, with TLS managed by certbot. Add a
site file; change nothing shared.

`nano /etc/nginx/sites-available/console.example.com`:

```nginx
server {
    listen 80;
    server_name console.example.com;

    client_max_body_size 200M;

    # The SSE stream. proxy_buffering off is the critical line: nginx buffers
    # proxied responses by default, so the one small PING the app writes every
    # 15s piles up and arrives in clumps, or the stream appears to hang. It
    # fails SILENTLY - the socket is open, the data just is not moving.
    location /api/live/stream {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
        chunked_transfer_encoding off;
    }

    # Everything else: API, static assets, SPA fallback - one process.
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/console.example.com /etc/nginx/sites-enabled/
nginx -t                 # MUST say "syntax is ok" and "test is successful"
systemctl reload nginx   # reload, not restart - does not drop other sites
```

**If `nginx -t` fails, stop.** Do not reload — a broken config takes down all
45 sites. Fix the file first.

TLS, after DNS is pointed (step 10):

```bash
certbot --nginx -d console.example.com
```

certbot rewrites this file in place, adding the 443 block and the 80→443
redirect, matching every other site here. **Re-check afterwards that
`proxy_buffering off` survived into the 443 block** — certbot copies the
location blocks, but confirm rather than assume:

```bash
grep -A3 "live/stream" /etc/nginx/sites-enabled/console.example.com
```

**Do not add `gzip on` to this site.** Compression and SSE are a classic silent
breakage; the app sends `Cache-Control: no-transform` to discourage it.

## 9. Firewall — deliberately unchanged

`ufw` is **inactive** on this box, so every app's port is already reachable
from the internet. That includes port 3000 once this app starts: `http://<vps
-ip>:3000` would serve the room in plaintext, bypassing TLS and handing out
`tcf_vid` cookies without the `Secure` flag.

**This deploy does not change that**, because enabling a firewall on a server
running 45 sites needs its own inventory of which ports must stay open — get it
wrong and you take down other people's apps, or lock yourself out of SSH.

If you want the exposure closed, the safe options in order:

1. Bind the app to loopback only. nginx proxies from `localhost:3000`, so
   nothing else needs the public bind. Costs you the laptop-on-LAN failsafe,
   which needs `0.0.0.0`.
2. A single targeted rule: `ufw deny 3000/tcp` **without** `ufw enable` — no
   effect while ufw is inactive, but in place if it is ever turned on.
3. A full firewall audit for the whole box. Worth doing, separately, not on
   the day.

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

Only when both agree, request the certificate:

```bash
certbot --nginx -d console.example.com
grep -A3 "live/stream" /etc/nginx/sites-enabled/console.example.com  # buffering off survived?
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
pm2 stop tincity && pm2 start tincity && sleep 5 && pm2 describe tincity | grep status
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
pm2 restart tincity --update-env
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

Rotating it: edit `/etc/tcf/tcf.env`, `pm2 restart tincity --update-env`. Every browser
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
