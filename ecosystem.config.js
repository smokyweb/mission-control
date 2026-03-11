module.exports = {
  apps: [
    {
      name: "mission-control",
      script: "start.js",
      cwd: "C:\\Users\\kevin\\projects\\mission-control",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      error_file: "C:\\Users\\kevin\\projects\\mission-control\\logs\\error.log",
      out_file: "C:\\Users\\kevin\\projects\\mission-control\\logs\\out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
