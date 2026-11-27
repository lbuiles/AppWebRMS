import { Page, Route } from '@playwright/test';

/**
 * Simula la API para probar el front sin backend ni Google:
 * - deja una sesión RMS guardada (token de 10 horas) con permisos amplios,
 * - responde /api/graphql según el nombre de la operación,
 * - bloquea cualquier llamada externa (Google, fuentes).
 */

const USUARIO = {
  id: '00000000-0000-0000-0000-000000000001',
  nombre: 'USUARIO PRUEBAS',
  email: 'pruebas@rmscolombia.com',
  fotoUrl: '',
  permisos: [
    'admin', 'proyectos.leer', 'admin.usuarios.leer', 'admin.clientes.leer', 'admin.contratistas.leer',
    'proyectos.gerente', 'proyectos.editar', 'proyectos.energia', 'proyectos.civiles', 'proyectos.telecom',
    'proyectos.cuadrillas.ver', 'proyectos.cuadrillas.programar', 'proyectos.cuadrillas.kpi', 'tareas.ver'
  ]
};

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function tokenFalso(horas = 10): string {
  const ahora = Math.floor(Date.now() / 1000);
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ iss: 'rms-erp', aud: 'rms-erp-app', exp: ahora + horas * 3600, email: USUARIO.email })}.firma`;
}

export const PROYECTO = {
  id: '10000000-0000-0000-0000-000000000001', codigo: 'E-001', nombre: 'Subestación de prueba', estado: 'EN_EJECUCION',
  numeroOC: 'OC-123', valorOC: 1000000, valorFacturado: 250000, valorGasto: 100000, porcentajeAvanceFinanciero: 25, utilidad: 0,
  fechaAsignacion: '2026-11-01T00:00:00.000Z', fechaRespuestaCliente: null, fechaSolicitudPermisos: null, fechaVisitaTecnica: null,
  fechaEnvioPermiso: null, fechaAprobacionPermisos: null, fechaEnvioPresupuesto: null, fechaAprobacionPresupuesto: null,
  fechaInicioActividades: null, fechaInicioObra: null, fechaTentativaFin: null, fechaFinalizacionActividades: null,
  anticiposDirectos: [], cortesFacturacion: [], ordenesTrabajo: [], requisiciones: [],
  supervisorCliente: null, contratista: null, ejecutorInternoId: null, ejecutorInterno: null, polizas: null, centroDeCostos: null,
  cierreTecnicoAprobado: false, costoRealTotal: 0, dossierEntregado: false, liquidacionTerminada: false, facturacionCompletada: false,
  cliente: { id: '20000000-0000-0000-0000-000000000001', razonSocial: 'Cliente de prueba' },
  responsable: { id: USUARIO.id, nombre: USUARIO.nombre }, observaciones: [], archivado: false, lineaNegocio: 'ENERGIA'
};

const RESPUESTAS: Record<string, unknown> = {
  GetMenuConfig: { menuConfig: [
    { id: 1, nombre: 'Panel de Control', ruta: '/panel', icono: 'M3 12l2-2', slugRaiz: 'proyectos', orden: 1 },
    { id: 2, nombre: 'Proyectos', ruta: '/proyectos', icono: 'M3 12l2-2', slugRaiz: 'proyectos', orden: 2 }
  ] },
  VersionApi: { versionApi: { fecha: '2026-11-27T13:00:00Z', commit: 'abc1234' } },
  GetCategoriasProyecto: { categoriasProyecto: [
    { id: 'energia', nombre: 'Energía', descripcion: 'Proyectos eléctricos', icono: 'M3 12l2-2', cantidadActivos: 1,
      presupuestoTotal: 1000000, colorTema: 'text-amber-600', bgTema: 'bg-amber-50', permisoRequerido: 'proyectos.energia' }
  ] },
  GetProyectos: { proyectos: [PROYECTO] },
  GetProyectosArchivados: { proyectos: [] },
  CrearProyecto: { addProyecto: { id: '40000000-0000-0000-0000-000000000001', codigo: 'E-999', nombre: 'Proyecto nuevo', estado: 'PENDIENTE', lineaNegocio: 'energia' } },
  BuscarProyectos: { proyectos: [PROYECTO] },
  AddCorteFacturacion: { addCorteFacturacion: { id: '30000000-0000-0000-0000-000000000001', proyectoId: PROYECTO.id, valorCorte: 150000,
    numeroFactura: 'FV-PRUEBA-1', observaciones: null, estado: 'REGISTRADO', fechaCorte: '2026-11-27T00:00:00.000Z',
    registradoPor: { id: USUARIO.id, nombre: USUARIO.nombre } } },
  GetDatosFormulario: { clientesTracker: [PROYECTO.cliente], usuariosTracker: [{ id: USUARIO.id, nombre: USUARIO.nombre }], contratistaProveedores: [] }
};

/** Prepara la página: sesión guardada, API simulada y red externa bloqueada. Devuelve las operaciones pedidas. */
export async function prepararSesion(page: Page, conSesion = true): Promise<string[]> {
  const operaciones: string[] = [];
  if (conSesion) {
    const token = tokenFalso();
    await page.addInitScript(([u, t]) => {
      localStorage.setItem('rms_user', u);
      localStorage.setItem('rms_token', t);
    }, [JSON.stringify(USUARIO), token]);
  }
  await page.route('**/*', (route: Route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost')) return route.fallback();
    return route.abort();
  });
  await page.route('**/api/graphql', async (route: Route) => {
    const cuerpo = route.request().postDataJSON() ?? {};
    const op: string = cuerpo.operationName ?? '';
    operaciones.push(op);
    let data = RESPUESTAS[op];
    if (data === undefined) {
      // Operación sin respuesta definida: devuelve una lista vacía en su primer campo
      const campo = /{\s*(\w+)/.exec(String(cuerpo.query ?? '').replace(/^[^{]*/, ''))?.[1];
      data = campo ? { [campo]: [] } : {};
    }
    // Demora como la de una red real: sin ella, una pantalla que no se refresca sola puede pasar la prueba
    await new Promise(r => setTimeout(r, 300));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  await page.route('**/api/auth/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: tokenFalso(), expira: '' }) }));
  return operaciones;
}
