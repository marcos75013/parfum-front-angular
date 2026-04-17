import { Routes } from '@angular/router';
import { ParfumsComponent } from './pages/parfums/parfums';
import { CartComponent } from './pages/cart/cart';
import { CheckoutComponent } from './pages/checkout/checkout';
import { MarquesComponent } from './pages/marques/marques';
import { MarqueDetailComponent } from './pages/marque-detail/marque-detail';
import { CgvComponent } from './pages/cgv/cgv';
import { PromotionsComponent } from './pages/promotions/promotions';

export const routes: Routes = [
  {
    path: '',
    component: ParfumsComponent,
    title: 'ParfumDeals - Accueil',
  },
  {
    path: 'parfums',
    component: ParfumsComponent,
    title: 'ParfumDeals - Parfums',
  },
  {
    path: 'promotions',
    component: PromotionsComponent,
    title: 'ParfumDeals - Promotions',
  },
  {
    path: 'marques',
    component: MarquesComponent,
    title: 'ParfumDeals - Marques',
  },
  {
    path: 'marques/:brand',
    component: MarqueDetailComponent,
    title: 'ParfumDeals - Détail marque',
  },
  {
    path: 'cart',
    component: CartComponent,
    title: 'ParfumDeals - Panier',
  },
  {
    path: 'checkout',
    component: CheckoutComponent,
    title: 'ParfumDeals - Commande',
  },
  {
    path: 'cgv',
    component: CgvComponent,
    title: 'ParfumDeals - Conditions générales de vente',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
