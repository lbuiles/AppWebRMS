import { ComponentFixture, TestBed } from '@angular/core/testing';

// 1. Aquí cambiamos Sidebar por SidebarComponent
import { SidebarComponent } from './sidebar';

describe('SidebarComponent', () => { // 2. Aquí también es buena práctica cambiarlo
  let component: SidebarComponent; // 3. Aquí
  let fixture: ComponentFixture<SidebarComponent>; // 4. Aquí

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent] // 5. Y aquí
    })
    .compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
