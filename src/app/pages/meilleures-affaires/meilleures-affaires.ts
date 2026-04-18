import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Parfum } from '../../models/parfum';
import { CartService } from '../../services/cart.service';
import { ParfumService } from '../../services/parfum.service';

@Component({
  selector: 'app-meilleures-affaires',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './meilleures-affaires.html',
  styleUrl: './meilleures-affaires.scss',
})
export class MeilleuresAffairesComponent implements OnInit, OnDestroy {
  parfums: Parfum[] = [];
  deals: Parfum[] = [];
  filteredDeals: Parfum[] = [];
  bannerDeals: Parfum[] = [];

  search = '';
  loading = true;

  currentIndex = 0;
  private autoSlideInterval: ReturnType<typeof setInterval> | null = null;

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

      const sorted = [...this.parfums]
        .filter((parfum) => this.getDiscountPercent(parfum) > 0)
        .sort((a, b) => {
          const discountDiff = this.getDiscountPercent(b) - this.getDiscountPercent(a);

          if (discountDiff !== 0) {
            return discountDiff;
          }

          return this.getSavings(b) - this.getSavings(a);
        });

      this.deals = sorted;
      this.filteredDeals = [...sorted];

      this.rebuildBannerDeals();

      await this.loadImagesInBackground();
    } catch (error) {
      console.error('Erreur chargement meilleures affaires', error);
      this.parfums = [];
      this.deals = [];
      this.filteredDeals = [];
      this.bannerDeals = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  filter(): void {
    const term = this.search.trim().toLowerCase();

    if (!term) {
      this.filteredDeals = [...this.deals];
    } else {
      this.filteredDeals = this.deals.filter((parfum) =>
        [
          parfum.name,
          parfum.brand,
          parfum.gender,
          String(parfum.price),
          String(parfum.prix_boutique ?? ''),
          String(this.getDiscountPercent(parfum)),
          String(this.getSavings(parfum)),
        ]
          .join(' ')
          .toLowerCase()
          .includes(term),
      );
    }

    this.rebuildBannerDeals();
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

  getDiscountPercent(parfum: Parfum): number {
    return this.parfumService.getDiscountPercent(parfum);
  }

  getOldPrice(parfum: Parfum): number {
    return parfum.prix_boutique ?? parfum.price;
  }

  getSavings(parfum: Parfum): number {
    return this.parfumService.getSavings(parfum);
  }

  getAverageDiscount(): number {
    if (!this.deals.length) {
      return 0;
    }

    const total = this.deals.reduce((sum, parfum) => sum + this.getDiscountPercent(parfum), 0);

    return Math.round(total / this.deals.length);
  }

  getAverageSavings(): number {
    if (!this.deals.length) {
      return 0;
    }

    const total = this.deals.reduce((sum, parfum) => sum + this.getSavings(parfum), 0);

    return total / this.deals.length;
  }

  getCurrentBannerDeal(): Parfum | null {
    if (!this.bannerDeals.length) {
      return null;
    }

    return this.bannerDeals[this.currentIndex] ?? null;
  }

  next(): void {
    if (!this.bannerDeals.length) {
      return;
    }

    this.currentIndex = (this.currentIndex + 1) % this.bannerDeals.length;
  }

  prev(): void {
    if (!this.bannerDeals.length) {
      return;
    }

    this.currentIndex = (this.currentIndex - 1 + this.bannerDeals.length) % this.bannerDeals.length;
  }

  goToSlide(index: number): void {
    if (index < 0 || index >= this.bannerDeals.length) {
      return;
    }

    this.currentIndex = index;
  }

  startAutoSlide(): void {
    this.stopAutoSlide();

    if (this.bannerDeals.length <= 1) {
      return;
    }

    this.autoSlideInterval = setInterval(() => {
      this.next();
      this.cdr.detectChanges();
    }, 4000);
  }

  stopAutoSlide(): void {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
      this.autoSlideInterval = null;
    }
  }

  onBannerImageError(parfum: Parfum): void {
    parfum.image = '';

    this.bannerDeals = this.bannerDeals.filter((item) => !this.isSameParfum(item, parfum));

    if (this.currentIndex >= this.bannerDeals.length) {
      this.currentIndex = 0;
    }

    this.startAutoSlide();
    this.cdr.detectChanges();
  }

  onDealImageError(parfum: Parfum): void {
    parfum.image = '';
    this.rebuildBannerDeals();
    this.cdr.detectChanges();
  }

  hasValidImage(parfum: Parfum): boolean {
    const image = (parfum.image ?? '').trim();

    if (!image) {
      return false;
    }

    const normalized = image.toLowerCase();

    if (
      normalized.includes('placeholder') ||
      normalized.includes('default') ||
      normalized.includes('no-image') ||
      normalized.includes('no_image') ||
      normalized.includes('image-not-found') ||
      normalized.endsWith('/undefined') ||
      normalized.endsWith('/null')
    ) {
      return false;
    }

    return (
      normalized.startsWith('http://') ||
      normalized.startsWith('https://') ||
      normalized.startsWith('/assets/') ||
      normalized.startsWith('assets/') ||
      normalized.startsWith('/images/') ||
      normalized.startsWith('images/')
    );
  }

  private rebuildBannerDeals(): void {
    this.bannerDeals = this.filteredDeals
      .filter((parfum) => this.hasValidImage(parfum))
      .slice(0, 5);

    if (this.currentIndex >= this.bannerDeals.length) {
      this.currentIndex = 0;
    }

    this.startAutoSlide();
    this.cdr.detectChanges();
  }

  private isSameParfum(a: Parfum, b: Parfum): boolean {
    return a.name === b.name && a.brand === b.brand;
  }

  private async loadImagesInBackground(): Promise<void> {
    const updates = await Promise.all(
      this.parfums.map(async (parfum) => {
        try {
          const image = await this.parfumService.fetchPerfumeImage(parfum);
          return { parfum, image: image?.trim() ?? '' };
        } catch {
          return { parfum, image: '' };
        }
      }),
    );

    for (const update of updates) {
      update.parfum.image = update.image;
    }

    this.rebuildBannerDeals();
  }
}
