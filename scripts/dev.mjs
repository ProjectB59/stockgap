import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['server.mjs', '--api-only'], { stdio: 'inherit' }),
  spawn('npm', ['exec', 'vite'], { stdio: 'inherit', shell: true }),
];

const stop = () => {
  for (const child of children) child.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const result = await Promise.race(children.map((child) => new Promise((resolve) => {
  child.on('exit', (code) => resolve(code ?? 0));
})));
stop();
process.exit(Number(result));
