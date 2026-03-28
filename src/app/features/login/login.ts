import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GoogleSigninButtonModule, SocialAuthService } from '@abacritt/angularx-social-login';
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
    // Escuchamos cuando el usuario hace clic en el botón de Google
    this.googleAuth.authState.subscribe(async (user) => {
      if (user) {
        // 1. Enviamos el token al servidor para validar contra SQL Server
        const exito = await this.rmsAuth.autenticarConServidor(user.idToken);

        if (exito) {
          // 2. Si el servidor respondió con un usuario válido, entramos
          this.router.navigate(['/panel']);
        } else {
          // 3. Si no existe en la DB o hay error, limpiamos y avisamos
          alert('Acceso denegado. Tu cuenta no está registrada en el sistema RMS.');
          this.rmsAuth.cerrarSesion();
        }
      }
    });
  }
}
