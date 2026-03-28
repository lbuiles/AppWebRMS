import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MenuService } from '../../services/menu';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { AuthService } from '../../core/auth/auth.service'; // Tu servicio

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [], // Si usas @if no necesitas NgIf
  templateUrl: './header.html'
})
export class HeaderComponent {
  // Inyectamos tus servicios
  public authService = inject(AuthService); // <--- IMPORTANTE: Debe ser public para usarlo en el HTML
  private socialAuth = inject(SocialAuthService);
  private router = inject(Router);

  constructor(public menuService: MenuService) {}

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
