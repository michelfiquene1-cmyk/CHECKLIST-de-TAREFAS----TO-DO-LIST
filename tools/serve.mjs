import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'],
    '/script.js': ['script.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
export function createServer(directory = root) {
    return http.createServer(async (req, res) => {
        const entry = files[new URL(req.url, 'http://localhost').pathname];
        if (!entry) { res.writeHead(404); res.end('Não encontrado'); return; }
        try {
            const content = await readFile(path.join(directory, entry[0]));
            res.writeHead(200, { 'Content-Type': `${entry[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
            res.end(content);
        } catch { res.writeHead(500); res.end('Falha na leitura'); }
    });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    createServer().listen(4173, '127.0.0.1', () => console.log('Checklist: http://localhost:4173'));
}
