import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CartService } from '../../services/cart.service';
import { Parfum } from '../../models/parfum';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class CartComponent {
  readonly cartService = inject(CartService);

  increase(parfum: Parfum): void {
    this.cartService.addToCart(parfum);
  }

  decrease(parfum: Parfum): void {
    this.cartService.decreaseQuantity(parfum);
  }

  remove(parfum: Parfum): void {
    this.cartService.removeFromCart(parfum);
  }

  getOldPrice(parfum: Parfum): number {
    const oldPrice =
      Number((parfum as any).prixBoutique) ||
      Number((parfum as any).oldPrice) ||
      Number((parfum as any).prix_boutique) ||
      0;

    return oldPrice;
  }

  getItemSavings(parfum: Parfum, quantity: number): number {
    const currentPrice = Number(parfum.price) || 0;
    const oldPrice = this.getOldPrice(parfum);

    if (oldPrice <= currentPrice) {
      return 0;
    }

    return (oldPrice - currentPrice) * quantity;
  }

  getTotalSavings(): number {
    return this.cartService.items().reduce((total, item) => {
      return total + this.getItemSavings(item.parfum, item.quantity);
    }, 0);
  }
}
