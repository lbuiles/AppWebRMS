import { Routes } from '@angular/router';
import { authGuard, publicGuard, permissionGuard } from './core/auth/auth.guard';
import { cambiosPendientesGuard } from './core/guards/cambios-pendientes.guard';

// Componentes: el layout se carga de inmediato; cada pantalla se descarga al entrar a su ruta (lazy loading)
import { MainLayoutComponent } from './layout/main-layout/main-layout';

export const routes: Routes = [
  // --- ZONA PÚBLICA ---
  {
    path: '',
    loadComponent: () => import('./features/landing/landing').then(m => m.LandingComponent),
    pathMatch: 'full',
    canActivate: [publicGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then(m => m.LoginComponent),
    canActivate: [publicGuard]
  },

  // --- ZONA PRIVADA (ERP RMS) ---
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'panel', loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent) },
      {
        path: 'administracion',
        loadComponent: () => import('./features/administracion/administracion').then(m => m.AdministracionComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'admin' }
      },
      {
        path: 'config-cuadrillas',
        loadComponent: () => import('./features/administracion/config-cuadrillas/config-cuadrillas').then(m => m.ConfigCuadrillasComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'proyectos.cuadrillas.config' }
      },
      {
        path: 'diccionario',
        loadComponent: () => import('./features/administracion/diccionario/diccionario').then(m => m.Diccionario),
        canActivate: [permissionGuard],
        data: { permiso: 'admin' }
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./features/administracion/usuarios/usuarios').then(m => m.UsuariosComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'admin.usuarios.leer' }
      },
      {
        path: 'clientes',
        loadComponent: () => import('./features/clientes/clientes').then(m => m.ClientesComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'admin.clientes.leer' }
      },
      {
        path: 'contratistas',
        loadComponent: () => import('./features/contratistas/contratistas').then(m => m.ContratistasComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'admin.contratistas.leer' }
      },
      {
        path: 'proyectos',
        loadComponent: () => import('./features/proyectos/proyectos').then(m => m.ProyectosComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'proyectos' }
      },
      {
        path: 'proyectos/todas',
        loadComponent: () => import('./features/proyectos/gerencial/gerencial').then(m => m.GerencialComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'proyectos.gerente' }
      },
      {
        path: 'proyectos/cuadrillas',
        loadComponent: () => import('./features/proyectos/cuadrillas/cuadrillas').then(m => m.CuadrillasComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'proyectos.cuadrillas.ver' }
      },
      {
        path: 'proyectos/:linea',
        loadComponent: () => import('./features/proyectos/tracker-list/tracker-list').then(m => m.TrackerListComponent),
        canActivate: [permissionGuard],
        canDeactivate: [cambiosPendientesGuard],
        data: { permiso: 'proyectos' }
      },
      {
        path: 'finanzas',
        loadComponent: () => import('./features/finanzas/finanzas').then(m => m.FinanzasComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'finanzas' }
      },
      {
        path: 'gestion-humana',
        loadComponent: () => import('./features/gestion-humana/gestion-humana').then(m => m.GestionHumanaComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'gestionhumana' }
      },
      { path: 'tickets', loadComponent: () => import('./features/tickets/tickets').then(m => m.TicketsComponent) },
      {
        path: 'tareas',
        loadComponent: () => import('./features/tareas/tareas').then(m => m.TareasComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'tareas.ver' }
      },
      // ── NUEVO ───────────────────────────────────────────────
      {
        path: 'tareas/reportes',
        loadComponent: () => import('./features/tareas/tareas-reportes/tareas-reportes').then(m => m.TareasReportesComponent),
        canActivate: [permissionGuard],
        data: { permiso: 'tareas.reportes' }
      }
      // ────────────────────────────────────────────────────────
    ]
  },

  // --- COMODÍN ---
  // Redirige a /login en vez de '' (landing de marketing) para que rutas rotas
  // lleven al usuario al punto de entrada del ERP, no al sitio público.
  { path: '**', redirectTo: 'login' }
];
