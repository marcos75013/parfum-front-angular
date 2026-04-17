import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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

  constructor(
    private readonly route: ActivatedRoute,
    private readonly parfumService: ParfumService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const brandParam = this.route.snapshot.paramMap.get('brand') ?? '';
      this.brand = decodeURIComponent(brandParam);

      const allParfums = await this.parfumService.loadParfums();
      this.parfums = this.parfumService.getParfumsByBrand(allParfums, this.brand);

      console.log('Brand param:', this.brand);
      console.log('Produits trouvés:', this.parfums.length);
      console.log('Exemple produits:', this.parfums.slice(0, 5));

      this.loading = false;
      this.cdr.detectChanges();

      void this.loadImagesInBackground();
    } catch (error) {
      console.error('Erreur chargement produits par marque', error);
      this.parfums = [];
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

  private async loadImagesInBackground(): Promise<void> {
    for (const parfum of this.parfums) {
      try {
        const image = await this.parfumService.fetchPerfumeImage(parfum);
        parfum.image = image;
      } catch (error) {
        console.error(`Erreur mise à jour image pour "${parfum.name}"`, error);
      }
    }

    this.parfums = [...this.parfums];
    this.cdr.detectChanges();
  }
}
