import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionHumana } from './gestion-humana';

describe('GestionHumana', () => {
  let component: GestionHumana;
  let fixture: ComponentFixture<GestionHumana>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionHumana]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GestionHumana);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
