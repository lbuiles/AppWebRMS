import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

/**
 * Nueva interfaz de usuario basada en Permisos (Slugs)
 * Ya no dependemos de un string "ADMIN" o "OPERADOR"
 */
export interface UsuarioRMS {
  id: string;
  nombre: string;
  email: string;
  fotoUrl: string;
  // Almacenamos la lista de llaves: ['admin.usuarios.leer', 'proyectos.energia.crear', etc]
  permisos: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl;

  // Signal para que toda la app reaccione a cambios del usuario
  public usuarioActual = signal<UsuarioRMS | null>(null);

  constructor() {
    // Recuperar sesión persistente
    const usuarioGuardado = localStorage.getItem('rms_user');
    const tokenGuardado   = localStorage.getItem('rms_token');

    if (usuarioGuardado) {
      try {
        // Verificar si el token de sesión ya expiró antes de restaurarla (el token RMS dura
        // 12 horas y se renueva solo mientras la app está abierta; ver programarRenovacion).
        if (tokenGuardado) {
          const payload = this.decodeJwtPayload(tokenGuardado);
          const exp     = payload['exp'] as number | undefined;
          const ahora   = Math.floor(Date.now() / 1000);
          if (exp && ahora >= exp) {
            // Token expirado → limpiar sesión silenciosamente
            this.cerrarSesion();
          } else {
            this.usuarioActual.set(JSON.parse(usuarioGuardado));
            this.programarRenovacion();
          }
        } else {
          // Sin token almacenado → sesión incompleta, limpiar
          this.cerrarSesion();
        }
      } catch {
        this.cerrarSesion();
      }
    }
  }

  /**
   * Método principal de autenticación
   * @param googleToken Token JWT recibido desde Google
   */
  /** Decodifica el payload de un JWT sin verificar la firma (solo lectura de claims) */
  private decodeJwtPayload(token: string): Record<string, any> {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return {};
    }
  }

  public async autenticarConServidor(googleToken: string, googleFotoUrl?: string): Promise<boolean> {
    Swal.fire({
      title: 'Iniciando sesión',
      text: 'Validando permisos en RMS...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      // 1. QUERY ACTUALIZADA: Navegamos por la relación Usuario -> UsuarioPermiso -> Permiso
      const body = {
        query: `
          query {
            miPerfil {
              id
              nombre
              email
              avatarUrl
              usuarioPermisos {
                permiso {
                  slug
                }
              }
            }
          }
        `
      };

      // 1. Canjear el token de Google (dura ~1 hora) por el token de sesión RMS (12 horas, renovable)
      const sesion: any = await firstValueFrom(
        this.http.post(`${environment.restUrl}/auth/sesion`, {}, {
          headers: new HttpHeaders().set('Authorization', `Bearer ${googleToken}`)
        })
      );
      const tokenSesion: string | undefined = sesion?.token;
      if (!tokenSesion) throw new Error('SIN_SESION');

      const headers = new HttpHeaders().set('Authorization', `Bearer ${tokenSesion}`);

      const response: any = await firstValueFrom(
        this.http.post(this.API_URL, body, { headers })
      );

      const perfil = response.data?.miPerfil;

      if (!perfil) throw new Error('USUARIO_NO_ENCONTRADO');

      // 2. APLANAR PERMISOS: Convertimos el objeto de GraphQL en un array simple de strings
      // Ejemplo: de [{permiso: {slug: 'a'}}, {permiso: {slug: 'b'}}] a ['a', 'b']
      const listaPermisos: string[] = perfil.usuarioPermisos.map(
        (up: any) => up.permiso.slug
      );

      // Extraer foto del ID token (claim "picture") — más fiable que user.photoUrl
      // que la librería no siempre llena en cuentas de Google Workspace
      const jwtPayload  = this.decodeJwtPayload(googleToken);
      const fotoGoogle  = googleFotoUrl || jwtPayload['picture'] || null;

      const usuarioProcesado: UsuarioRMS = {
        id: perfil.id,
        nombre: perfil.nombre,
        email: perfil.email,
        // Prioridad: picture del JWT → photoUrl del OAuth → avatarUrl del servidor → avatar generado
        fotoUrl: fotoGoogle || perfil.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(perfil.nombre)}&background=1e3a8a&color=fff`,
        permisos: listaPermisos
      };

      // 3. Guardar estado
      this.usuarioActual.set(usuarioProcesado);
      localStorage.setItem('rms_user', JSON.stringify(usuarioProcesado));
      localStorage.setItem('rms_token', tokenSesion);
      this.programarRenovacion();

      Swal.close();
      return true;

    } catch (error: any) {
      Swal.close();

      let mensaje = 'Error de conexión con el servidor.';
      if (error.message === 'USUARIO_NO_ENCONTRADO' || error?.status === 401 || error?.status === 403) {
        mensaje = 'Tu correo no está registrado en el sistema RMS o tu usuario está inactivo.';
      }

      Swal.fire({
        icon: 'error',
        title: 'Acceso Denegado',
        text: mensaje,
        confirmButtonColor: '#1e3a8a'
      });

      return false;
    }
  }

  // --- RENOVACIÓN DE LA SESIÓN ---

  private temporizadorRenovacion?: ReturnType<typeof setInterval>;
  private renovando = false;

  /** Revisa cada 5 minutos (y al volver a la pestaña) si el token está por vencer. */
  private programarRenovacion() {
    clearInterval(this.temporizadorRenovacion);
    this.temporizadorRenovacion = setInterval(() => this.renovarSiHaceFalta(), 5 * 60_000);
    if (!this.escuchandoVisibilidad) {
      this.escuchandoVisibilidad = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.renovarSiHaceFalta();
      });
    }
    this.renovarSiHaceFalta();
  }
  private escuchandoVisibilidad = false;

  /** Pide un token nuevo cuando al actual le quedan menos de 2 horas. */
  private async renovarSiHaceFalta() {
    const token = localStorage.getItem('rms_token');
    if (!token || this.renovando || !this.usuarioActual()) return;

    const payload = this.decodeJwtPayload(token);
    // Un token de Google guardado antes de este cambio no se renueva: al vencer, se inicia sesión de nuevo
    if (payload['iss'] !== 'rms-erp') return;
    const restante = (payload['exp'] as number) - Math.floor(Date.now() / 1000);
    if (!(restante > 0 && restante < 2 * 3600)) return;

    this.renovando = true;
    try {
      const r: any = await firstValueFrom(
        this.http.post(`${environment.restUrl}/auth/renovar`, {}, {
          headers: new HttpHeaders().set('Authorization', `Bearer ${token}`)
        })
      );
      if (r?.token) localStorage.setItem('rms_token', r.token);
    } catch {
      // Si falla (sin red, usuario inactivado), se reintenta en el próximo ciclo; al vencer, el API pide login
    } finally {
      this.renovando = false;
    }
  }

  // --- MÉTODOS DE VALIDACIÓN DE PERMISOS (REEMPLAZAN A esAdmin) ---

  /**
   * Verifica si el usuario tiene un permiso específico.
   * Uso: hasPermission('admin.usuarios.borrar')
   */
  hasPermission(slug: string): boolean {
  const usuario = this.usuarioActual();
  if (!usuario || !usuario.permisos) return false;

  // Verificamos coincidencia exacta o jerárquica clara
  return usuario.permisos.some(p => p === slug || p.startsWith(slug + '.'));
}
  /**
   * Verifica si el usuario tiene acceso a un módulo completo.
   * Útil para mostrar/ocultar secciones del Sidebar.
   * Uso: hasModule('proyectos.energia') -> true si tiene algun permiso de energia
   */
  public hasModule(modulePath: string): boolean {
    const usuario = this.usuarioActual();
    if (!usuario) return false;
    return usuario.permisos.some(p => p.startsWith(modulePath));
  }

  /**
   * Cierra la sesión y limpia el almacenamiento
   */
  public cerrarSesion() {
    clearInterval(this.temporizadorRenovacion);
    this.usuarioActual.set(null);
    localStorage.removeItem('rms_user');
    localStorage.removeItem('rms_token');
  }
}
