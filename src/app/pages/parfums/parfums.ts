import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Parfum } from '../../models/parfum';
import { CartService } from '../../services/cart.service';
import { ParfumService } from '../../services/parfum.service';

type TabType = 'all' | 'standard' | 'testeur' | 'coffret';

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

  // Image de secours si une image ne charge pas
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
  // Nombre de skeleton cards affichées pendant le chargement
  readonly skeletonItems = Array.from({ length: 8 });

  /**
   * Marques prioritaires dans l'affichage aléatoire.
   * Elles restent mélangées, mais ont plus de chances de remonter.
   */
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
      this.parfums = await this.parfumService.loadParfums();
      this.applyFilters();

      // charge les images internet via le backend sans bloquer l'affichage initial
      void this.loadImagesInBackground();

      // force le rafraîchissement pour éviter le double clic nécessaire
      this.cdr.detectChanges();
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

  countByType(type: TabType): number {
    if (type === 'all') {
      return this.parfums.length;
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

    if (this.activeTab !== 'all') {
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
        ]
          .join(' ')
          .toLowerCase()
          .includes(term),
      );
    }

    this.filteredParfums = this.shuffleWithPriority(result);
  }

  /**
   * Donne plus de poids à certaines marques pour qu'elles remontent
   * plus souvent dans l'ordre final, tout en gardant un rendu aléatoire.
   */
  private getPriorityWeight(parfum: Parfum): number {
    const brand = (parfum.brand ?? '').trim().toLowerCase();
    const name = (parfum.name ?? '').trim().toLowerCase();

    if (this.priorityBrands.includes(brand)) {
      return 4;
    }

    // Bonus pour Angels' Share / Angel
    if (name.includes('creed')) {
      return 3;
    }

    return 1;
  }

  /**
   * Mélange la liste avec priorité douce pour certaines marques.
   */
  private shuffleWithPriority(parfums: Parfum[]): Parfum[] {
    return [...parfums]
      .map((parfum) => ({
        parfum,
        score: Math.random() * this.getPriorityWeight(parfum),
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.parfum);
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
