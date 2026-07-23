import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GoogleSigninButtonModule, SocialAuthService, GoogleLoginProvider } from '@abacritt/angularx-social-login';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [GoogleSigninButtonModule, RouterLink],
  templateUrl: './login.html'
})
export class LoginComponent implements OnInit {
  private googleAuth = inject(SocialAuthService);
  private router = inject(Router);
  private rmsAuth = inject(AuthService);

  ngOnInit() {
    this.googleAuth.authState.subscribe(async (user) => {
      if (!user) return;

      // El JWT de Google Workspace no incluye el claim "picture".
      // Obtenemos un access token para llamar al endpoint userinfo de Google,
      // que sí devuelve la foto aunque el JWT no la traiga.
      let fotoUrl: string | undefined;
      try {
        const accessToken = await this.googleAuth.getAccessToken(GoogleLoginProvider.PROVIDER_ID);
        if (accessToken) {
          const res  = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          const info = await res.json();
          fotoUrl = info.picture ?? undefined;
        }
      } catch {
        // Si falla (permisos, red, etc.) se usará el avatar de iniciales
      }

      const exito = await this.rmsAuth.autenticarConServidor(user.idToken, fotoUrl);

      if (exito) {
        this.router.navigate(['/panel']);
      } else {
        alert('Acceso denegado. Tu cuenta no está registrada en el sistema RMS.');
        this.rmsAuth.cerrarSesion();
      }
    });
  }
}
