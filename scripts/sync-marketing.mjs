/** Copy repo-root marketing assets into expo-app/marketing for Vercel (expo-app-only root). */
import { cp } from 'node:fs/promises';
import path from 'node:path';

const expoDir = path.join(import.meta.dirname, '..');
const repoRoot = path.join(expoDir, '..');
const dest = path.join(expoDir, 'marketing');

const htmlPages = [
  'index.html',
  'help-center.html',
  'contact-us.html',
  'contact-team.html',
  'contact-assistant.html',
  'privacy.html',
  'terms.html',
  'cookie-policy.html',
  'features.html',
  'how.html',
  'impact.html',
  'live-chat.html',
  'athlete-agreement.html',
];

await cp(path.join(repoRoot, 'shared'), path.join(dest, 'shared'), { recursive: true });
await cp(path.join(repoRoot, 'showcase'), path.join(dest, 'showcase'), { recursive: true });
for (const f of htmlPages) {
  await cp(path.join(repoRoot, f), path.join(dest, f));
}
console.log('Synced marketing site → expo-app/marketing/');
