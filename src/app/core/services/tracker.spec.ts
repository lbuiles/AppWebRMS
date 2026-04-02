import { TestBed } from '@angular/core/testing';

import { Tracker } from './tracker';

describe('Tracker', () => {
  let service: Tracker;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Tracker);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
