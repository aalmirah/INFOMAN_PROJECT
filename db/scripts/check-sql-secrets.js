'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const bcryptHash = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{20,}/;
const argonHash = /\$argon2(?:id|i|d)\$/i;
const passwordAssignment = /\bpassword\s*=/i;

function stagedSqlFiles() {
  const output = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--', '*.sql'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  return output.split(/\r?\n/).filter(Boolean);
}

function main() {
  const files = stagedSqlFiles();
  if (!files.length) {
    console.log('No staged SQL files to check.');
    return;
  }

  const violations = [];
  for (const file of files) {
    const contents = execFileSync('git', ['show', `:${file}`], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    contents.split(/\r?\n/).forEach((line, index) => {
      if (bcryptHash.test(line) || argonHash.test(line) || passwordAssignment.test(line)) {
        violations.push(`${file}:${index + 1}`);
      }
    });
  }

  if (violations.length) {
    console.error('Refusing staged SQL containing a password assignment or bcrypt/Argon2 hash:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  console.log(`SQL secret check passed for ${files.length} staged SQL file(s).`);
}

try {
  main();
} catch (error) {
  console.error(`SQL secret check failed: ${error.message}`);
  process.exitCode = 1;
}
