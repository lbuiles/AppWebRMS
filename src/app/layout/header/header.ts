import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { MenuService } from '../../services/menu';
import { SocialAuthService, GoogleLoginProvider } from '@abacritt/angularx-social-login';
import { AuthService } from '../../core/auth/auth.service'; // Tu servicio
import { BusquedaGlobalComponent } from '../busqueda-global/busqueda-global';
import { CampanaNotificacionesComponent } from '../campana-notificaciones/campana-notificaciones';
import { PushService } from '../../core/services/push';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [BusquedaGlobalComponent, CampanaNotificacionesComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './header.html'
})
export class HeaderComponent {
  // Inyectamos tus servicios
  public authService = inject(AuthService); // <--- IMPORTANTE: Debe ser public para usarlo en el HTML
  private socialAuth = inject(SocialAuthService);
  private router = inject(Router);
  private push = inject(PushService);

  constructor(public menuService: MenuService) {}

  /** Si no hay foto real, al tocar el avatar se trae de Google (una sola vez; queda guardada en el servidor). */
  async traerFoto() {
    if (this.authService.tieneFotoReal()) return;
    const ok = await this.authService.traerFotoDeGoogle(
      () => this.socialAuth.getAccessToken(GoogleLoginProvider.PROVIDER_ID));
    if (!ok) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'info', timer: 4000, showConfirmButton: false,
        title: 'No se pudo traer la foto', text: 'Vuelve a intentarlo tocando tu avatar.' });
    }
  }

  irAHome() {
    this.router.navigate(['/panel']);
  }

  async logout() {
    // Antes de borrar el token: este navegador deja de recibir los avisos push de este usuario
    await this.push.alCerrarSesion();
    this.socialAuth.signOut().catch(() => {});
    // Limpiamos LocalStorage
    localStorage.removeItem('rms_token');
    localStorage.removeItem('rms_user');
    // Limpiamos la Signal del servicio
    this.authService.cerrarSesion();
    this.router.navigate(['/login']);
  }
}
