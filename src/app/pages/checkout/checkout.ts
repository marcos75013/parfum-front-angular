import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '../../services/cart.service';
import { Parfum } from '../../models/parfum';
import { environement } from './../../../environements/environement';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class CheckoutComponent {
  readonly cartService = inject(CartService);

  /**
   * Alias d’email affiché au client pour éviter toute surprise
   * tant que l’envoi passe encore par le domaine existant.
   */
  readonly contactEmailAlias = 'commandes@negociobom.eu';

  form = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    hasDeliveryPreferences: false,
    address: '',
    deliveryDate1: '',
    deliveryTime1: '',
    deliveryDate2: '',
    deliveryTime2: '',
  };

  readonly deliveryTimeSlots = [
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
  ];

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

  private buildSlot(date: string, time: string): string {
    if (!date || !time) {
      return '';
    }

    return `${date} ${time}`;
  }

  isDeliveryPreferencesValid(): boolean {
    if (!this.form.hasDeliveryPreferences) {
      return true;
    }

    const hasAddress = this.form.address.trim().length > 0;
    const hasDate1 = this.form.deliveryDate1.trim().length > 0;
    const hasTime1 = this.form.deliveryTime1.trim().length > 0;
    const hasDate2 = this.form.deliveryDate2.trim().length > 0;
    const hasTime2 = this.form.deliveryTime2.trim().length > 0;

    const slot1 = this.buildSlot(this.form.deliveryDate1, this.form.deliveryTime1);
    const slot2 = this.buildSlot(this.form.deliveryDate2, this.form.deliveryTime2);

    const slotsAreDifferent = slot1 !== '' && slot2 !== '' && slot1 !== slot2;

    return hasAddress && hasDate1 && hasTime1 && hasDate2 && hasTime2 && slotsAreDifferent;
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
      this.form.deliveryDate1 = '';
      this.form.deliveryTime1 = '';
      this.form.deliveryDate2 = '';
      this.form.deliveryTime2 = '';
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
            deliverySlot1: this.buildSlot(this.form.deliveryDate1, this.form.deliveryTime1),
            deliverySlot2: this.buildSlot(this.form.deliveryDate2, this.form.deliveryTime2),
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
    if (this.cartService.items().length === 0 || !this.isFormValid()) {
      return;
    }

    this.sending = true;
    this.successMessage = '';

    const payload = this.buildPayload();

    console.log('📤 Payload envoyé =', payload);

    this.http.post(`${environement.apiBaseUrl}/order`, payload).subscribe({
      next: () => {
        this.cartService.clearCart();
        this.successMessage = 'Demande envoyée avec succès. Nous vous recontacterons rapidement.';
        this.sending = false;

        setTimeout(() => {
          this.router.navigateByUrl('/');
        }, 1500);
      },
      error: (error) => {
        console.error('Erreur envoi commande', error);
        this.sending = false;
        alert("Une erreur est survenue lors de l'envoi de votre demande.");
      },
    });
  }
}
