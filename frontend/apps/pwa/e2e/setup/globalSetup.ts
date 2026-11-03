import { startTestServers } from '../helpers/servers';
import { resetDatabase } from './test-db';

export default async function globalSetup() {
  // Delete the test database to ensure a clean state
  resetDatabase();
  // Start the backend and frontend servers
  await startTestServers();
}
