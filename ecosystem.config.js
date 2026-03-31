// PM2 Ecosystem Configuration
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup   (then run the command it prints)

module.exports = {
  apps: [
    {
      name: 'smart-attendance',
      script: 'server.js',
      cwd: __dirname,

      // ── Restart policy ──────────────────────────────────────────────────
      watch: false,               // don't watch files in production
      autorestart: true,          // restart on crash
      max_restarts: 20,           // max restart attempts
      min_uptime: '5s',           // must stay up 5s to count as "started"
      restart_delay: 2000,        // wait 2s between restarts

      // ── Environment ─────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },

      // ── Logging ─────────────────────────────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      log_type: 'json',

      // ── Performance ─────────────────────────────────────────────────────
      instances: 1,               // single instance (SQLite doesn't support cluster)
      exec_mode: 'fork',

      // ── Memory guard ────────────────────────────────────────────────────
      max_memory_restart: '300M', // restart if RAM exceeds 300 MB
    },
  ],
};
