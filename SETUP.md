# Smart Attendance System — Production Setup Guide

## Quick Start (3 options)

### Option 1 — PM2 (Recommended for permanent running)

```cmd
cd smart-attendance

# Install PM2 globally (one time only)
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Save so it survives reboot
pm2 save

# Enable auto-start on Windows boot (run the command it prints)
pm2 startup
```

**Daily commands:**
```cmd
pm2 status                    # check if running
pm2 logs smart-attendance     # view live logs
pm2 restart smart-attendance  # restart
pm2 stop smart-attendance     # stop
```

---

### Option 2 — Built-in Watchdog (no PM2 needed)

```cmd
cd smart-attendance
node keep-alive.js
```

This spawns `server.js` and auto-restarts it on any crash. Keep this terminal open (or use Windows Task Scheduler to run it at startup).

---

### Option 3 — Direct (development only)

```cmd
cd smart-attendance
node server.js
```

---

## Auto-start on Windows Reboot (without PM2)

1. Press `Win + R` → type `shell:startup` → Enter
2. Create a file `start-attendance.bat` in that folder:

```bat
@echo off
cd /d C:\Users\rahul\Desktop\kushalsir_atendence\smart-attendance
node keep-alive.js
```

3. Save and reboot — server starts automatically.

---

## Tunnel (Remote Access)

### ngrok (most stable)
```cmd
# Install: https://ngrok.com/download
ngrok http 3000
```

### localtunnel (free, less stable)
```cmd
npm install -g localtunnel
lt --port 3000 --subdomain smart-attendance
```

**Important:** Always start the server FIRST, then the tunnel.

---

## Health Check

Once running, verify at:
```
http://localhost:3000/health
```

Expected response:
```json
{ "ok": true, "uptime": 42.3, "pid": 12345, "ts": "2026-03-31T..." }
```

---

## Logs

| File | Contents |
|------|----------|
| `logs/server.log` | All server events |
| `logs/pm2-out.log` | PM2 stdout |
| `logs/pm2-error.log` | PM2 stderr |
| `logs/watchdog.log` | Watchdog restart events |

View last 50 lines:
```cmd
npm run logs
```

---

## Default Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Administrator |
| supervisor | sup123 | Supervisor |
| operator | op123 | Operator |
| verifier | ver123 | Verifier |

---

## Port Configuration

Default port: **3000**

To change: set `PORT` environment variable:
```cmd
set PORT=4000 && node server.js
```

If port 3000 is busy, the server **automatically finds the next free port** and logs it.

---

*Powered by Rahul Singh | Infolink*
