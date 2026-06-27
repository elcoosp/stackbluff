import path from 'path';

// Use an absolute path in the current working directory
export const TEST_DB_PATH = path.join(process.cwd(), 'stackbluff_test.db');
export const BACKEND_PORT = 3000;
export const FRONTEND_PORT = 5173;
export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
