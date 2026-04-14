import { Injectable, signal, computed } from '@angular/core';
import { Parfum } from '../models/parfum';

export interface CartItem {
  parfum: Parfum;
  quantity: number;
}

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly _items = signal<CartItem[]>([]);

  readonly items = computed(() => this._items());

  readonly count = computed(() => this._items().reduce((acc, item) => acc + item.quantity, 0));

  readonly total = computed(() =>
    this._items().reduce((acc, item) => acc + item.parfum.price * item.quantity, 0),
  );

  addToCart(parfum: Parfum): void {
    const items = this._items();
    const existing = items.find((i) => i.parfum.name === parfum.name);

    if (existing) {
      existing.quantity++;
      this._items.set([...items]);
    } else {
      this._items.set([...items, { parfum, quantity: 1 }]);
    }
  }

  decreaseQuantity(parfum: Parfum): void {
    const items = this._items();
    const existing = items.find((i) => i.parfum.name === parfum.name);

    if (!existing) return;

    if (existing.quantity > 1) {
      existing.quantity--;
      this._items.set([...items]);
    } else {
      this.removeFromCart(parfum);
    }
  }

  removeFromCart(parfum: Parfum): void {
    this._items.set(this._items().filter((i) => i.parfum.name !== parfum.name));
  }

  clearCart(): void {
    this._items.set([]);
  }
}
