import { Directive, HostListener, ElementRef, OnInit } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: '[appCurrencyMask]',
  standalone: true
})
export class CurrencyMaskDirective implements OnInit {

  constructor(private el: ElementRef, private control: NgControl) {}

  ngOnInit() {
    // Formatear el valor inicial si existe
    if (this.control.value) {
      this.formatValue(this.control.value);
    }
  }

 @HostListener('input', ['$event'])
  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input) return;

    const value = input.value;
    const cleanValue = value.replace(/\D/g, '');

    const numericValue = cleanValue ? parseInt(cleanValue, 10) : 0;
    this.control.control?.setValue(numericValue, { emitEvent: false });

    this.formatValue(cleanValue);
  }

  private formatValue(value: string | number | null | undefined) {
    const input = this.el.nativeElement as HTMLInputElement;

    if (value === null || value === undefined || value === '') {
      input.value = '';
      return;
    }

    // Convertimos a string y limpiamos cualquier residuo no numérico
    const numStr = value.toString().replace(/\D/g, '');

    if (!numStr) {
      input.value = '';
      return;
    }

    const formatted = new Intl.NumberFormat('es-CO').format(parseInt(numStr, 10));
    input.value = `$ ${formatted}`;
  }
}
