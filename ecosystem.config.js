module.exports = {
  apps: [{
    name: 'parse-server',
    script: './bin/parse-server',
    instances: process.env.PM2_INSTANCES || 4,
    exec_mode: 'cluster',
    watch: ['/parse/cloud'],
    ignore_watch: ['node_modules', 'logs'],
    watch_options: {
      followSymlinks: false
    },
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 1337
    },
    max_memory_restart: '1G',
    exp_backoff_restart_delay: 100
  }]
};