import { ApplicationConfig, importProvidersFrom, inject, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { provideHttpClient, withXhr } from '@angular/common/http';

import { environment } from '../environments/environment';

import {
  SocialLoginModule,
  SocialAuthServiceConfig,
  GoogleLoginProvider,
  SocialAuthService,
  SOCIAL_AUTH_CONFIG
} from '@abacritt/angularx-social-login';

import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, ApolloLink } from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

import Swal from 'sweetalert2';
import { esSesionVencida, esSinConexion } from './core/errores';

export const appConfig: ApplicationConfig = {
  providers: [
    // Desde Angular 21 las apps arrancan sin zone.js (zoneless) si no se indica lo contrario.
    // Esta app actualiza la pantalla con zone.js (subscribe, setTimeout, etc.), así que se mantiene explícito.
    provideZoneChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withXhr()),
    provideCharts(withDefaultRegisterables()),
    // PWA: el service worker solo se activa en producción. Se registra cuando la app se estabiliza
    // (o a los 30 s) para no competir con la carga inicial.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    importProvidersFrom(SocialLoginModule),

    {
      // angularx-social-login 2.6+ usa un InjectionToken en lugar del string 'SocialAuthServiceConfig'
      provide: SOCIAL_AUTH_CONFIG,
      useValue: {
        autoLogin: false,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider(
              '869381008070-m358g9u3unnqgo7uq13hihgpg80rganp.apps.googleusercontent.com',
              { scopes: 'email profile', hd: 'rmscolombia.com' } as any
            )
          }
        ],
        onError: (err) => { console.error('Error en Google Login:', err); }
      } as SocialAuthServiceConfig,
    },

    provideApollo(() => {
      const httpLink = inject(HttpLink);
      const authService = inject(SocialAuthService);

      // 1. MIDDLEWARE DE ERRORES (Apollo 4: llega un único `error`; ver core/errores.ts)
      let avisandoSesion = false;
      let ultimoAvisoConexion = 0;
      const errorLink = onError(({ error }: any) => {
        if (esSesionVencida(error)) {
          if (avisandoSesion) return;
          avisandoSesion = true;
          localStorage.removeItem('rms_token');
          localStorage.removeItem('rms_user');
          authService.signOut().catch(() => {});
          Swal.fire({
            title: 'Sesión vencida',
            text: 'Tu sesión expiró. Por favor ingresa de nuevo.',
            icon: 'warning',
            confirmButtonColor: '#1e3a8a',
            allowOutsideClick: false
          }).then(() => {
            window.location.href = '/login';
          });
        } else if (esSinConexion(error) && Date.now() - ultimoAvisoConexion > 10_000) {
          // Aviso discreto (una vez cada 10 s) para consultas que no muestran su propio error
          ultimoAvisoConexion = Date.now();
          Swal.fire({
            toast: true, position: 'top-end', icon: 'error', timer: 4000, showConfirmButton: false,
            title: 'Sin conexión con el servidor',
            text: 'Revisa tu internet. Los datos pueden no estar actualizados.'
          });
        }
      });

      // 2. MIDDLEWARE DE AUTENTICACIÓN (La clave es el : any para evitar el choque de Headers)
      const authLink = setContext((_: any, { headers }: any): any => {
        const savedToken = localStorage.getItem('rms_token');
        return {
          headers: {
            ...headers,
            Authorization: savedToken ? `Bearer ${savedToken}` : '',
          }
        };
      });

      // 3. ENSAMBLAJE
      return {
        link: ApolloLink.from([
          errorLink,
          authLink,
          httpLink.create({ uri: environment.apiUrl })
        ]),
        cache: new InMemoryCache(),
      };
    })
  ]
};
