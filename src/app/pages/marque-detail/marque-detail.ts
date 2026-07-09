import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Parfum } from '../../models/parfum';
import { CartService } from '../../services/cart.service';
import { ParfumService } from '../../services/parfum.service';

@Component({
  selector: 'app-marque-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './marque-detail.html',
  styleUrl: './marque-detail.scss',
})
export class MarqueDetailComponent implements OnInit {
  parfums: Parfum[] = [];
  brand = '';
  loading = true;

  readonly cartService = inject(CartService);
  readonly placeholderImage = '/assets/images/placeholder-parfum.jpg';
  readonly skeletonItems = Array.from({ length: 8 });

  constructor(
    private readonly route: ActivatedRoute,
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
      const brandParam = this.route.snapshot.paramMap.get('brand') ?? '';
      this.brand = decodeURIComponent(brandParam);

      const allParfums = await this.parfumService.loadParfums();
      this.parfums = this.parfumService.getParfumsByBrand(allParfums, this.brand);

      this.cdr.detectChanges();
      void this.loadImagesInBackground();
    } catch (error) {
      console.error('Erreur chargement produits par marque', error);
      this.parfums = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
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

  isMonthlyNew(parfum: Parfum): boolean {
    return (
        parfum as Parfum & {
          nouveaute?: boolean;
          nouveaute_mois?: boolean;
          isNew?: boolean;
        }
      ).nouveaute === true ||
      (parfum as Parfum & { nouveaute_mois?: boolean }).nouveaute_mois ===
      true ||
      (parfum as Parfum & { isNew?: boolean }).isNew === true;
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.classList.add('loaded');
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;

    if (!img.src.includes(this.placeholderImage)) {
      img.src = this.placeholderImage;
      return;
    }

    img.classList.add('loaded');
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

    this.parfums = [...this.parfums];
    this.cdr.detectChanges();
  }
}
