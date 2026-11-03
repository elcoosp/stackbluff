import { closeBrowser } from '../helpers/browser';
import { stopTestServers } from '../helpers/servers';

export default async function globalTeardown() {
  await stopTestServers();
  await closeBrowser();
}
