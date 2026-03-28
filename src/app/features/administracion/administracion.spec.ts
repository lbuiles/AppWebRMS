import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Administracion } from './administracion';

describe('Administracion', () => {
  let component: Administracion;
  let fixture: ComponentFixture<Administracion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Administracion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Administracion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
