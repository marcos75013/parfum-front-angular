import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Parfums } from './parfums';

describe('Parfums', () => {
  let component: Parfums;
  let fixture: ComponentFixture<Parfums>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Parfums],
    }).compileComponents();

    fixture = TestBed.createComponent(Parfums);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
