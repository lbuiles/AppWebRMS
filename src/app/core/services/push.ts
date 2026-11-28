import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom, map, timeout } from 'rxjs';

const CLAVE_PUBLICA = gql`query PushClavePublica { pushClavePublica }`;
const SUSCRIBIR = gql`mutation SuscribirPush($input: PushSuscripcionInput!) { suscribirPush(input: $input) }`;
const DESUSCRIBIR = gql`mutation DesuscribirPush($endpoint: String!) { desuscribirPush(endpoint: $endpoint) }`;
const PROBAR = gql`mutation ProbarPush { probarPush }`;

/**
 * Estado de las notificaciones push en ESTE navegador:
 * - no-soportado: navegador sin push o app en desarrollo (el service worker solo corre en producción)
 * - instalar-ios: iPhone/iPad: primero hay que agregar el ERP a la pantalla de inicio
 * - sin-configurar: el servidor no tiene llaves VAPID
 * - bloqueado: el usuario negó el permiso en el navegador
 * - inactivo / activo
 */
export type EstadoPush = 'cargando' | 'no-soportado' | 'instalar-ios' | 'sin-configurar' | 'bloqueado' | 'inactivo' | 'activo';

@Injectable({ providedIn: 'root' })
export class PushService {
  private swPush = inject(SwPush);
  private apollo = inject(Apollo);

  readonly estado = signal<EstadoPush>('cargando');
  readonly trabajando = signal(false);
  private clave: string | null = null;
  private iniciado = false;

  /** Revisa el estado y, si ya estaba activo, vuelve a registrar la suscripción con el usuario actual. */
  async iniciar() {
    if (this.iniciado) return;
    this.iniciado = true;

    if (this.esIosSinInstalar()) { this.estado.set('instalar-ios'); return; }
    if (!this.swPush.isEnabled || !('Notification' in window) || !('PushManager' in window)) {
      this.estado.set('no-soportado'); return;
    }
    try {
      this.clave = await firstValueFrom(this.apollo.query<any>({ query: CLAVE_PUBLICA, fetchPolicy: 'network-only' })
        .pipe(map(r => r.data?.pushClavePublica ?? null)));
    } catch { this.clave = null; }
    if (!this.clave) { this.estado.set('sin-configurar'); return; }
    if (Notification.permission === 'denied') { this.estado.set('bloqueado'); return; }

    const sub = await firstValueFrom(this.swPush.subscription);
    if (sub) {
      // La suscripción puede venir de otra sesión: se reasigna al usuario actual
      await this.registrar(sub).catch(() => {});
      this.estado.set('activo');
    } else {
      this.estado.set('inactivo');
    }
  }

  async activar(): Promise<boolean> {
    if (!this.clave) return false;
    this.trabajando.set(true);
    try {
      const sub = await this.swPush.requestSubscription({ serverPublicKey: this.clave });
      await this.registrar(sub);
      this.estado.set('activo');
      return true;
    } catch {
      this.estado.set(Notification.permission === 'denied' ? 'bloqueado' : 'inactivo');
      return false;
    } finally {
      this.trabajando.set(false);
    }
  }

  async desactivar() {
    this.trabajando.set(true);
    try {
      const sub = await firstValueFrom(this.swPush.subscription);
      if (sub) {
        await firstValueFrom(this.apollo.mutate({ mutation: DESUSCRIBIR, variables: { endpoint: sub.endpoint } })).catch(() => {});
        await this.swPush.unsubscribe().catch(() => {});
      }
      this.estado.set('inactivo');
    } finally {
      this.trabajando.set(false);
    }
  }

  /** Envía una notificación de prueba al usuario actual. Devuelve cuántos dispositivos tiene suscritos. */
  async probar(): Promise<number> {
    const r: any = await firstValueFrom(this.apollo.mutate({ mutation: PROBAR }));
    return r?.data?.probarPush ?? 0;
  }

  /**
   * Al cerrar sesión se quita la suscripción en el servidor: mientras nadie haya iniciado sesión,
   * este navegador no recibe avisos. La suscripción del navegador se conserva, así que al volver
   * a entrar (cualquier usuario) iniciar() la registra de nuevo sin tener que activarla otra vez.
   */
  async alCerrarSesion() {
    if (!this.swPush.isEnabled) return;
    try {
      const sub = await firstValueFrom(this.swPush.subscription.pipe(timeout(1500)));
      if (!sub) return;
      await firstValueFrom(this.apollo.mutate({ mutation: DESUSCRIBIR, variables: { endpoint: sub.endpoint } }).pipe(timeout(3000))).catch(() => {});
    } catch { /* sin conexión o sin suscripción: se ignora */ }
    this.iniciado = false;
    this.estado.set('cargando');
  }

  private async registrar(sub: PushSubscription) {
    const j: any = sub.toJSON();
    await firstValueFrom(this.apollo.mutate({
      mutation: SUSCRIBIR,
      variables: { input: { endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, dispositivo: this.dispositivo() } }
    }));
  }

  private dispositivo(): string {
    const ua = navigator.userAgent;
    const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Otro';
    const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    return `${nav} en ${so}`;
  }

  private esIosSinInstalar(): boolean {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const instalada = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    return ios && !instalada;
  }
}
