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
  deals: Parfum[] = [];
  filteredDeals: Parfum[] = [];
  bannerDeals: Parfum[] = [];

  search = '';
  loading = true;
  currentIndex = 0;

  readonly cartService = inject(CartService);
  readonly placeholderImage =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
    <svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="600" rx="40" fill="#f5eff7"/>
      <rect x="230" y="180" width="140" height="260" rx="24" fill="#ffffff" stroke="#4a2b3d" stroke-width="10"/>
      <rect x="260" y="120" width="80" height="70" rx="14" fill="#4a2b3d"/>
      <rect x="245" y="155" width="110" height="40" rx="12" fill="#7c3aed"/>
      <circle cx="300" cy="310" r="54" fill="#e9d5ff"/>
      <text x="300" y="505" text-anchor="middle" font-family="Arial" font-size="28" font-weight="700" fill="#4a2b3d">
        Escale Olfactive
      </text>
    </svg>
  `);
  readonly skeletonItems = Array.from({ length: 8 });

  private autoSlideInterval: ReturnType<typeof setInterval> | null = null;

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
      const parfums = await this.parfumService.loadParfums();

      this.deals = [...parfums]
        .filter((parfum) => this.getDiscountPercent(parfum) > 0)
        .sort((a, b) => this.getSavings(b) - this.getSavings(a));

      this.filteredDeals = [...this.deals];
      this.bannerDeals = this.deals.slice(0, 8);

      void this.loadImagesInBackground();

      if (this.bannerDeals.length > 1) {
        this.startAutoSlide();
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Erreur chargement meilleures affaires', error);
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
      return;
    }

    this.filteredDeals = this.deals.filter((parfum) =>
      [
        parfum.name,
        parfum.brand,
        parfum.gender,
        parfum.type ?? '',
        String(parfum.price),
        String(parfum.prix_boutique ?? ''),
        String(this.getDiscountPercent(parfum)),
      ]
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

  prev(): void {
    if (!this.bannerDeals.length) {
      return;
    }

    this.currentIndex = (this.currentIndex - 1 + this.bannerDeals.length) % this.bannerDeals.length;
  }

  next(): void {
    if (!this.bannerDeals.length) {
      return;
    }

    this.currentIndex = (this.currentIndex + 1) % this.bannerDeals.length;
  }

  goToSlide(index: number): void {
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

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.classList.add('loaded');
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;

    img.onerror = null;
    img.src = this.placeholderImage;
    img.classList.add('loaded');
  }

  private async loadImagesInBackground(): Promise<void> {
    const updates = await Promise.all(
      this.deals.map(async (parfum) => {
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

    this.filteredDeals = [...this.filteredDeals];
    this.bannerDeals = [...this.bannerDeals];
    this.cdr.detectChanges();
  }
}
