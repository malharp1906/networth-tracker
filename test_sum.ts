import { mfData } from './src/mfData.ts';
const sum = mfData.reduce((acc, curr) => acc + curr.currentValue, 0);
console.log('Sum:', sum);
