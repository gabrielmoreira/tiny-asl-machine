import { execFileSync } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function command(binary, args, options = {}) {
  return execFileSync(binary, args, { cwd: projectRoot, stdio: 'inherit', ...options });
}

export function capture(binary, args) {
  return command(binary, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function pnpm(args) {
  const executable =
    process.env.npm_execpath ||
    process.env.PNPM_BINARY ||
    capture(process.platform === 'win32' ? 'mise.exe' : 'mise', ['which', 'pnpm']);
  if (!isAbsolute(executable) || /\.(cmd|bat)$/i.test(executable)) {
    throw new Error('pnpm must resolve to an absolute native executable or JavaScript launcher');
  }
  const jsLauncher = /\.(cjs|mjs|js)$/i.test(executable);
  const pnpmArgs = ['--config.verify-deps-before-run=false', ...args];
  command(
    jsLauncher ? process.execPath : executable,
    jsLauncher ? [executable, ...pnpmArgs] : pnpmArgs,
    {
      // Frozen installation already happened; a temporary release version must not trigger reinstall.
      env: { ...process.env, npm_config_verify_deps_before_run: 'false' },
    }
  );
}

export async function registryMetadata(version) {
  const response = await fetch(
    `https://registry.npmjs.org/tiny-asl-machine/${encodeURIComponent(version)}`,
    {
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`npm metadata request failed: HTTP ${response.status}`);
  return await response.json();
}

export function releaseTarball(version) {
  return resolve(projectRoot, '.local/release', `tiny-asl-machine-${version}.tgz`);
}
