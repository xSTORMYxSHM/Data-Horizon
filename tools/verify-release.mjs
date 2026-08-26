import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const packageFiles = [
  'package.json',
  'apps/studio-desktop/package.json',
  'packages/project-model/package.json',
  'packages/audio-modulation/package.json',
  'packages/render-runtime/package.json',
  'packages/export-runtime/package.json'
];
const failures = [];
const packages = await Promise.all(packageFiles.map(async (file) => ({ file, data: JSON.parse(await read(file)) })));
const version = packages[0].data.version;
const tempestManifest = JSON.parse(await read('tempest.app.json'));
const studioPackage = packages.find((item) => item.file === 'apps/studio-desktop/package.json')?.data;

if (!/^\d+\.\d+\.\d+$/.test(version)) failures.push(`Root version is not stable semver: ${version}`);
for (const item of packages) if (item.data.version !== version) failures.push(`${item.file} has ${item.data.version}; expected ${version}`);
for (const item of packages) if (item.data.license !== 'GPL-3.0-only') failures.push(`${item.file} must declare GPL-3.0-only.`);
if (tempestManifest.version !== version) failures.push(`tempest.app.json has ${tempestManifest.version}; expected ${version}`);
if (tempestManifest.state !== 'release') failures.push('tempest.app.json must declare release state for a stable Git release.');
if (!/^\d+\.\d+\.\d+$/.test(studioPackage?.devDependencies?.electron ?? '')) failures.push('Electron must be pinned to an exact stable version.');
if (packages[0].data.engines?.node !== '>=22.12.0') failures.push('The public build requires Node.js >=22.12.0.');

const sourceChecks = [
  ['packages/project-model/src/index.ts', `DATA_HORIZON_VERSION = '${version}'`],
  ['apps/studio-desktop/src/renderer/index.html', `DATA HORIZON ${version}`],
  ['apps/studio-desktop/src/renderer/app.ts', `Version ${version}`],
  ['.github/workflows/release.yml', 'actions/attest@v4'],
  ['.github/workflows/release.yml', 'attestations: write'],
  ['.github/workflows/release.yml', `release/Data-Horizon-Studio-${version}-win32-x64-release.zip`],
  ['README.md', `Current development build: **${version}**`],
  ['docs/VERSIONING.md', `Current build: \`${version}\``],
  [`docs/RELEASE_${version}.md`, `# Data Horizon Studio ${version}`],
  ['CHANGELOG.md', `## [${version}]`],
  ['LICENSE', 'GNU GENERAL PUBLIC LICENSE']
];
for (const [file, expected] of sourceChecks) {
  const contents = await read(file);
  if (!contents.includes(expected)) failures.push(`${file} is missing release marker: ${expected}`);
}

for (const file of ['.gitattributes', '.github/dependabot.yml', '.github/workflows/ci.yml', '.github/workflows/release.yml', '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/feature_request.yml', '.github/pull_request_template.md', 'CONTRIBUTING.md', 'PRIVACY.md', 'SECURITY.md', 'SUPPORT.md', 'THIRD_PARTY_NOTICES.md', 'docs/INSTALLATION.md', 'docs/PUBLIC_RELEASE_CHECKLIST.md']) {
  try { await access(path.join(root, file)); } catch { failures.push(`Missing Git release file: ${file}`); }
}

const textExtensions = new Set(['.cjs', '.css', '.html', '.js', '.json', '.md', '.mjs', '.ps1', '.ts', '.txt', '.yaml', '.yml']);
const trackedFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of trackedFiles) {
  const basename = path.basename(file).toLowerCase();
  if ((basename.startsWith('.env') && basename !== '.env.example') || /\.(pem|key|p12|pfx)$/i.test(file)) failures.push(`Sensitive file type is tracked: ${file}`);
  if (!textExtensions.has(path.extname(file).toLowerCase()) && !['.gitattributes', '.gitignore'].includes(basename)) continue;
  const contents = await read(file);
  if (/C:\\Users\\|[A-Z]:\\OneDrive\\/i.test(contents)) failures.push(`${file} contains a machine-specific absolute path.`);
  if (/-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}/.test(contents)) failures.push(`${file} appears to contain a credential or private key.`);
}

const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : process.env.DATA_HORIZON_RELEASE_TAG;
if (tag && tag !== `v${version}`) failures.push(`Release tag ${tag} does not match package version v${version}`);

if (failures.length) {
  console.error(`Release verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`Release contract verified for Data Horizon Studio ${version}${tag ? ` (${tag})` : ''}.`);
