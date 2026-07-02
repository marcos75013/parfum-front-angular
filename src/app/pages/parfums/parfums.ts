import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  Inject,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Parfum } from '../../models/parfum';
import { CartService } from '../../services/cart.service';
import { ParfumService } from '../../services/parfum.service';

type TabType = 'all' | 'standard' | 'testeur' | 'coffret' | 'nouveaute';

@Component({
  selector: 'app-parfums',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './parfums.html',
  styleUrl: './parfums.scss',
})
export class ParfumsComponent implements OnInit {
  parfums: Parfum[] = [];
  filteredParfums: Parfum[] = [];

  search = '';
  loading = true;
  activeTab: TabType = 'all';

  readonly cartService = inject(CartService);

  readonly placeholderImage = '/images/parfums/placeholder-parfum.png';

  readonly skeletonItems = Array.from({ length: 8 });

  private readonly priorityBrands: string[] = [
    'xerjoff',
    'creed',
    'dior',
    'hermès',
    'hermes',
    'kenzo',
    'chanel',
    'gucci',
    'versace',
    'tom ford',
    'tomford',
    'dolce & gabbana',
    'dolce and gabbana',
  ];

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
      const loadedParfums = await this.parfumService.loadParfums();

      this.parfums = loadedParfums.map((parfum) => ({
        ...parfum,
        image: this.getSafeDisplayImage(parfum.image),
      }));

      this.applyFilters();
    } catch (error) {
      console.error('Erreur chargement parfums', error);
      this.parfums = [];
      this.filteredParfums = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  filter(): void {
    this.applyFilters();
  }

  setTab(tab: TabType): void {
    this.activeTab = tab;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  addToCart(parfum: Parfum): void {
    this.cartService.addToCart(parfum);
  }

  isInCart(parfum: Parfum): boolean {
    return this.cartService.items().some(
      (item) =>
        item.parfum.name === parfum.name &&
        item.parfum.brand === parfum.brand,
    );
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

  countByType(type: TabType): number {
    if (type === 'all') {
      return this.parfums.length;
    }

    if (type === 'nouveaute') {
      return this.parfums.filter((parfum) => this.isMonthlyNew(parfum)).length;
    }

    return this.parfums.filter((parfum) => parfum.type === type).length;
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

  private applyFilters(): void {
    const term = this.search.trim().toLowerCase();

    let result = [...this.parfums];

    if (this.activeTab === 'nouveaute') {
      result = result.filter((parfum) => this.isMonthlyNew(parfum));
    } else if (this.activeTab !== 'all') {
      result = result.filter((parfum) => parfum.type === this.activeTab);
    }

    if (term) {
      result = result.filter((parfum) =>
        [
          parfum.name,
          parfum.brand,
          parfum.gender,
          parfum.type ?? '',
          String(parfum.price),
          String(parfum.prix_boutique ?? ''),
          String(this.getDiscountPercent(parfum)),
          this.isMonthlyNew(parfum) ? 'nouveauté nouveaute nouveau new' : '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(term),
      );
    }

    this.filteredParfums = this.shuffleWithPriority(result);
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

  private getSafeDisplayImage(image: string | null | undefined): string {
    const cleanImage = String(image ?? '').trim();

    if (!cleanImage) {
      return this.placeholderImage;
    }

    if (
      cleanImage.startsWith('/images/') ||
      cleanImage.startsWith('/assets/') ||
      cleanImage.startsWith('data:image/')
    ) {
      return cleanImage;
    }

    return this.placeholderImage;
  }

  private getPriorityWeight(parfum: Parfum): number {
    const brand = (parfum.brand ?? '').trim().toLowerCase();
    const name = (parfum.name ?? '').trim().toLowerCase();

    if (this.priorityBrands.includes(brand)) {
      return 4;
    }

    if (name.includes('creed')) {
      return 3;
    }

    return 1;
  }

  private shuffleWithPriority(parfums: Parfum[]): Parfum[] {
    return [...parfums]
      .map((parfum) => ({
        parfum,
        score: Math.random() * this.getPriorityWeight(parfum),
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.parfum);
  }
}
