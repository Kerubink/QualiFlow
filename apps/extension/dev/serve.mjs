// Servidor estatico minimo (sem dependencias) para o playground de desenvolvimento.
// Serve apenas /dev e /src de apps/extension, somente em 127.0.0.1.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5174;
const ALLOWED = ['dev', 'src'];
const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

const server = createServer(async (req, res) => {
    try {
        let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (pathname === '/') {
            res.writeHead(302, { Location: '/dev/' });
            res.end();
            return;
        }
        if (pathname.endsWith('/')) pathname += 'index.html';
        const rel = normalize(pathname).replace(/^[/\\]+/, '');
        const file = join(ROOT, rel);
        const top = rel.split(/[/\\]/)[0];
        if (!file.startsWith(ROOT) || !ALLOWED.includes(top)) {
            res.writeHead(403).end('Forbidden');
            return;
        }
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(body);
    } catch {
        res.writeHead(404).end('Not found');
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Playground do QualiFlow: http://127.0.0.1:${PORT}/dev/`);
});
