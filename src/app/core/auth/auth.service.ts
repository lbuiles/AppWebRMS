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
    if (usuarioGuardado) {
      try {
        this.usuarioActual.set(JSON.parse(usuarioGuardado));
      } catch {
        this.cerrarSesion();
      }
    }
  }

  /**
   * Método principal de autenticación
   * @param googleToken Token JWT recibido desde Google
   */
  public async autenticarConServidor(googleToken: string): Promise<boolean> {
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

      const headers = new HttpHeaders().set('Authorization', `Bearer ${googleToken}`);

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

      const usuarioProcesado: UsuarioRMS = {
        nombre: perfil.nombre,
        email: perfil.email,
        fotoUrl: perfil.avatarUrl || `https://ui-avatars.com/api/?name=${perfil.nombre}&background=1e3a8a&color=fff`,
        permisos: listaPermisos
      };

      // 3. Guardar estado
      this.usuarioActual.set(usuarioProcesado);
      localStorage.setItem('rms_user', JSON.stringify(usuarioProcesado));
      localStorage.setItem('rms_token', googleToken);

      Swal.close();
      return true;

    } catch (error: any) {
      Swal.close();

      let mensaje = 'Error de conexión con el servidor.';
      if (error.message === 'USUARIO_NO_ENCONTRADO') {
        mensaje = 'Tu correo no está registrado en el sistema RMS.';
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
    this.usuarioActual.set(null);
    localStorage.removeItem('rms_user');
    localStorage.removeItem('rms_token');
  }
}
