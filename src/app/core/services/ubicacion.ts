import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// Actualizamos la estructura exacta que exige la nueva API del gobierno
export interface MunicipioDane {
  dpto: string;      // Antes era 'departamento'
  nom_mpio: string;  // Antes era 'municipio'
}

@Injectable({
  providedIn: 'root'
})
export class UbicacionService {
  private http = inject(HttpClient);

  // ¡El nuevo enlace oficial de Datos Abiertos para la DIVIPOLA!
  private apiUrl = 'https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=2000';

  public departamentos = signal<string[]>([]);
  private todosLosDatos = signal<MunicipioDane[]>([]);

  constructor() {
    this.cargarDatosDesdeAPI();
  }

  private cargarDatosDesdeAPI() {
    this.http.get<MunicipioDane[]>(this.apiUrl).subscribe({
      next: (datos) => {
        this.todosLosDatos.set(datos);

        // Extraemos los departamentos usando el nuevo nombre de la columna (dpto)
        const dptosUnicos = [...new Set(datos.map(item => item.dpto))].sort();
        this.departamentos.set(dptosUnicos);

      },
      error: (err) => console.error('❌ Error cargando datos del DANE', err)
    });
  }

  public obtenerCiudades(departamentoSeleccionado: string): string[] {
    return this.todosLosDatos()
      .filter(item => item.dpto === departamentoSeleccionado)
      .map(item => item.nom_mpio) // Usamos el nuevo nombre (nom_mpio)
      .sort();
  }
}
