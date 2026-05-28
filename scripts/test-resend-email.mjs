/**
 * Local-only Resend check (Node). Does not run inside the Expo app.
 *
 * 1. Put your key in expo-app/.env as RESEND_API_KEY=re_... (preferred)
 *    or EXPO_PUBLIC_RESEND_API_KEY=re_... (discouraged name — same security as any secret in .env)
 * 2. Replace re_xxxxxxxxx if you copied a placeholder.
 * 3. Run: npm run test:resend
 *
 * Production post-report email uses Supabase Edge Function `send-post-report-email`
 * with the RESEND_API_KEY secret in the Supabase Dashboard (not this file).
 */
import { config } from 'dotenv';
import { Resend } from 'resend';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const key =
  process.env.RESEND_API_KEY?.trim() || process.env.EXPO_PUBLIC_RESEND_API_KEY?.trim();

if (!key || key === 're_xxxxxxxxx' || key.includes('xxxx')) {
  console.error(
    'Set RESEND_API_KEY (or EXPO_PUBLIC_RESEND_API_KEY) in expo-app/.env to your real Resend key.',
  );
  console.error('Replace re_xxxxxxxxx with the value from https://resend.com/api-keys');
  process.exit(1);
}

const resend = new Resend(key);

const { data, error } = await resend.emails.send({
  from: 'onboarding@resend.dev',
  to: 'haydncampbell22@gmail.com',
  subject: 'Hello World',
  html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
});

if (error) {
  console.error('Resend error:', error);
  process.exit(1);
}

console.log('Sent:', data);
