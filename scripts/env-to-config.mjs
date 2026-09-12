import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function readEnv(name) {
  if (!existsSync('.env')) return '';
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)$/);
    if (match && match[1] === name) return match[2].replace(/^["']|["']$/g, '').trim();
  }
  return '';
}

const key = readEnv('GOOGLE_MAPS_API_KEY');

writeFileSync(
  'config.js',
  `// AUTO-GENERIERT aus .env – nicht committen (steht in .gitignore)\nexport const GOOGLE_MAPS_API_KEY = ${JSON.stringify(key)};\n`,
);

console.log(`config.js geschrieben (Key ${key ? 'gesetzt' : 'leer'})`);
