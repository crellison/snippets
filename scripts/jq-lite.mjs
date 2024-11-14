#!/usr/bin/env node
import { readJsonSync } from 'fs-extra/esm';
import { existsSync } from 'node:fs';

const printUsage = () => {
  console.log(`
jq-lite is a simple jq replacement that works with Node.js.
It only supports absolute key paths (e.g. .<key>.<key>.<key>)
If the key is not found, it will return undefined.

Usage: node jq-lite.mjs <filepath> <key>
Examples:
  $ node jq-lite.mjs package.json version
  1.0.0
  $ node jq-lite.mjs package.json dependencies.react
  ^18.3.1`);
};

const parseArgsFromProcess = async () => {
  const [key, filepath] = process.argv.slice(2);

  if (key === '-h' || key === '--help') {
    printUsage();
    process.exit(0);
  }

  if (!key.startsWith('.')) {
    console.error('Invalid key');
    printUsage();
    process.exit(1);
  }

  if (!filepath) {
    return { key, json: await readStdin() };
  }

  if (!existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    process.exit(1);
  }

  return { key, json: readJsonSync(filepath) };
};

const jqLite = ({ key, json }) => {
  // Remove the leading dot from the key (maintain compatibility with jq)
  const keys = key.slice(1).split('.');
  let value = json;
  for (const k of keys) {
    if (value === undefined) {
      return undefined;
    }
    value = value[k];
  }
  return JSON.stringify(value, null, 2);
};

const readStdin = () => {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(JSON.parse(data));
    });
  });
};

console.log(jqLite(await parseArgsFromProcess()));
