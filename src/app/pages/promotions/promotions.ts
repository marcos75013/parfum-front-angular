import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CartService } from '../../services/cart.service';
import { Parfum } from '../../models/parfum';
import { ParfumService } from '../../services/parfum.service';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './promotions.html',
  styleUrl: './promotions.scss',
})
export class PromotionsComponent implements OnInit {
  private readonly parfumService = inject(ParfumService);
  readonly cartService = inject(CartService);

  promotions: Parfum[] = [];
  loading = true;

  async ngOnInit(): Promise<void> {
    try {
      const parfums = await this.parfumService.loadParfums();
      this.promotions = this.buildPromotions(parfums);
    } catch (error) {
      console.error('Erreur chargement promotions', error);
    } finally {
      this.loading = false;
    }
  }

  addToCart(parfum: Parfum): void {
    this.cartService.addToCart(parfum);
  }

  isInCart(parfum: Parfum): boolean {
    return this.cartService.items().some((item) => item.parfum.name === parfum.name);
  }

  getDiscountPercent(index: number): number {
    const discounts = [15, 20, 25, 30, 35];
    return discounts[index % discounts.length];
  }

  getOldPrice(parfum: Parfum, index: number): number {
    const discount = this.getDiscountPercent(index);
    return Number((parfum.price / (1 - discount / 100)).toFixed(2));
  }

  private buildPromotions(parfums: Parfum[]): Parfum[] {
    return [...parfums].sort((a, b) => a.price - b.price).slice(0, 12);
  }
}
