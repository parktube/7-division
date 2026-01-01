const { spawn } = require('child_process');
const { resolve } = require('path');

const args = process.argv.slice(2);
const env = { ...process.env };

// Ensure Electron runs in app mode even if the shell exported this.
delete env.ELECTRON_RUN_AS_NODE;

const bin = resolve(__dirname, '..', 'node_modules', 'electron-vite', 'bin', 'electron-vite.js');

const child = spawn(process.execPath, [bin, ...args], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
