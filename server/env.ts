import { existsSync } from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';

const rootDir = process.cwd();

loadEnv({ path: path.resolve(rootDir, '.env') });

const localEnvPath = path.resolve(rootDir, '.env.local');
if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath, override: true });
}