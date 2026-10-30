import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const excelPath = path.join(__dirname, 'public', 'portfolio.xlsx');
const buffer = fs.readFileSync(excelPath);
const workbook = XLSX.read(buffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

fs.writeFileSync(path.join(__dirname, 'parsed_portfolio.json'), JSON.stringify(data, null, 2));
console.log('Saved parsed data to parsed_portfolio.json');
