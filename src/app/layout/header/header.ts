import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MenuService } from '../../services/menu';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { AuthService } from '../../core/auth/auth.service'; // Tu servicio
import { BusquedaGlobalComponent } from '../busqueda-global/busqueda-global';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [BusquedaGlobalComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './header.html'
})
export class HeaderComponent {
  // Inyectamos tus servicios
  public authService = inject(AuthService); // <--- IMPORTANTE: Debe ser public para usarlo en el HTML
  private socialAuth = inject(SocialAuthService);
  private router = inject(Router);

  constructor(public menuService: MenuService) {}

  irAHome() {
    this.router.navigate(['/panel']);
  }

  logout() {
    this.socialAuth.signOut().catch(() => {});
    // Limpiamos LocalStorage
    localStorage.removeItem('rms_token');
    localStorage.removeItem('rms_user');
    // Limpiamos la Signal del servicio
    this.authService.cerrarSesion();
    this.router.navigate(['/login']);
  }
}
