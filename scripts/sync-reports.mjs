// Copies every report in "csv files/" into public/reports/ and writes a manifest the app loads on start.
// Runs automatically before `npm run dev` and `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'csv files');
const outDir = path.join(root, 'public', 'reports');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const files = fs.existsSync(srcDir)
  ? fs.readdirSync(srcDir).filter(f => /\.(xlsx|xls|csv)$/i.test(f) && !f.startsWith('~$'))
  : [];

for (const f of files) fs.copyFileSync(path.join(srcDir, f), path.join(outDir, f));
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(files, null, 2));

console.log(`sync-reports: ${files.length} file(s) from "csv files/" -> public/reports/`);
