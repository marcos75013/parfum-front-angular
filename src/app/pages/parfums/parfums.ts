import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Parfum } from '../../models/parfum';
import { CartService } from '../../services/cart.service';
import { ParfumService } from '../../services/parfum.service';

@Component({
  selector: 'app-parfums',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parfums.html',
  styleUrl: './parfums.scss',
})
export class ParfumsComponent implements OnInit {
  parfums: Parfum[] = [];
  filteredParfums: Parfum[] = [];
  search = '';
  loading = true;

  readonly cartService = inject(CartService);

  constructor(
    private readonly parfumService: ParfumService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      this.parfums = await this.parfumService.loadParfums();
      this.filteredParfums = [...this.parfums];

      void this.loadImagesInBackground();
    } catch (error) {
      console.error('Erreur chargement parfums', error);
      this.parfums = [];
      this.filteredParfums = [];
    } finally {
      this.loading = false;

      // Force le refresh de la vue après chargement async
      // pour éviter d’avoir à recliquer pour voir la liste.
      this.cdr.detectChanges();
    }
  }

  filter(): void {
    const term = this.search.trim().toLowerCase();

    if (!term) {
      this.filteredParfums = [...this.parfums];
      return;
    }

    this.filteredParfums = this.parfums.filter((parfum) =>
      [parfum.name, parfum.brand, parfum.gender, String(parfum.price)]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }

  addToCart(parfum: Parfum): void {
    this.cartService.addToCart(parfum);
  }

  isInCart(parfum: Parfum): boolean {
    return this.cartService
      .items()
      .some((item) => item.parfum.name === parfum.name && item.parfum.brand === parfum.brand);
  }

  trackByName(_index: number, parfum: Parfum): string {
    return `${parfum.brand}-${parfum.name}`;
  }

  private async loadImagesInBackground(): Promise<void> {
    const updates = await Promise.all(
      this.parfums.map(async (parfum) => {
        try {
          const image = await this.parfumService.fetchPerfumeImage(parfum);
          return { parfum, image };
        } catch {
          return { parfum, image: parfum.image };
        }
      }),
    );

    for (const update of updates) {
      update.parfum.image = update.image;
    }

    this.filteredParfums = [...this.filteredParfums];
    this.cdr.detectChanges();
  }
}
