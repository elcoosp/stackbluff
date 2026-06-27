import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { TEST_DB_PATH, BACKEND_PORT, FRONTEND_PORT, BACKEND_URL, FRONTEND_URL } from '../config';

let backendProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;

function killProcessOnPort(port: number): void {
  try {
    // Find and kill process using the port (macOS/Linux)
    const pid = execSync(`lsof -ti :${port}`, { stdio: 'pipe' }).toString().trim();
    if (pid) {
      console.log(`[Test] Killing process ${pid} on port ${port}`);
      execSync(`kill -9 ${pid}`);
    }
  } catch (e) {
    // No process on port or error, ignore
  }
}

export async function startTestServers(): Promise<void> {
  if (backendProcess) return;

  // Kill any lingering processes on the ports
  killProcessOnPort(BACKEND_PORT);
  killProcessOnPort(FRONTEND_PORT);

  // --- Backend (Rust) ---
  const backendPath = path.join(__dirname, '../../../../..', 'backend');
  if (!fs.existsSync(backendPath)) {
    throw new Error(`Backend not found at ${backendPath}`);
  }

  const dbDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Delete any existing test database to start fresh
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const env = {
    ...process.env,
    DATABASE_URL: `sqlite://${TEST_DB_PATH}?mode=rwc`,
    NODE_ENV: 'test',
    PORT: String(BACKEND_PORT),
    JWT_SECRET: 'test-secret',
    TELEGRAM_BOT_TOKEN: 'dummy',
    STRIPE_WEBHOOK_SECRET: 'dummy',
    R2_ENDPOINT: 'dummy',
    R2_BUCKET: 'dummy',
  };

  console.log('[Test] Starting backend (Rust) with debug build...');
  backendProcess = spawn('cargo', ['run', '--bin', 'sb-server'], {
    env,
    cwd: backendPath,
    stdio: 'pipe',
    shell: true,
  });

  let backendReady = false;
  backendProcess.stdout?.on('data', (data) => {
    const msg = data.toString();
    console.log('[Backend]', msg.trim());
    if (msg.includes('server listening on')) {
      backendReady = true;
      console.log('[Test] Backend is ready');
    }
  });

  backendProcess.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    console.error('[Backend stderr]', msg);
  });

  let attempts = 0;
  while (!backendReady && attempts < 120) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    if (backendProcess.exitCode !== null) {
      throw new Error(`Backend process exited with code ${backendProcess.exitCode}`);
    }
  }
  if (!backendReady) {
    throw new Error('Backend did not become ready within 120 seconds');
  }

  // --- Frontend (Vite) ---
  const frontendPath = path.join(__dirname, '../..');
  if (!fs.existsSync(frontendPath)) {
    throw new Error(`Frontend not found at ${frontendPath}`);
  }

  console.log('[Test] Starting frontend...');
  frontendProcess = spawn('pnpm', ['run', 'dev', '--port', String(FRONTEND_PORT)], {
    env: { ...process.env, NODE_ENV: 'test' },
    cwd: frontendPath,
    stdio: 'pipe',
    shell: true,
  });

  let frontendReady = false;
  frontendProcess.stdout?.on('data', (data) => {
    const msg = data.toString();
    console.log('[Frontend]', msg.trim());
    if (msg.includes('Local:') || msg.includes('ready') || msg.includes('running')) {
      frontendReady = true;
      console.log('[Test] Frontend is ready');
    }
  });

  frontendProcess.stderr?.on('data', (data) => {
    console.error('[Frontend stderr]', data.toString().trim());
  });

  attempts = 0;
  while (!frontendReady && attempts < 60) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    if (frontendProcess.exitCode !== null) {
      throw new Error(`Frontend process exited with code ${frontendProcess.exitCode}`);
    }
  }
  if (!frontendReady) {
    throw new Error('Frontend did not become ready within 60 seconds');
  }
}

export async function stopTestServers(): Promise<void> {
  if (backendProcess) {
    // Kill the entire process group to ensure children are terminated
    try {
      process.kill(-backendProcess.pid, 'SIGKILL');
    } catch (e) {
      // Already dead
    }
    backendProcess = null;
  }
  if (frontendProcess) {
    try {
      process.kill(-frontendProcess.pid, 'SIGKILL');
    } catch (e) {
      // Already dead
    }
    frontendProcess = null;
  }
  // Also kill any remaining processes on the ports
  killProcessOnPort(BACKEND_PORT);
  killProcessOnPort(FRONTEND_PORT);

  // Clean up test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}
