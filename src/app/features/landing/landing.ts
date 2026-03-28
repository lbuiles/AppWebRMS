import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import emailjs from '@emailjs/browser';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './landing.html'
})
export class LandingComponent {

  // ================= 1. LÓGICA DE SERVICIOS =================
  servicioActivo: any = null;

  servicios = [
    {
      titulo: 'Obra Civil',
      imagen: '/img_home/ServicioObraCivil.jpeg',
      descripcion: 'Soluciones integrales en infraestructura, desde la concepción técnica hasta el mantenimiento especializado.',
      categorias: [
        { nombre: 'Ingeniería y Desarrollo', puntos: ['Levantamiento Topográfico', 'Diseños de ingeniería', 'Desarrollo y Ejecución'] },
        { nombre: 'Gestión de Activos', puntos: ['Operaciones y Mantenimiento'] },
        { nombre: 'Mantenimientos Locativos', puntos: ['Cerraduras', 'Soldaduras', 'Pintura', 'Hidrosanitario'] }
      ]
    },
    {
      titulo: 'Energía',
      imagen: '/img_home/SevicioEnergia.jpg',
      descripcion: 'Expertos en sistemas eléctricos de potencia, distribución y soluciones sostenibles.',
      categorias: [
        { nombre: 'Redes de Distribución', puntos: ['Estudios técnicos y diseños', 'Ejecución de la obra', 'Operación y mantenimiento', 'Atención y gestión de contingencias'] },
        { nombre: 'Subestaciones Eléctricas', puntos: ['Estudio de factibilidad', 'Diseño Técnico', 'Operación y Mantenimiento', 'Atención y gestión de contingencias'] },
        { nombre: 'Energías Renovables', puntos: ['Estudios técnicos y diseños', 'Montaje y construcción', 'Operación y mantenimiento', 'Atención y gestión de contingencias'] },
        { nombre: 'Plantas Eléctricas', puntos: ['Dimensionamiento', 'Montaje y construcción', 'Operación y mantenimiento correctivo y preventivo'] },
        { nombre: 'Iluminación Pública/Privada', puntos: ['Desarrollo de soluciones técnicas especializadas', 'Suministro e instalación del sistema', 'Optimización del sistema'] }
      ]
    },
    {
      titulo: 'Telecomunicaciones',
      imagen: '/img_home/SevicioTelecominicaciones.jpg',
      descripcion: 'Infraestructura de vanguardia para conectividad global y proyectos especiales.',
      categorias: [
        { nombre: 'Ciclo de Proyecto', puntos: ['Búsqueda y Adquisición', 'Regularización Técnica y Legal', 'Desarrollo de Ingenierías', 'Construcción de infraestructura', 'Operación y Mantenimiento'] },
        { nombre: 'Innovación', puntos: ['Proyectos Especiales Smart Pole'] }
      ]
    }
  ];

  abrirModal(servicio: any) {
    this.servicioActivo = servicio;
    document.body.style.overflow = 'hidden';
  }

  cerrarModal() {
    this.servicioActivo = null;
    document.body.style.overflow = 'auto';
  }

  // ================= 2. LÓGICA DE NOSOTROS =================
  nosotrosActivo: any = null;

  propuestaValor = {
    titulo: 'PROPUESTA DE VALOR',
    texto: 'RMS ofrece una combinación excepcional de servicio personalizado, respuestas rápidas y garantía de calidad. Nos comprometemos a utilizar los mejores materiales y prácticas disponibles para cumplir y superar las expectativas de nuestros clientes en cada proyecto, independientemente de su magnitud.'
  };

  datosNosotros = [
    {
      titulo: 'PROPÓSITO',
      texto: 'Diseño y construcción de proyectos confiables con un enfoque integral en la sostenibilidad, integrando prácticas y tecnologías innovadoras para minimizar el impacto ambiental.'
    },
    {
      titulo: 'VISIÓN',
      texto: 'En el 2028, nos consolidaremos como líderes confiables e innovadores en el diseño y desarrollo sostenible de infraestructura, telecomunicaciones, energías alternativas y construcción tanto en Colombia como en Latinoamérica.'
    }
  ];

  abrirModalNosotros(item: any) {
    this.nosotrosActivo = item;
    document.body.style.overflow = 'hidden';
  }

  cerrarModalNosotros() {
    this.nosotrosActivo = null;
    document.body.style.overflow = 'auto';
  }

  // ================= 3. LÓGICA DEL FORMULARIO =================

politicaActiva = false;

  abrirModalPolitica(event: Event) {
    event.preventDefault();
    this.politicaActiva = true;
    document.body.style.overflow = 'hidden';
  }

  cerrarModalPolitica(aceptar: boolean = false) {
    this.politicaActiva = false;
    document.body.style.overflow = 'auto';

    if (aceptar) {
    this.contactoForm.get('terminos')?.setValue(true);
  }
  }

  private fb = inject(FormBuilder);
  enviando = false;

  contactoForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    telefono: [''],
    email: ['', [Validators.required, Validators.email]],
    mensaje: ['', Validators.required],
    terminos: [false, Validators.requiredTrue]
  });

  async enviarMensaje() {
    if (this.contactoForm.valid) {
      this.enviando = true;
      const datos = this.contactoForm.value;

      try {
        emailjs.init('YYX6ThEPltwraQGrm');

        await emailjs.send(
          'service_qz0l40b',
          'template_zc0jnzc',
          {
            from_name: datos.nombre,
            from_email: datos.email,
            telefono: datos.telefono,
            message: datos.mensaje,
            autorizacion_datos: 'SÍ - El usuario autorizó el tratamiento de datos personales según Ley 1581 de 2012',
            reply_to: datos.email,
          }
        );

        // 2. SUCCESS ALERT personalizado
        Swal.fire({
          title: '¡Mensaje Enviado!',
          text: `Gracias ${datos.nombre}, nos contactaremos pronto.`,
          icon: 'success',
          confirmButtonColor: '#1e3a8a',
          confirmButtonText: 'Entendido',
          heightAuto: false
        });

        this.contactoForm.reset();

      } catch (error) {
        console.error('Error enviando el correo:', error);

        // 3. ERROR ALERT personalizado
        Swal.fire({
          title: 'Error al enviar',
          text: 'No pudimos procesar tu mensaje. Intenta de nuevo más tarde.',
          icon: 'error',
          confirmButtonColor: '#d33',
          heightAuto: false
        });
      } finally {
        this.enviando = false;
      }

    } else {
      // 4. WARNING ALERT si el formulario está incompleto
      Swal.fire({
        title: 'Formulario incompleto',
        text: 'Por favor, completa los campos obligatorios y acepta la política de datos.',
        icon: 'warning',
        confirmButtonColor: '#ffb31c',
        heightAuto: false
      });
      this.contactoForm.markAllAsTouched();
    }
  }
}
