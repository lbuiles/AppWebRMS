// Servidor estático mínimo para las pruebas: sirve dist/rms-app/browser y responde index.html
// en cualquier ruta de la app (como nginx con try_files). Uso: node e2e/servir-dist.mjs [puerto]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../dist/rms-app/browser/', import.meta.url));
const puerto = Number(process.argv[2] ?? 4310);
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.woff2': 'font/woff2' };

createServer(async (req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  let archivo = join(raiz, ruta);
  if (!archivo.startsWith(raiz)) { res.writeHead(403).end(); return; }
  try { if (!(await stat(archivo)).isFile()) throw 0; } catch { archivo = join(raiz, 'index.html'); }
  try {
    res.writeHead(200, { 'Content-Type': tipos[extname(archivo)] ?? 'application/octet-stream' });
    res.end(await readFile(archivo));
  } catch { res.writeHead(404).end(); }
}).listen(puerto, () => console.log(`dist en http://localhost:${puerto}`));
