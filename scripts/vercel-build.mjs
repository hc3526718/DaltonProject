import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const appOutDir = path.join(distDir, 'app');

function run(cmd) {
  // eslint-disable-next-line no-console
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

// Clean dist for deterministic builds
if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
mkdirSync(appOutDir, { recursive: true });

// Build Expo web app into dist/app
run(`npx -y expo export --platform web --output-dir "${appOutDir}"`);

// Copy landing page to dist/index.html
const landingSrc = path.join(root, 'web-landing', 'index.html');
if (!existsSync(landingSrc)) {
  throw new Error(`Missing landing HTML at ${landingSrc}`);
}
copyFileSync(landingSrc, path.join(distDir, 'index.html'));

