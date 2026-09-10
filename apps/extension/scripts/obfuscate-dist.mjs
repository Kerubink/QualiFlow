import fs from 'node:fs/promises';
import path from 'node:path';
import { obfuscate } from 'javascript-obfuscator';

const distDir = path.resolve(process.cwd(), 'dist');

const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.7,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: true,
  stringArray: true,
  stringArrayThreshold: 0.8,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(fullPath);
      return fullPath;
    })
  );
  return files.flat();
}

async function obfuscateFile(filePath) {
  if (!filePath.endsWith('.js')) return;

  const source = await fs.readFile(filePath, 'utf8');
  const result = obfuscate(source, obfuscationOptions).getObfuscatedCode();
  await fs.writeFile(filePath, result, 'utf8');
}

async function main() {
  const files = await walk(distDir);
  const jsFiles = files.filter((file) => file.endsWith('.js'));

  await Promise.all(jsFiles.map(obfuscateFile));
  console.log(`[obfuscate] ${jsFiles.length} arquivo(s) .js ofuscado(s) em dist/.`);
}

main().catch((error) => {
  console.error('[obfuscate] Falha:', error);
  process.exit(1);
});
