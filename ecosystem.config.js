module.exports = {
  apps: [{
    name: 'parse-server',
    script: './start-server.js',
    instances: process.env.PM2_INSTANCES || 4,
    exec_mode: 'cluster',
    watch: ['/parse/cloud'],
    ignore_watch: ['node_modules', 'logs', 'start-server.js'],
    watch_options: {
      followSymlinks: false
    },
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 1337
    },
    max_memory_restart: '1G',
    exp_backoff_restart_delay: 100,
    // Disable PM2 logs so they go directly to stdout/stderr
    error_file: '/dev/null',
    out_file: '/dev/null',
    // No PM2 formatting
    time: false,
    merge_logs: true,
    log_type: 'raw'
  }]
};