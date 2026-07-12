import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stdout } from 'node:process';

const outputDirectory = resolve(import.meta.dirname, '..', 'out');
const expectedPages = ['index.html', 'status/index.html'];

for (const page of expectedPages) {
  if (!existsSync(resolve(outputDirectory, page))) {
    throw new Error(`Missing static export page: ${page}`);
  }
}

const home = readFileSync(resolve(outputDirectory, 'index.html'), 'utf8');
if (!home.includes('/novavend/_next/')) {
  throw new Error('Static assets are not rooted under /novavend');
}
if (!home.includes('Development preview')) {
  throw new Error('Static preview label is missing');
}
if (!home.includes('data-dashboard-marker="novavend-dashboard"')) {
  throw new Error('Dashboard shell marker is missing');
}

const status = readFileSync(
  resolve(outputDirectory, 'status/index.html'),
  'utf8',
);
if (!status.includes('data-status-marker="novavend-status"')) {
  throw new Error('System status marker is missing');
}

stdout.write(`Static export verified: ${expectedPages.join(', ')}\n`);
