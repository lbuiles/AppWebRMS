// Genera src/app/core/build-info.ts con la fecha de compilación y el commit actual.
// Uso: node scripts/build-info.mjs          -> escribe los datos reales
//      node scripts/build-info.mjs --reset  -> deja el archivo vacío (como en git)
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const archivo = join(raiz, 'src', 'app', 'core', 'build-info.ts');
const cabecera =
  '// Datos de la compilación del front. Publicar_RMS.bat lo reescribe antes de\n' +
  '// "ng build" (scripts/build-info.mjs) y lo restaura después; en desarrollo queda vacío.\n';

function git(cmd) {
  try { return execSync(`git ${cmd}`, { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return ''; }
}

let fecha = '', commit = '';
if (!process.argv.includes('--reset')) {
  fecha = new Date().toISOString();
  commit = git('rev-parse --short HEAD');
  // Si hay cambios sin commit (fuera de este archivo), se marca con * para saberlo
  const pendientes = git('status --porcelain').split('\n')
    .filter(l => l.trim() && !l.includes('src/app/core/build-info.ts'));
  if (commit && pendientes.length) commit += '*';
}
writeFileSync(archivo, `${cabecera}export const BUILD_INFO = { fecha: '${fecha}', commit: '${commit}' };\n`);
console.log(fecha ? `[build-info] ${fecha} ${commit}` : '[build-info] restaurado');
