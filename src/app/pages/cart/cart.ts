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
}
