import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'dist');
const files = ['index.html', 'style.css', 'script.js'];

await mkdir(output, { recursive: true });
// Falhar se houver arquivos inesperados evita publicar sobras por engano.
const extras = (await readdir(output)).filter(name => !files.includes(name));
if (extras.length) throw new Error('dist contém arquivos inesperados. Revise seu conteúdo antes de gerar a publicação.');
for (const file of files) await copyFile(path.join(root, file), path.join(output, file));
console.log(`Publicação preparada em dist: ${files.join(', ')}`);
