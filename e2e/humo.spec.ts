import { test, expect } from '@playwright/test';
import { prepararSesion } from './simulador';

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
