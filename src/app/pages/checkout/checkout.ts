import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '../../services/cart.service';
import { Parfum } from '../../models/parfum';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class CheckoutComponent {
  readonly cartService = inject(CartService);

  form = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
  };

  sending = false;
  successMessage = '';

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

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

  submit(): void {
    if (this.cartService.items().length === 0) {
      return;
    }

    this.sending = true;
    this.successMessage = '';

    const payload = {
      customer: this.form,
      items: this.cartService.items(),
      total: this.cartService.total(),
      savings: this.getTotalSavings(),
    };

    this.http.post('http://localhost:3000/api/order', payload).subscribe({
      next: () => {
        this.cartService.clearCart();
        this.successMessage = 'Commande envoyée avec succès.';
        this.sending = false;
        setTimeout(() => {
          this.router.navigateByUrl('/');
        }, 1200);
      },
      error: (error) => {
        console.error('Erreur envoi commande', error);
        this.sending = false;
        alert("Une erreur est survenue lors de l'envoi.");
      },
    });
  }
}
