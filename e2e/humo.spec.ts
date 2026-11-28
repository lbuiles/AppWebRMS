import { test, expect } from '@playwright/test';
import { prepararSesion, PROYECTO } from './simulador';

/**
 * Pruebas de humo: se corren contra la compilación de producción (dist) antes de publicar.
 * Cubren lo que ya falló alguna vez: arranque, sesión, pantallas que no se refrescaban
 * (zone.js tras Angular 22) y el aviso de cambios sin guardar.
 */

test('sin sesión, la app lleva al inicio de sesión', async ({ page }) => {
  await prepararSesion(page, false);
  await page.goto('/panel');
  await expect(page).toHaveURL(/\/login/);
});

test('con sesión carga el panel, el menú y la versión', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', e => errores.push(e.message));
  await prepararSesion(page);
  await page.goto('/panel');
  await expect(page.getByText('USUARIO PRUEBAS').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Proyectos' }).first()).toBeVisible();
  await expect(page.getByText(/API v2026\.11\.27/)).toBeVisible();
  expect(errores).toEqual([]);
});

test('Proyectos muestra las divisiones con un solo clic', async ({ page }) => {
  await prepararSesion(page);
  await page.goto('/panel');
  await page.getByRole('link', { name: 'Proyectos' }).first().click();
  await expect(page.getByText('Energía').first()).toBeVisible({ timeout: 5000 });
});

test('el Tracker lista los proyectos y abre el panel de un proyecto', async ({ page }) => {
  await prepararSesion(page);
  await page.goto('/proyectos/energia');
  const fila = page.getByText('Subestación de prueba').first();
  await expect(fila).toBeVisible();
  await fila.click();
  await expect(page.getByText('E-001').first()).toBeVisible();
});

test('el panel del proyecto avisa antes de descartar cambios sin guardar', async ({ page }) => {
  await prepararSesion(page);
  await page.goto('/proyectos');
  await page.getByRole('button', { name: 'Ingresar al Portafolio' }).first().click();
  await page.getByText('Subestación de prueba').first().click();

  const centro = page.locator('[formcontrolname="centroDeCostos"]');
  await expect(centro).toBeVisible();
  await centro.fill('CC-PRUEBA');

  // Clic en el fondo oscuro: pregunta y, con "Seguir editando", conserva lo escrito
  await page.mouse.click(5, 300);
  await expect(page.getByText('Cambios sin guardar')).toBeVisible();
  await page.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(centro).toHaveValue('CC-PRUEBA');

  // El botón Atrás del navegador también pregunta; con "Descartar cambios" sale del Tracker
  await page.goBack();
  await expect(page.getByText('Cambios sin guardar')).toBeVisible();
  await page.getByRole('button', { name: 'Descartar cambios' }).click();
  await expect(page).toHaveURL(/\/proyectos$/);
});

test('Crear Proyecto abre su ventana y avisa al cancelar con datos escritos', async ({ page }) => {
  await prepararSesion(page);
  await page.goto('/proyectos/energia');
  await page.getByRole('button', { name: 'Crear Proyecto' }).click();
  const codigo = page.locator('[formcontrolname="codigo"]');
  await expect(codigo).toBeVisible();
  await codigo.fill('E-999');
  await page.getByRole('button', { name: 'Cancelar' }).first().click();
  await expect(page.getByText('Cambios sin guardar')).toBeVisible();
  await page.getByRole('button', { name: 'Descartar cambios' }).click();
  await expect(codigo).toBeHidden();
});

test('Crear Proyecto envía los campos vacíos como null (la API espera Guid?, no "")', async ({ page }) => {
  await prepararSesion(page);
  await page.goto('/proyectos/energia');
  await page.getByRole('button', { name: 'Crear Proyecto' }).click();
  await page.locator('[formcontrolname="codigo"]').fill('E-999');
  await page.locator('[formcontrolname="nombre"]').fill('Proyecto nuevo');
  await page.locator('[formcontrolname="clienteNombre"]').fill('Cliente de prueba');
  const peticion = page.waitForRequest(r => r.url().includes('/api/graphql') && r.postDataJSON()?.operationName === 'CrearProyecto');
  await page.getByRole('button', { name: 'Guardar Proyecto' }).click();
  const input = (await peticion).postDataJSON().variables.input;
  expect(input.responsableId).toBeNull();
  expect(Object.values(input)).not.toContain('');
  expect(input.lineaNegocio).toBe('energia');
  await expect(page.getByText('¡Proyecto Creado!')).toBeVisible();
});

test('registra un corte de facturación desde el panel del proyecto', async ({ page }) => {
  const operaciones = await prepararSesion(page);
  await page.goto('/proyectos/energia');
  await page.getByText('Subestación de prueba').first().click();
  await page.getByRole('button', { name: /Agregar Corte de Facturación/ }).first().click();
  await page.locator('[formcontrolname="valorCorte"]').fill('150000');
  await page.locator('[formcontrolname="numeroFactura"]').fill('FV-PRUEBA-1');
  await page.getByRole('button', { name: 'Registrar Corte' }).click();
  await expect.poll(() => operaciones.includes('AddCorteFacturacion')).toBe(true);
  await expect(page.getByText('FV-PRUEBA-1').first()).toBeVisible();
});

test('el Tracker recuerda los filtros de cada división', async ({ page }) => {
  await prepararSesion(page);
  await page.goto('/proyectos/energia');
  const estado = page.locator('select').filter({ hasText: 'Todos los estados' });
  await estado.selectOption('PENDIENTE');
  await page.reload();
  await expect(page.locator('select').filter({ hasText: 'Pendiente' }).first()).toHaveValue('PENDIENTE');
  // Otra división conserva sus propios filtros (aquí, ninguno)
  await page.goto('/proyectos/civiles');
  await expect(page.locator('select').filter({ hasText: 'Todos los estados' }).first()).toHaveValue('todos');
  await page.goto('/proyectos/energia');
  await expect(page.locator('select').filter({ hasText: 'Pendiente' }).first()).toHaveValue('PENDIENTE');
});

test('Ctrl+K busca un proyecto desde cualquier pantalla y abre su panel', async ({ page }) => {
  await prepararSesion(page);
  await page.goto('/panel');
  await expect(page.getByText('USUARIO PRUEBAS').first()).toBeVisible();
  await page.keyboard.press('Control+k');
  const campo = page.getByRole('dialog', { name: 'Buscar proyecto' }).getByRole('combobox');
  await expect(campo).toBeFocused();
  await campo.fill('subestacion');           // sin tilde también encuentra
  await expect(page.getByRole('option', { name: /E-001/ })).toBeVisible();
  await campo.press('Enter');
  await expect(page).toHaveURL(/\/proyectos\/energia$/);
  await expect(page.locator('[formcontrolname="nombre"]').first()).toHaveValue('Subestación de prueba');
});

test('la compilación trae lo necesario para instalarse como aplicación (PWA)', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.short_name).toBe('RMS ERP');
  expect(manifest.icons.some((i: any) => i.purpose === 'maskable')).toBe(true);
  expect((await request.get('/ngsw-worker.js')).ok()).toBe(true);
  const ngsw = await (await request.get('/ngsw.json')).json();
  expect(ngsw.navigationUrls.some((u: any) => String(u.regex).includes('api'))).toBe(true);
  expect((await request.get('/icons/icon-192.png')).ok()).toBe(true);
});

test('un error de sesión vencida (401) lleva al inicio de sesión', async ({ page }) => {
  await prepararSesion(page);
  await page.route('**/api/graphql', route => route.fulfill({ status: 401, body: '' }));
  await page.goto('/proyectos/energia');
  await expect(page.getByText('Sesión vencida')).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('la campana muestra las notificaciones sin leer y abre el proyecto', async ({ page }) => {
  const operaciones = await prepararSesion(page);
  await page.goto('/panel');
  const campana = page.getByRole('button', { name: 'Notificaciones: 1 sin leer' });
  await expect(campana).toBeVisible();
  await campana.click();
  const panel = page.getByRole('dialog', { name: 'Notificaciones' });
  await expect(panel.getByText('hace 1 día').or(panel.getByText('ayer'))).toBeVisible();
  await panel.getByRole('button', { name: /Te asignaron como responsable del proyecto E-001/ }).click();
  await expect(page).toHaveURL(/\/proyectos\/energia$/);
  await expect(page.locator('[formcontrolname="nombre"]').first()).toHaveValue('Subestación de prueba');
  expect(operaciones).toContain('MarcarNotificacionLeida');
});

test('al tocar un aviso push (/panel?notificacion=<id>) se abre lo que corresponde', async ({ page }) => {
  await prepararSesion(page);
  await page.goto('/panel?notificacion=2');
  await expect(page).toHaveURL(/\/proyectos\/energia$/);
  await expect(page.locator('[formcontrolname="nombre"]').first()).toHaveValue('Subestación de prueba');
});

test('el desglose del dashboard está oculto y se abre con sus filtros', async ({ page }) => {
  await prepararSesion(page);
  await page.goto('/panel');
  const boton = page.getByRole('button', { name: /Desglose de proyectos/ });
  await expect(boton).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('table')).toHaveCount(0);
  await boton.click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Buscar en la tabla' })).toBeVisible();
});

test('el desglose del dashboard muestra 10 proyectos por página', async ({ page }) => {
  await prepararSesion(page);
  const muchos = Array.from({ length: 23 }, (_, i) => ({ ...PROYECTO, id: `p${i}`, codigo: `E-${String(i + 1).padStart(3, '0')}`,
    nombre: i === 22 ? 'Proyecto especial' : `Proyecto ${i + 1}`, fechaAsignacion: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z` }));
  await page.route('**/api/graphql', route => route.request().postDataJSON()?.operationName === 'GetTodosLosProyectos'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { proyectos: muchos } }) })
    : route.fallback());
  await page.goto('/panel');
  await page.getByRole('button', { name: /Desglose de proyectos/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await expect(page.getByText('1–10 de 23')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('21–23 de 23')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  // Al filtrar vuelve a la primera página
  await page.getByRole('searchbox', { name: 'Buscar en la tabla' }).fill('especial');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Siguiente' })).toHaveCount(0);
});

test('el menú lateral muestra Cuadrillas solo al abrir Proyectos (o al estar en Cuadrillas)', async ({ page }) => {
  await prepararSesion(page);
  await page.goto('/panel');
  const cuadrillas = page.getByRole('link', { name: 'Cuadrillas' });
  await expect(cuadrillas).toHaveCount(0);
  await page.getByRole('button', { name: 'Mostrar opciones de Proyectos' }).click();
  await expect(cuadrillas).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar opciones de Proyectos' }).click();
  await expect(cuadrillas).toHaveCount(0);
  await page.goto('/proyectos/cuadrillas');
  await expect(page.getByRole('link', { name: 'Cuadrillas' })).toBeVisible();
});

test('el flujo financiero del dashboard está oculto y se consulta al abrirlo', async ({ page }) => {
  const operaciones = await prepararSesion(page);
  await page.goto('/panel');
  const boton = page.getByRole('button', { name: /Flujo de caja mes a mes/ });
  await expect(boton).toHaveAttribute('aria-expanded', 'false');
  expect(operaciones).not.toContain('FlujoMensual');
  await boton.click();
  await expect.poll(() => operaciones.includes('FlujoMensual')).toBe(true);
  await expect(page.getByText('Diagnóstico de tesorería')).toBeVisible();
  // Filtro de división dentro de la sección: vuelve a consultar con esa división
  const peticion = page.waitForRequest(r => r.url().includes('/api/graphql') && r.postDataJSON()?.operationName === 'FlujoMensual');
  await page.getByRole('group', { name: 'División del flujo' }).getByRole('button', { name: 'Energía' }).click();
  expect((await peticion).postDataJSON().variables.linea).toBe('energia');
});

test('el tablero de Tareas muestra código, etiquetas, avance y límite WIP', async ({ page }) => {
  await prepararSesion(page);
  const estado = { id: 1, nombre: 'En curso', color: '#2563eb', orden: 1, esEstadoInicial: true, esEstadoFinal: false, activo: true, limiteWip: 1 };
  const tarea = (n: number) => ({ id: `t${n}`, consecutivo: 1020 + n, prioridad: n === 1 ? 'Critica' : 'Media', etiquetas: 'Finanzas,O&M',
    pasos: [{ id: n * 10, texto: 'a', completado: true, orden: 0 }, { id: n * 10 + 1, texto: 'b', completado: false, orden: 1 }],
    titulo: `Tarea ${n}`, descripcion: null, estadoId: 1, estado, vecesMovida: 0, semanaProgramada: new Date().toISOString(),
    fechaPresupuestoInicio: null, fechaPresupuestoFin: null, fechaRealFinalizacion: null, fechaCreacion: new Date().toISOString(),
    fechaActualizacion: null, creadoPor: { id: 'u', nombre: 'X', avatarUrl: null }, asignados: [], comentarios: [] });
  await page.route('**/api/graphql', route => {
    const op = route.request().postDataJSON()?.operationName;
    const r: any = { GetTareasSemana: { tareasSemana: [tarea(1), tarea(2)] }, GetEstadosTarea: { estadosTarea: [estado] } };
    return r[op] ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: r[op] }) }) : route.fallback();
  });
  await page.goto('/tareas');
  await expect(page.getByText('#RMS-1021')).toBeVisible();
  await expect(page.getByText('Crítica')).toBeVisible();
  await expect(page.getByText('#Finanzas').first()).toBeVisible();
  await expect(page.getByText('1/2').first()).toBeVisible();
  await expect(page.getByText('/ WIP 1')).toHaveClass(/text-red-600/);   // 2 tareas con límite 1
});

test('al completar una tarea con pasos pendientes advierte y deja decidir', async ({ page }) => {
  await prepararSesion(page);
  const inicial = { id: 1, nombre: 'En curso', color: '#2563eb', orden: 1, esEstadoInicial: true, esEstadoFinal: false, activo: true, limiteWip: null };
  const final = { id: 2, nombre: 'Completada', color: '#10b981', orden: 2, esEstadoInicial: false, esEstadoFinal: true, activo: true, limiteWip: null };
  const tarea = { id: 't1', consecutivo: 1050, prioridad: 'Media', etiquetas: null,
    pasos: [{ id: 1, texto: 'Uno', completado: true, orden: 0 }, { id: 2, texto: 'Dos', completado: false, orden: 1 }],
    titulo: 'Tarea con pasos', descripcion: null, estadoId: 1, estado: inicial, vecesMovida: 0, semanaProgramada: new Date().toISOString(),
    fechaPresupuestoInicio: null, fechaPresupuestoFin: null, fechaRealFinalizacion: null, fechaCreacion: new Date().toISOString(),
    fechaActualizacion: null, creadoPor: { id: 'u', nombre: 'X', avatarUrl: null }, asignados: [], comentarios: [],
    movimientos: [], historialEstados: [], creadoPorId: 'u' };
  const ops: string[] = [];
  await page.route('**/api/graphql', route => {
    const op = route.request().postDataJSON()?.operationName; ops.push(op);
    const r: any = { GetTareasSemana: { tareasSemana: [tarea] }, GetEstadosTarea: { estadosTarea: [inicial, final] }, GetTarea: { tarea } };
    return r[op] ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: r[op] }) }) : route.fallback();
  });
  await page.goto('/tareas');
  await page.getByText('Tarea con pasos').click();
  await page.getByRole('button', { name: 'Completada' }).last().click();
  await expect(page.getByText('Hay pasos sin completar')).toBeVisible();
  await expect(page.getByText('1 de 2')).toBeVisible();
  await page.getByRole('button', { name: 'Revisar pasos' }).click();
  await expect(page.getByText('¿Cuándo se completó esta tarea?')).toHaveCount(0);
  expect(ops).not.toContain('CambiarEstadoTarea');
});

test.describe('en celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('el Tracker muestra tarjetas y una tarjeta abre el panel del proyecto', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/proyectos/energia');
    const tarjeta = page.getByRole('button', { name: /Abrir proyecto E-001/ });
    await expect(tarjeta).toBeVisible();
    await expect(page.locator('table:visible')).toHaveCount(0);
    await tarjeta.click();
    await expect(page.locator('[formcontrolname="nombre"]').first()).toHaveValue(/Subestación de prueba/);
  });

  test('el desglose del dashboard se ve como tarjetas', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/panel');
    await page.getByRole('button', { name: /Desglose de proyectos/ }).click();
    await expect(page.locator('table:visible')).toHaveCount(0);
    await expect(page.locator('p', { hasText: 'Subestación de prueba' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Ordenar por' })).toBeVisible();
  });

  test('los filtros se recogen en el botón Filtros', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/proyectos/energia');
    const estado = page.locator('select').filter({ hasText: 'Todos los estados' });
    await expect(estado).toBeHidden();
    const boton = page.getByRole('button', { name: /^Filtros/ });
    await boton.click();
    await expect(estado).toBeVisible();
    await estado.selectOption('PENDIENTE');
    await expect(boton).toHaveText(/Filtros\s*1/);
    await boton.click();
    await expect(estado).toBeHidden();
  });
});
