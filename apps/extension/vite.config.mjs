import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import manifest from './manifest.json' with { type: 'json' };

// O CRXJS copia os CSS declarados em content_scripts do manifest sem processar @import.
// Este plugin achata os @import locais (tokens.css, content/*.css) no CSS final em dist/.
function inlineContentCssImports() {
  const flatten = (file, seen = new Set()) => {
    if (seen.has(file)) return '';
    seen.add(file);
    const css = readFileSync(file, 'utf8');
    return css.replace(/@import\s+(?:url\()?["']([^"']+)["']\)?\s*;/g, (_, rel) =>
      rel.startsWith('.') ? flatten(resolve(dirname(file), rel), seen) : _
    );
  };
  return {
    name: 'qualiflow-inline-content-css-imports',
    enforce: 'post',
    closeBundle: {
      order: 'post',
      handler() {
        const out = resolve('dist/src/styles/content.css');
        if (existsSync(out)) writeFileSync(out, flatten(resolve('src/styles/content.css')));
      }
    }
  };
}

export default defineConfig({
  plugins: [crx({ manifest }), inlineContentCssImports()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    target: 'es2020'
  }
});
