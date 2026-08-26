import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = path.resolve(appRoot, '..', '..');
const packageData = JSON.parse(await readFile(path.join(appRoot, 'package.json'), 'utf8'));
const releaseRoot = path.join(workspaceRoot, 'release');
const output = path.join(releaseRoot, `Data Horizon Studio ${packageData.version}-win32-x64`);
const require = createRequire(import.meta.url);
// Electron 44 downloads its platform binary lazily when the module is loaded.
// Resolving package.json alone leaves a clean CI install without a dist folder.
const electronExecutable = require('electron');
const electronDist = path.dirname(electronExecutable);

if (!output.startsWith(`${releaseRoot}${path.sep}`)) throw new Error('Release output escaped the release directory.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(electronDist, output, { recursive: true });

const executable = path.join(output, 'electron.exe');
await rename(executable, path.join(output, 'Data Horizon Studio.exe'));
const appOutput = path.join(output, 'resources', 'app');
await mkdir(appOutput, { recursive: true });
await cp(path.join(appRoot, 'dist'), path.join(appOutput, 'dist'), { recursive: true });
await cp(path.join(appRoot, 'assets'), path.join(appOutput, 'assets'), { recursive: true });
await writeFile(path.join(appOutput, 'package.json'), `${JSON.stringify({
  name: 'data-horizon-studio',
  productName: 'Data Horizon Studio',
  version: packageData.version,
  private: true,
  main: 'dist/main.js'
}, null, 2)}\n`, 'utf8');
await cp(path.join(workspaceRoot, 'docs', `RELEASE_${packageData.version}.md`), path.join(output, 'RELEASE_NOTES.md'));
await cp(path.join(workspaceRoot, 'LICENSE'), path.join(output, 'LICENSE.DATA-HORIZON'));
await cp(path.join(workspaceRoot, 'PRIVACY.md'), path.join(output, 'PRIVACY.md'));
await cp(path.join(workspaceRoot, 'SUPPORT.md'), path.join(output, 'SUPPORT.md'));
await cp(path.join(workspaceRoot, 'THIRD_PARTY_NOTICES.md'), path.join(output, 'THIRD_PARTY_NOTICES.md'));
await writeFile(path.join(output, 'VERSION'), `${packageData.version}\n`, 'utf8');
await writeFile(path.join(output, 'BUILD.txt'), `Data Horizon Studio ${packageData.version}\nWindows x64 release build\nLaunch: Data Horizon Studio.exe\nSource tag: v${packageData.version}\n`, 'utf8');

console.log(output);
