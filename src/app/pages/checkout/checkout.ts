import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '../../services/cart.service';

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
