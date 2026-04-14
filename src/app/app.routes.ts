import { Routes } from '@angular/router';
import { ParfumsComponent } from './pages/parfums/parfums';
import { CartComponent } from './pages/cart/cart';
import { CheckoutComponent } from './pages/checkout/checkout';

export const routes: Routes = [
  {
    path: '',
    component: ParfumsComponent,
  },
  {
    path: 'cart',
    component: CartComponent,
  },
  {
    path: 'checkout',
    component: CheckoutComponent,
  },
];
