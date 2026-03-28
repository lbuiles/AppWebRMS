import { ApplicationConfig, importProvidersFrom, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { provideHttpClient } from '@angular/common/http';

import { environment } from '../environments/environment';

import {
  SocialLoginModule,
  SocialAuthServiceConfig,
  GoogleLoginProvider,
  SocialAuthService
} from '@abacritt/angularx-social-login';

import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, ApolloLink } from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

import Swal from 'sweetalert2';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideCharts(withDefaultRegisterables()),
    importProvidersFrom(SocialLoginModule),

    {
      provide: 'SocialAuthServiceConfig',
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

      // 1. MIDDLEWARE DE ERRORES (Tipado como any para evitar el error de ErrorHandlerOptions)
      const errorLink = onError(({ graphQLErrors, networkError }: any) => {
        if (graphQLErrors) {
          graphQLErrors.forEach((err: any) => {
            if (err.extensions?.code === 'AUTH_NOT_AUTHENTICATED' || err.message.includes('authorized')) {
              localStorage.removeItem('rms_token');
              localStorage.removeItem('rms_user');
              authService.signOut().catch(() => {});

              Swal.fire({
                title: 'Sesión Inválida',
                text: 'Tu sesión ha expirado. Por favor ingresa de nuevo.',
                icon: 'warning',
                confirmButtonColor: '#1e3a8a'
              }).then(() => {
                window.location.href = '/login';
              });
            }
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
