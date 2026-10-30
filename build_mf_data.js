import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'parsed_portfolio.json'), 'utf-8'));

const schemes = [];
let currentCategory = '';
let currentBroadCategory = ''; // e.g., Equity, Debt, Hybrid

for (const row of data) {
  const name = row['Investorie'];
  if (!name) continue;

  if (name.includes('Portfolio Summary Report') || name.includes('Client:') || name === 'PRIYA RAMANATHAN (AIOPR4716Q)') {
    continue;
  }

  // Detect category headers like "Equity: Flexi Cap"
  if (name.includes(':') && !name.includes('Total')) {
    const parts = name.split(':');
    currentBroadCategory = parts[0].trim();
    currentCategory = parts[1].trim();
    continue;
  }

  if (name.includes('Total') || name === '') {
    continue; // Skip subtotals and blank rows
  }

  const currentValue = row['__EMPTY_8'];
  
  // We only care about holdings that have a non-zero current value, OR the specific Nippon Focused Fund
  if (typeof currentValue === 'number' && (currentValue > 0 || name.includes('Nippon India Focused Fund'))) {
    
    let region = 'Indian';
    let finalCategory = currentCategory;

    if (currentBroadCategory !== 'Equity') {
       region = 'Non-Equity';
    } else if (currentCategory === 'Global') {
       region = 'Foreign';
       // We can refine foreign category based on scheme name
       if (name.includes('Emerging')) finalCategory = 'Emerging Markets';
       else if (name.includes('China')) finalCategory = 'China';
       else finalCategory = 'Global / Developed Markets';
    } else if (currentCategory === 'Sectoral') {
       finalCategory = 'Sectoral \u2013 Infrastructure'; // As per prompt
    }

    schemes.push({
      scheme: name,
      category: finalCategory,
      region: region,
      currentValue: currentValue,
      folio: row['__EMPTY'] || ''
    });
  }
}

// Generate TS file
const tsContent = `export const mfData = ${JSON.stringify(schemes, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, 'src', 'mfData.ts'), tsContent);
console.log('Saved src/mfData.ts');
