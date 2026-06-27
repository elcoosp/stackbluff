import { resetDatabase } from './test-db';
import { startTestServers } from '../helpers/servers';

export default async function globalSetup() {
  // Delete the test database to ensure a clean state
  resetDatabase();
  // Start the backend and frontend servers
  await startTestServers();
}
