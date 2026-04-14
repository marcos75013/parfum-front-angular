import { TestBed } from '@angular/core/testing';

import { Parfum } from './parfum';

describe('Parfum', () => {
  let service: Parfum;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Parfum);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
