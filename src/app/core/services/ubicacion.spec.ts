import { TestBed } from '@angular/core/testing';

import { Ubicacion } from './ubicacion';

describe('Ubicacion', () => {
  let service: Ubicacion;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Ubicacion);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
