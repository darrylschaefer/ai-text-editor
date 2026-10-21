// Run with the project's Electron executable. This renders an already exported
// print-ready HTML file, without a visible window or a printer interaction.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const [input, output] = process.argv.slice(2);
if (!input || !output || !input.endsWith('.html') || !output.endsWith('.pdf')) {
  console.error('Usage: electron scripts/render-print-export.cjs input.html output.pdf');
  app.exit(1);
} else {
  app.whenReady().then(async () => {
    const window = new BrowserWindow({ show: false, width: 1280, height: 900,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    try {
      await window.loadFile(path.resolve(input));
      await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
      const pdf = await window.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true,
        displayHeaderFooter: false, scale: 1, margins: { top: 0, right: 0, bottom: 0, left: 0 } });
      await fs.writeFile(path.resolve(output), pdf);
      console.log(JSON.stringify({ output: path.resolve(output), bytes: pdf.length }));
      window.destroy(); app.quit();
    } catch (error) { console.error(error.message); window.destroy(); app.exit(1); }
  });
}
