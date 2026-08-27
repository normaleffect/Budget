/* Bundles the whole app into one self-contained HTML file.
   Usage:  npx esbuild --version >/dev/null && node tools/build-single-file.mjs dist/ledger.html
   Only needed if you want a single file to host somewhere else. The app itself
   has no build step. */
import * as esbuild from 'esbuild';
import fs from 'fs';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const out = await esbuild.build({
  entryPoints:[`${ROOT}/js/app.js`], bundle:true, format:'iife', write:false,
  target:'es2020', minify:false, legalComments:'none'
});
let js = out.outputFiles[0].text;
const css = fs.readFileSync(`${ROOT}/styles.css`,'utf8');
let html = fs.readFileSync(`${ROOT}/index.html`,'utf8');
// take only what lives inside <body>
const body = html.split('<body>')[1].split('</body>')[0]
  .replace(/<script[\s\S]*?<\/script>/g,'');
const page = `<title>Ledger</title>
<style>
${css}
/* the artifact host paints its own ground behind the page */
html,body{min-height:100%;}
</style>
${body}
<script type="module">
${js}
</script>
`;
const dest = process.argv[2] || 'ledger.html';
fs.mkdirSync(new URL('.', `file://${dest.startsWith('/') ? dest : process.cwd() + '/' + dest}`).pathname, { recursive: true });
fs.writeFileSync(dest, page);
console.log('bytes', page.length);
