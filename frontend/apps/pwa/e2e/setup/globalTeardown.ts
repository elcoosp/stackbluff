import { stopTestServers } from '../helpers/servers';
import { closeBrowser } from '../helpers/browser';

export default async function globalTeardown() {
  await stopTestServers();
  await closeBrowser();
}
