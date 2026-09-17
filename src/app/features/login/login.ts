import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GoogleSigninButtonModule, SocialAuthService, GoogleLoginProvider } from '@abacritt/angularx-social-login';
import { AuthService } from '../../core/auth/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [GoogleSigninButtonModule, RouterLink],
  templateUrl: './login.html'
})
export class LoginComponent implements OnInit, OnDestroy {
  private googleAuth = inject(SocialAuthService);
  private router = inject(Router);
  private rmsAuth = inject(AuthService);

  // Evita llamadas concurrentes si authState dispara más de una vez
  private autenticando = false;
  private authSub?: Subscription;

  ngOnInit() {
    this.authSub = this.googleAuth.authState.subscribe(async (user) => {
      // Si ya hay una autenticación en curso, ignorar emisiones adicionales
      if (!user || this.autenticando) return;

      this.autenticando = true;

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
        this.autenticando = false; // Permite reintentar si el usuario intenta de nuevo
        this.rmsAuth.cerrarSesion();
      }
    });
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
  }
}
