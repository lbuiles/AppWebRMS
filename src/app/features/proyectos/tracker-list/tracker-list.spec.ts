import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackerList } from './tracker-list';

describe('TrackerList', () => {
  let component: TrackerList;
  let fixture: ComponentFixture<TrackerList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackerList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrackerList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
