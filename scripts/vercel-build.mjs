/**
 * Vercel build (personaproject): full marketing site at / + Expo web app at /app.
 * Marketing assets live in the parent repo (index.html, shared/, showcase/).
 */
import { execSync } from 'node:child_process';
import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const expoDir = process.cwd();
const repoRoot = path.join(expoDir, '..');
const distDir = path.join(expoDir, 'dist');
const appOutDir = path.join(distDir, 'app');

async function copyDir(src, dest) {
  await cp(src, dest, { recursive: true });
}

function run(cmd, cwd, env = process.env) {
  // eslint-disable-next-line no-console
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd, env, stdio: 'inherit' });
}

function runMarketingUiBuild() {
  const marketingDir = path.join(repoRoot, 'marketing-ui');
  if (!existsSync(marketingDir)) {
    console.warn('[vercel-build] marketing-ui/ missing — StaggeredMenu bundle skipped.');
    return;
  }
  console.log('[vercel-build] Building marketing-ui');
  run('npm install && npm run build', marketingDir);
}

function runExpoExport() {
  const env = {
    ...process.env,
    CI: 'true',
    EXPO_WEB_BASE_PATH: '/app',
    EXPO_PUBLIC_WEB_BASE_PATH: process.env.EXPO_PUBLIC_WEB_BASE_PATH || '/app',
    SENTRY_DISABLE_AUTO_UPLOAD: 'true',
    EXPO_NO_TELEMETRY: '1',
    NODE_OPTIONS: [process.env.NODE_OPTIONS ?? '', '--max-old-space-size=8192'].filter(Boolean).join(' '),
  };
  console.log('[vercel-build] expo export → dist/app');
  run(`npx -y expo export --platform web --output-dir "${appOutDir}"`, expoDir, env);
}

async function copyMarketingSite() {
  const entries = await readdir(repoRoot, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith('.html')) continue;
    await cp(path.join(repoRoot, ent.name), path.join(distDir, ent.name));
  }

  const sharedSrc = path.join(repoRoot, 'shared');
  if (existsSync(sharedSrc)) {
    await copyDir(sharedSrc, path.join(distDir, 'shared'));
  }

  const showcaseSrc = path.join(repoRoot, 'showcase');
  if (existsSync(showcaseSrc)) {
    await copyDir(showcaseSrc, path.join(distDir, 'showcase'));
  } else {
    console.warn('[vercel-build] showcase/ missing — carousel images skipped.');
  }

  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const supabaseAnon = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  await writeFile(
    path.join(distDir, 'shared', 'dalton-contact-config.js'),
    `window.__DALTON_CONTACT_CONFIG__=${JSON.stringify({ supabaseUrl, anonKey: supabaseAnon })};\n`,
    'utf8',
  );
  if (!supabaseUrl || !supabaseAnon) {
    console.warn('[vercel-build] EXPO_PUBLIC_SUPABASE_* unset — contact form may stay disabled.');
  }

  console.log('[vercel-build] Marketing site copied (index.html + shared + showcase)');
}

async function main() {
  if (!existsSync(path.join(repoRoot, 'index.html'))) {
    throw new Error(
      `Missing ${path.join(repoRoot, 'index.html')}. ` +
        'Set Vercel Root Directory to expo-app inside the full repo, not a standalone expo-app checkout.',
    );
  }

  const { rmSync, mkdirSync } = await import('node:fs');
  if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
  mkdirSync(appOutDir, { recursive: true });

  runMarketingUiBuild();
  runExpoExport();
  await copyMarketingSite();

  console.log('[vercel-build] Done:', distDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
