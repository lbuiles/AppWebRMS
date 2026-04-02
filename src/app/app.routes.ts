import { Routes } from '@angular/router';
import { authGuard, publicGuard, permissionGuard } from './core/auth/auth.guard'; // <-- Cambiado rolGuard por permissionGuard

// Componentes
import { LoginComponent } from './features/login/login';
import { MainLayoutComponent } from './layout/main-layout/main-layout';
import { DashboardComponent } from './features/dashboard/dashboard';
import { TicketsComponent } from './features/tickets/tickets';
import { ProyectosComponent } from './features/proyectos/proyectos';
import { TareasComponent } from './features/tareas/tareas';
import { FinanzasComponent } from './features/finanzas/finanzas';
import { GestionHumanaComponent } from './features/gestion-humana/gestion-humana';
import { LandingComponent } from './features/landing/landing';
import { AdministracionComponent } from './features/administracion/administracion';
import { ClientesComponent } from './features/clientes/clientes';
import { UsuariosComponent } from './features/administracion/usuarios/usuarios';
import { Diccionario } from './features/administracion/diccionario/diccionario';
import { TrackerListComponent } from './features/proyectos/tracker-list/tracker-list';

export const routes: Routes = [
  // --- ZONA PÚBLICA ---
  {
    path: '',
    component: LandingComponent,
    pathMatch: 'full',
    canActivate: [publicGuard]
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [publicGuard]
  },

  // --- ZONA PRIVADA (ERP RMS) ---
    {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'panel',
        component: DashboardComponent
      },
      {
        path: 'administracion',
        component: AdministracionComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'admin' }
      },
      // NUEVA RUTA: Diccionario de Permisos
      {
        path: 'diccionario',
        component: Diccionario,
        canActivate: [permissionGuard],
        data: { permiso: 'admin' }
      },
      {
        path: 'usuarios',
        component: UsuariosComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'admin.usuarios.leer' }
      },
      {
        path: 'clientes',
        component: ClientesComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'admin.clientes.leer' }
      },
      {
        path: 'proyectos',
        component: ProyectosComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'proyectos' }
      },
      {
        path: 'proyectos/:linea',
        component: TrackerListComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'proyectos' }
      },
      {
        path: 'finanzas',
        component: FinanzasComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'finanzas' }
      },
      {
        path: 'gestion-humana',
        component: GestionHumanaComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'gestionhumana' }
      },
      {
        path: 'tickets',
        component: TicketsComponent
      },
      {
        path: 'tareas',
        component: TareasComponent
      }
    ]
  },

  // --- COMODÍN ---
  {
    path: '**',
    redirectTo: ''
  }
];
