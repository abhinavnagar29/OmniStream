const { spawn } = require('node:child_process');
const net = require('node:net');

function run(cmd, args, extraEnv) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });
  child.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
  return child;
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ port, host: '127.0.0.1' }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function main() {
  const frontendPort = 3002;
  const backendPort = 5050;

  const [frontOk, backOk] = await Promise.all([
    checkPortAvailable(frontendPort),
    checkPortAvailable(backendPort),
  ]);

  if (!frontOk || !backOk) {
    const parts = [];
    if (!frontOk) parts.push(`Frontend port ${frontendPort} is already in use.`);
    if (!backOk) parts.push(`Backend port ${backendPort} is already in use.`);
    parts.push('Stop the process using the port(s), then re-run: npm run dev');
    // eslint-disable-next-line no-console
    console.error(parts.join('\n'));
    process.exit(1);
  }

  const backend = run('node', ['server.js'], { PORT: String(backendPort) });
  const frontend = run('npx', ['vite', '--port', String(frontendPort), '--strictPort'], {});

  const shutdown = () => {
    try {
      backend.kill('SIGINT');
    } catch (_) {
      // ignore
    }
    try {
      frontend.kill('SIGINT');
    } catch (_) {
      // ignore
    }
  };

  process.on('SIGINT', () => {
    shutdown();
  });
  process.on('SIGTERM', () => {
    shutdown();
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
