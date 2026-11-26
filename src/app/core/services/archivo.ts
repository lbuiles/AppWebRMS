import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

/**
 * Abre documentos subidos (clientes, contratistas, ...) pidiéndolos a la API con la sesión,
 * porque /uploads ya no es público.
 */
@Injectable({ providedIn: 'root' })
export class ArchivoService {
  private http = inject(HttpClient);

  abrir(ruta: string): void {
    // Se abre la pestaña de inmediato (en el clic) para que el navegador no la bloquee
    const ventana = window.open('', '_blank');
    let token = '';
    try { token = localStorage.getItem('rms_token') ?? ''; } catch { /* sin storage */ }
    const headers = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});

    this.http.get(`${environment.restUrl}/archivos?ruta=${encodeURIComponent(ruta)}`, { headers, responseType: 'blob' })
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          if (ventana) ventana.location.href = url; else window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        },
        error: err => {
          ventana?.close();
          const msg = err?.status === 403 ? 'No tienes permiso para ver este documento.'
                    : err?.status === 404 ? 'El documento no existe o fue eliminado.'
                    : 'No se pudo abrir el documento.';
          Swal.fire('Documento', msg, 'error');
        }
      });
  }
}
