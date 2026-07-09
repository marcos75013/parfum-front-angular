import { Routes } from '@angular/router';
import { ParfumsComponent } from './pages/parfums/parfums';
import { CartComponent } from './pages/cart/cart';
import { CheckoutComponent } from './pages/checkout/checkout';
import { MarquesComponent } from './pages/marques/marques';
import { MarqueDetailComponent } from './pages/marque-detail/marque-detail';
import { CgvComponent } from './pages/cgv/cgv';
import { MeilleuresAffairesComponent } from './pages/meilleures-affaires/meilleures-affaires';

export const routes: Routes = [
  {
    path: '',
    component: ParfumsComponent,
    title: 'EscaleOlfactive - Accueil',
  },
  {
    path: 'parfums',
    component: ParfumsComponent,
    title: 'EscaleOlfactive - Parfums',
  },
  {
    path: 'meilleures-affaires',
    component: MeilleuresAffairesComponent,
    title: 'EscaleOlfactive - Meilleures affaires',
  },
  {
    path: 'promotions',
    redirectTo: 'meilleures-affaires',
    pathMatch: 'full',
  },
  {
    path: 'marques',
    component: MarquesComponent,
    title: 'EscaleOlfactive - Marques',
  },
  {
    path: 'marques/:brand',
    component: MarqueDetailComponent,
    title: 'EscaleOlfactive - Détail marque',
  },
  {
    path: 'cart',
    component: CartComponent,
    title: 'EscaleOlfactive - Panier',
  },
  {
    path: 'checkout',
    component: CheckoutComponent,
    title: 'EscaleOlfactive - Commande',
  },
  {
    path: 'cgv',
    component: CgvComponent,
    title: 'EscaleOlfactive - Conditions générales de vente',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
