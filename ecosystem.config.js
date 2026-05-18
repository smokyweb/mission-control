module.exports = {
  apps: [{
    name: 'mission-control',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    cwd: 'C:\\Users\\kevin\\projects\\mission-control',
    interpreter: 'node',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
