import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GoogleSigninButtonModule, SocialAuthService } from '@abacritt/angularx-social-login';
import { AuthService } from '../../core/auth/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [GoogleSigninButtonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
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
      // Sin idToken (p. ej. sesión sin el flujo de Google Sign-In) no hay nada que validar en el servidor
      if (!user || !user.idToken || this.autenticando) return;

      this.autenticando = true;

      // Antes se pedía además un access token a Google solo para traer la foto: eso abría una
      // segunda ventana de selección de cuenta (en el PC pedía la cuenta dos veces) y en iPhone
      // Safari la bloqueaba por no venir de un toque del usuario, dejando el inicio de sesión colgado.
      // La foto sale ahora del ID token, del perfil en el servidor o de la última vista en este equipo.
      const exito = await this.rmsAuth.autenticarConServidor(user.idToken!, user.photoUrl || undefined);

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
