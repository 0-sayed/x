import { spawnSync } from 'node:child_process';

const lefthookInstall = spawnSync('lefthook', ['install'], {
  encoding: 'utf8',
  stdio: 'pipe',
});

if (lefthookInstall.status === 0) {
  if (lefthookInstall.stdout) {
    process.stdout.write(lefthookInstall.stdout);
  }
  if (lefthookInstall.stderr) {
    process.stderr.write(lefthookInstall.stderr);
  }
  process.exit(0);
}

const hooksPath = spawnSync('git', ['config', '--global', '--get', 'core.hooksPath'], {
  encoding: 'utf8',
  stdio: 'pipe',
});

const configuredHooksPath = hooksPath.stdout.trim();

if (configuredHooksPath) {
  process.stdout.write(
    `lefthook: skipped install because global core.hooksPath is set to ${configuredHooksPath}\n`,
  );
  process.exit(0);
}

if (lefthookInstall.stdout) {
  process.stdout.write(lefthookInstall.stdout);
}
if (lefthookInstall.stderr) {
  process.stderr.write(lefthookInstall.stderr);
}
if (lefthookInstall.error) {
  process.stderr.write(`lefthook install spawn failed: ${lefthookInstall.error.message}\n`);
}

const hooksPathError = hooksPath.stderr.trim();

if (hooksPathError) {
  process.stderr.write(`git config --global --get core.hooksPath failed: ${hooksPathError}\n`);
}

process.stderr.write('lefthook install failed and no global core.hooksPath override was found.\n');
process.exit(lefthookInstall.status ?? 1);
