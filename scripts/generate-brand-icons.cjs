// Optional asset-authoring tool. Sharp stays outside application dependencies.
// Usage: node scripts/generate-brand-icons.cjs /path/to/sharp
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { appBuilderPath } = require('app-builder-bin');

async function main() {
  if (!process.argv[2]) throw new Error('Pass the path to an isolated Sharp 0.35.5 installation. See docs/brand-icons.md.');
  const sharp = require(path.resolve(process.argv[2]));
  if (sharp.versions.sharp !== '0.35.5') throw new Error('Use Sharp 0.35.5 for these exports.');
  const root = path.resolve(__dirname, '..');
  const publicDir = path.join(root, 'public');
  const icon = await fs.readFile(path.join(publicDir, 'fthr-icon.svg'), 'utf8');
  const mark = await fs.readFile(path.join(publicDir, 'fthr-mark.svg'), 'utf8');
  const defs = mark.match(/<defs>[\s\S]*?<\/defs>/)?.[0];
  const paths = [...mark.matchAll(/<path\b[^>]*\/>/g)].map(match => match[0]);
  if (!defs || paths.length !== 3) throw new Error('Review the exporter after changing the canonical quill structure.');
  const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><title>fthr</title>${body}</svg>\n`;
  const square = svg(`${defs}<rect width="64" height="64" fill="#08090B"/>${paths.join('')}`);
  // Keep the entire quill, including its stroke, inside the central 80% circle.
  const maskable = svg(`${defs}<rect width="64" height="64" fill="#08090B"/><g transform="translate(8.96 8.96) scale(.72)">${paths.join('')}</g>`);
  const silhouette = paths.map(part => part
    .replace(/url\(#plume\)/g, '#fff')
    .replace(/#0B0B10/g, '#000')).join('');
  const monochrome = svg(`<defs><mask id="quill" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#000"/>${silhouette}</mask></defs><rect width="64" height="64" fill="#000" mask="url(#quill)"/>`);

  function render(source, size, dpi = 72) {
    return sharp(Buffer.from(source), { density: Math.max(72, size * 72 / 64) })
      .resize(size, size).withMetadata({ density: dpi }).png({ compressionLevel: 9 }).toBuffer();
  }

  async function png(name, source, size, dpi) {
    await fs.writeFile(path.join(publicDir, name), await render(source, size, dpi));
  }

  for (const [name, size] of [
    ['favicon-16x16.png', 16], ['favicon-32x32.png', 32],
    ['android-chrome-192x192.png', 192], ['android-chrome-512x512.png', 512],
    ['fthr-desktop.png', 1024],
  ]) await png(name, icon, size);
  await png('apple-touch-icon.png', square, 180);
  await png('mstile-150x150.png', square, 150);
  await png('fthr-maskable-512x512.png', maskable, 512);
  await png('fthrTrayTemplate.png', monochrome, 16, 72);
  await png('fthrTrayTemplate@2x.png', monochrome, 32, 144);
  await fs.writeFile(path.join(publicDir, 'fthr-maskable.svg'), maskable);
  await fs.writeFile(path.join(publicDir, 'safari-pinned-tab.svg'), monochrome);
  // Preserve existing public URLs while retiring their older artwork.
  await fs.writeFile(path.join(publicDir, 'logo.svg'), mark);
  await fs.writeFile(path.join(publicDir, 'svg-logo.svg'), mark);

  // ICO contains individually rendered PNG frames, including small tray sizes.
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const frames = await Promise.all(sizes.map(size => render(icon, size)));
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  frames.forEach((frame, index) => {
    const entry = 6 + index * 16;
    directory[entry] = directory[entry + 1] = sizes[index] === 256 ? 0 : sizes[index];
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(frame.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  await fs.writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([directory, ...frames]));

  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'fthr-icons-'));
  const { stdout } = await promisify(execFile)(appBuilderPath, ['icon', '--format', 'icns',
    '--input', path.join(publicDir, 'fthr-desktop.png'), '--root', root, '--out', temporary]);
  const result = JSON.parse(stdout);
  if (result.error || result.isFallback || !result.icons?.length) {
    throw new Error(`Icon conversion failed: ${result.error || 'no generated icon'}`);
  }
  await fs.copyFile(result.icons[0].file, path.join(publicDir, 'fthr.icns'));
  console.log('Exported fthr browser, install, desktop and tray artwork from the canonical SVGs.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
