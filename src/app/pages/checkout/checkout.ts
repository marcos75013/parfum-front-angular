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
    hasDeliveryPreferences: false,
    address: '',
    deliverySlot1: '',
    deliverySlot2: '',
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

  onPhoneInput(): void {
    this.form.phone = this.form.phone.replace(/[^\d+()\s.-]/g, '');
  }

  getNormalizedPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('33') && cleaned.length === 11) {
      return `0${cleaned.slice(2)}`;
    }

    return cleaned;
  }

  isPhoneValid(): boolean {
    const normalizedPhone = this.getNormalizedPhone(this.form.phone);
    return /^0[1-9]\d{8}$/.test(normalizedPhone);
  }

  isEmailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim());
  }

  isDeliveryPreferencesValid(): boolean {
    if (!this.form.hasDeliveryPreferences) {
      return true;
    }

    const hasAddress = this.form.address.trim().length > 0;
    const hasSlot1 = this.form.deliverySlot1.trim().length > 0;
    const hasSlot2 = this.form.deliverySlot2.trim().length > 0;
    const slotsAreDifferent =
      this.form.deliverySlot1.trim() !== '' &&
      this.form.deliverySlot2.trim() !== '' &&
      this.form.deliverySlot1 !== this.form.deliverySlot2;

    return hasAddress && hasSlot1 && hasSlot2 && slotsAreDifferent;
  }

  isFormValid(): boolean {
    const hasRequiredIdentityFields =
      this.form.firstName.trim().length > 0 &&
      this.form.lastName.trim().length > 0 &&
      this.isEmailValid() &&
      this.isPhoneValid();

    return hasRequiredIdentityFields && this.isDeliveryPreferencesValid();
  }

  toggleDeliveryPreferences(): void {
    if (!this.form.hasDeliveryPreferences) {
      this.form.address = '';
      this.form.deliverySlot1 = '';
      this.form.deliverySlot2 = '';
    }
  }

  private buildPayload() {
    const normalizedPhone = this.getNormalizedPhone(this.form.phone);

    return {
      customer: {
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim(),
        phone: normalizedPhone,
      },
      deliveryPreferences: this.form.hasDeliveryPreferences
        ? {
            enabled: true,
            address: this.form.address.trim(),
            deliverySlot1: this.form.deliverySlot1,
            deliverySlot2: this.form.deliverySlot2,
          }
        : {
            enabled: false,
            address: '',
            deliverySlot1: '',
            deliverySlot2: '',
          },
      items: this.cartService.items(),
      total: this.cartService.total(),
      savings: this.getTotalSavings(),
    };
  }

  submit(): void {
    if (this.cartService.items().length === 0) {
      return;
    }

    this.sending = true;
    this.successMessage = '';

    const normalizedPhone = this.getNormalizedPhone(this.form.phone);

    const payload = {
      customer: {
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim(),
        phone: normalizedPhone,
      },
      deliveryPreferences: this.form.hasDeliveryPreferences
        ? {
          enabled: true,
          address: this.form.address.trim(),
          deliverySlot1: this.form.deliverySlot1,
          deliverySlot2: this.form.deliverySlot2,
        }
        : {
          enabled: false,
          address: '',
          deliverySlot1: '',
          deliverySlot2: '',
        },
      items: this.cartService.items(),
      total: this.cartService.total(),
      savings: this.getTotalSavings(),
    };

    console.log('📤 Payload envoyé =', payload);

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
