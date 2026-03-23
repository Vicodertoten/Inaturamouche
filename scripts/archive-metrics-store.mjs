#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../server/config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function resolvePath(target) {
  if (path.isAbsolute(target)) return target;
  return path.resolve(projectRoot, target);
}

function buildArchiveStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const storeFile = resolvePath(config.metricsStoreFile);
  const archiveDir = path.join(path.dirname(storeFile), 'archives');
  const emptyStore = {
    apiEvents: [],
    clientEvents: [],
  };

  let archivedTo = null;
  let previousCounts = {
    apiEvents: 0,
    clientEvents: 0,
  };

  try {
    const raw = await fs.readFile(storeFile, 'utf8');
    const parsed = JSON.parse(raw);
    previousCounts = {
      apiEvents: Array.isArray(parsed?.apiEvents) ? parsed.apiEvents.length : 0,
      clientEvents: Array.isArray(parsed?.clientEvents) ? parsed.clientEvents.length : 0,
    };

    if (previousCounts.apiEvents > 0 || previousCounts.clientEvents > 0) {
      await fs.mkdir(archiveDir, { recursive: true });
      archivedTo = path.join(archiveDir, `metrics-store-${buildArchiveStamp()}.json`);
      await fs.writeFile(archivedTo, raw, 'utf8');
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await fs.mkdir(path.dirname(storeFile), { recursive: true });
  }

  await fs.writeFile(storeFile, `${JSON.stringify(emptyStore, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        success: true,
        storeFile,
        archivedTo,
        previousCounts,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`metrics archive/reset failed: ${error.message}`);
  process.exitCode = 1;
});
