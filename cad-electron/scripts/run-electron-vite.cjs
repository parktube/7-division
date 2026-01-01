const { spawn } = require('child_process');

const args = process.argv.slice(2);
const env = { ...process.env };

// Ensure Electron runs in app mode even if the shell exported this.
delete env.ELECTRON_RUN_AS_NODE;

const bin = require.resolve('electron-vite/bin/electron-vite.js');

const child = spawn(process.execPath, [bin, ...args], {
  stdio: 'inherit',
  env,
});

child.on('error', (err) => {
  console.error('Failed to start electron-vite:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
