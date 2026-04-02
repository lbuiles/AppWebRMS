import { TestBed } from '@angular/core/testing';

import { Proyecto } from './proyecto';

describe('Proyecto', () => {
  let service: Proyecto;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Proyecto);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
