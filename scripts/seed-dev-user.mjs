import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const username = 'devuser';
const email = 'devuser@syncroedit.local';
const password = 'Password123!';
const iterations = 100000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const passwordHash = `pbkdf2:${iterations}:${salt.toString('hex')}:${hash.toString('hex')}`;

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const sql = [
  'INSERT INTO users (id, username, email, password, isEmailVerified, email_verified_at)',
  `VALUES (${sqlString(randomUUID())}, ${sqlString(username)}, ${sqlString(email)}, ${sqlString(passwordHash)}, 1, unixepoch())`,
  `ON CONFLICT(username) DO UPDATE SET email = excluded.email, password = excluded.password, isEmailVerified = 1, email_verified_at = unixepoch();`,
].join(' ');

const result = spawnSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'DB', '--local', '--env', 'local', '--command', sql],
  { stdio: 'inherit' }
);

if (result.error) {
  console.error(`Unable to seed the local dev user: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
