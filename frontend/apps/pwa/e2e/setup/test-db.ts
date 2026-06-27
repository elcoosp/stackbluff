import fs from 'fs';
import { TEST_DB_PATH } from '../config';

export function resetDatabase() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}
