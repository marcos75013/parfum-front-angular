export type ParfumType = 'standard' | 'testeur' | 'coffret';

export interface Parfum {
  name: string;
  brand: string;
  gender: string;
  price: number;
  prix_boutique?: number;
  image?: string;
  type: ParfumType;
}
