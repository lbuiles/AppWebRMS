import { Component, signal, inject } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError, RouterOutlet } from '@angular/router';
import { LoadingService } from './core/services/loading';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('rms-app');

  // Inyectamos los servicios necesarios
  public loadingService = inject(LoadingService);
  private router = inject(Router);

  constructor() {
    // Escuchamos los eventos del router para activar/desactivar la barra
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.loadingService.show();
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        // Un pequeño retraso de 300ms para que la animación se aprecie
        setTimeout(() => this.loadingService.hide(), 300);
      }
    });
  }
}
