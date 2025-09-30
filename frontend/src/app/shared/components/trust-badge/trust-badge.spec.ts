import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrustBadge } from './trust-badge';

describe('TrustBadge', () => {
  let component: TrustBadge;
  let fixture: ComponentFixture<TrustBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrustBadge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrustBadge);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
