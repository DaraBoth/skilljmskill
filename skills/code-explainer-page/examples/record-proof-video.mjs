// Generic before/after proof recorder for the code-explainer page.
// Usage: node record-proof-video.mjs <output-folder> <label>
//   BASE_URL                 the app to record (default http://localhost:3000)
//   APP_USER / APP_PASSWORD  optional sign-in, read from the environment, never printed
// Install once in your project: npm i -D playwright && npx playwright install chromium
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'proof';
const LABEL = process.argv[3] || 'after';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const viewport = { width: 1280, height: 800 };

// Optional sign-in in its own context, so the login screen is not in the video.
let storageState;
if (process.env.APP_USER && process.env.APP_PASSWORD) {
  const login = await browser.newContext({ viewport });
  const lp = await login.newPage();
  await lp.goto(`${BASE}/login`);
  await lp.getByLabel(/email|user/i).fill(process.env.APP_USER);
  await lp.getByLabel(/password/i).fill(process.env.APP_PASSWORD);
  await lp.getByRole('button', { name: /sign in|log in/i }).click();
  await lp.waitForURL((u) => !/login/i.test(u.toString()), { timeout: 30000 });
  storageState = await login.storageState();
  await login.close();
}

const ctx = await browser.newContext({ viewport, storageState, recordVideo: { dir: OUT, size: viewport } });
const page = await ctx.newPage();

// A caption bar at the bottom says what is measured at each step.
const caption = (text) => page.evaluate((text) => {
  let el = document.getElementById('__proof_caption');
  if (!el) {
    el = document.createElement('div');
    el.id = '__proof_caption';
    el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#111d;color:#fff;font:600 17px/1.4 sans-serif;padding:10px 16px;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = text;
}, text);

// ---- Adapt these steps to your change. Use the SAME steps for before and after. ----
const steps = [];
await page.goto(`${BASE}/cart`);
await page.waitForSelector('[data-test=cart-total]'); // wait for the element before measuring
const total = (await page.textContent('[data-test=cart-total]'))?.trim();
steps.push(`${LABEL}: cart total shows ${total}`);
await caption(`${LABEL.toUpperCase()}: shirt $10, discount $2, total shows ${total} (expected $8)`);
await page.waitForTimeout(3000);
// -------------------------------------------------------------------------------------

const video = page.video();
await ctx.close();
await browser.close();
const dest = path.join(OUT, `${LABEL}.webm`);
fs.renameSync(await video.path(), dest);
console.log(steps.join('\n'));
console.log(`video: ${dest} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
