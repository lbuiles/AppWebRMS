import { Routes } from '@angular/router';
import { authGuard, publicGuard, permissionGuard } from './core/auth/auth.guard';

// Componentes
import { LoginComponent } from './features/login/login';
import { MainLayoutComponent } from './layout/main-layout/main-layout';
import { DashboardComponent } from './features/dashboard/dashboard';
import { TicketsComponent } from './features/tickets/tickets';
import { ProyectosComponent } from './features/proyectos/proyectos';
import { TareasComponent } from './features/tareas/tareas';
import { TareasReportesComponent } from './features/tareas/tareas-reportes/tareas-reportes'; // ← NUEVO
import { FinanzasComponent } from './features/finanzas/finanzas';
import { GestionHumanaComponent } from './features/gestion-humana/gestion-humana';
import { LandingComponent } from './features/landing/landing';
import { AdministracionComponent } from './features/administracion/administracion';
import { ClientesComponent } from './features/clientes/clientes';
import { UsuariosComponent } from './features/administracion/usuarios/usuarios';
import { Diccionario } from './features/administracion/diccionario/diccionario';
import { ContratistasComponent } from './features/contratistas/contratistas';
import { TrackerListComponent } from './features/proyectos/tracker-list/tracker-list';
import { GerencialComponent } from './features/proyectos/gerencial/gerencial';

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
      { path: 'panel', component: DashboardComponent },
      {
        path: 'administracion',
        component: AdministracionComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'admin' }
      },
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
        path: 'contratistas',
        component: ContratistasComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'admin.contratistas.leer' }
      },
      {
        path: 'proyectos',
        component: ProyectosComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'proyectos' }
      },
      {
        path: 'proyectos/todas',
        component: GerencialComponent,
        data: { permiso: 'proyectos.gerente' }
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
      { path: 'tickets', component: TicketsComponent },
      {
        path: 'tareas',
        component: TareasComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'tareas.ver' }
      },
      // ── NUEVO ───────────────────────────────────────────────
      {
        path: 'tareas/reportes',
        component: TareasReportesComponent,
        canActivate: [permissionGuard],
        data: { permiso: 'tareas.reportes' }
      }
      // ────────────────────────────────────────────────────────
    ]
  },

  // --- COMODÍN ---
  { path: '**', redirectTo: '' }
];
