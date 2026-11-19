/* Builds dist/preview.html: one self-contained file that runs the app without a server.
   AI steps show the prepared sample output; Retrieval and Verifier run for real in the browser. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const inline = code => code.replace(/<\/(script)/gi, '<\\/$1');

const offline = { statutes: JSON.parse(read('data/statutes.json')), issue_types: JSON.parse(read('data/issue-types.json')), samples: JSON.parse(read('data/samples.json')) };
let html = read('public/index.html');
html = html.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + read('public/styles.css') + '</style>');
html = html.replace('<script src="i18n.js"></script>', () =>
  '<script>window.AB_OFFLINE = ' + inline(JSON.stringify(offline)) + ';</script>\n' +
  '<script>\n' + inline(read('lib/retrieval.js')) + '</script>\n<script>\n' + inline(read('lib/verifier.js')) + '</script>\n' +
  '<script>\n' + inline(read('public/i18n.js')) + '</script>');
html = html.replace('<script src="app.js"></script>', () => '<script>\n' + inline(read('public/app.js')) + '</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/preview.html'), html);
console.log('Wrote dist/preview.html (' + Math.round(html.length / 1024) + ' KB)');
