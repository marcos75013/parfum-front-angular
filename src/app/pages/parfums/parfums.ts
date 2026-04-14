import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Parfum } from '../../models/parfum';
import { CartService } from '../../services/cart.service';
import { ParfumService } from '../../services/parfum.service';

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

  readonly cartService = inject(CartService);

  constructor(private parfumService: ParfumService) {}

  async ngOnInit(): Promise<void> {
    try {
      this.parfums = await this.parfumService.loadParfums();
      this.filteredParfums = [...this.parfums];
      void this.loadImagesInBackground();
    } catch (error) {
      console.error('Erreur chargement parfums', error);
    } finally {
      this.loading = false;
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
    for (const parfum of this.parfums) {
      try {
        const image = await this.parfumService.fetchPerfumeImage(parfum);
        parfum.image = image;
      } catch (error) {
        console.error(`Erreur mise à jour image pour "${parfum.name}"`, error);
      }
    }

    this.filteredParfums = [...this.filteredParfums];
  }
}
