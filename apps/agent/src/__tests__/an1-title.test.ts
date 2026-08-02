import { An1Scraper } from '../scrapers/adapters.js';
const cases: Array<[string,string]> = [
  ['Download Idle Miner Tycoon (MOD, Unlimited Coins) 5.60.0 free on android','Idle Miner Tycoon'],
  ['Download Sniper 3D: Fun Free Online FPS (MOD, Unlimited Coins) 4.35.1 free on android','Sniper 3D: Fun Free Online FPS'],
  ['Download ZEPETO free on android','ZEPETO'],
  ['Download My Little Universe (MOD, Unlimited Resources) 2.9.0 free on android','My Little Universe'],
  ['Traffic Racer Open World (MOD, Unlimited Money) 1.4','Traffic Racer Open World'],
];
let ok=0;
for (const [input,expected] of cases) {
  const got = An1Scraper.cleanTitle(input);
  const pass = got===expected; ok+=pass?1:0;
  console.log(`${pass?'✓':'✗'} "${got}"${pass?'':`  (expected "${expected}")`}`);
}
console.log(`${ok}/${cases.length} passed`);
process.exit(ok===cases.length?0:1);
