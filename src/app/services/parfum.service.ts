import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Parfum } from '../models/parfum';
import { environement } from '../../environements/environement';

interface PerfumeImageResponse {
  imageUrl: string;
}

interface RawParfumJson {
  nom?: unknown;
  name?: unknown;
  marque?: unknown;
  brand?: unknown;
  genre?: unknown;
  gender?: unknown;
  prix?: unknown;
  price?: unknown;
  prix_boutique?: unknown;
  prixBoutique?: unknown;
  oldPrice?: unknown;
  image?: unknown;
  type?: unknown;
  typeProduit?: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class ParfumService {
  private readonly jsonUrl = '/data/parfums_with_type_mai_2026.json';
  private readonly apiBaseUrl = environement.apiBaseUrl;

  private imageCache = new Map<string, string>();
  private isBrowser = typeof window !== 'undefined';

  private readonly knownBrands: string[] = [
    'Yves Saint Laurent',
    'Jean Paul Gaultier',
    'Dolce & Gabbana',
    'Van Cleef And Arpels',
    'Narciso Rodriguez',
    'Viktor & Rolf',
    'Carolina Herrera',
    'Juliette Has A Gun',
    'Atelier Des Ors',
    'Arte Profumi',
    'Arabian Oud',
    'Agathe Kattegat',
    'Elie Saab',
    'Hugo Boss',
    'Issey Miyake',
    'Jimmy Choo',
    'Jean Couturier',
    'Jo Malone',
    'Tom Ford',
    'Marc Jacobs',
    'Matière Première',
    'Paco Rabanne',
    'Paul Smith',
    'Ted Lapidus',
    'Thierry Mugler',
    'Tiziana Terenzi',
    'Guy Laroche',
    'Frédéric Malle',
    'Franck Boclet',
    'Façonnable',
    'Estée Lauder',
    'Estee Lauder',
    'Calvin Klein',
    'Mauboussin',
    'Mont Blanc',
    'Montale',
    'Lancôme',
    'Lancome',
    'Nina Ricci',
    'Rosendo Mateu',
    'Les Liquides Imaginaires',
    'Lolita Lempicka',
    'Azzaro',
    'Armani',
    'Boucheron',
    'Burberry',
    'Bvlgari',
    'Cacharel',
    'Cartier',
    'Castel',
    'Cerruti',
    'Chloé',
    'Chopard',
    'Clinique',
    'Creed',
    'Diesel',
    'Dior',
    'Escada',
    'Givenchy',
    'Gucci',
    'Guerlain',
    'Guess',
    'Hermès',
    'Hermes',
    'Kenzo',
    'Kilian',
    'Korloff',
    'Lacoste',
    'Lalique',
    'Lanvin',
    'Maissa',
    'Mancera',
    'Moschino',
    'Nishane',
    'Nuxe',
    'Prada',
    'Rochas',
    'Serge Lutens',
    'Valentino',
    'Versace',
    'Xerjoff',
    'Zadig & Voltaire',
    'Elizabeth Arden',
    'Emanuel Ungaro',
  ].sort((a, b) => b.length - a.length);

  constructor(private readonly http: HttpClient) {}

  async loadParfums(): Promise<Parfum[]> {
    try {
      const data = await firstValueFrom(this.http.get<RawParfumJson[]>(this.jsonUrl));

      const parfums: Parfum[] = [];

      for (const item of data) {
        const name = this.cleanString(item.nom ?? item.name);
        const explicitBrand = this.cleanString(item.marque ?? item.brand);
        const gender = this.normalizeGender(item.genre ?? item.gender);
        const price = this.parsePrice(item.prix ?? item.price);
        const prixBoutique = this.parsePrice(
          item.prix_boutique ?? item.prixBoutique ?? item.oldPrice,
        );

        if (!name || !gender || price === null) continue;

        const finalPrixBoutique =
          prixBoutique !== null && prixBoutique > price ? prixBoutique : undefined;

        const parfum: Parfum = {
          name,
          brand: explicitBrand || this.extractBrand(name),
          gender,
          price,
          prix_boutique: finalPrixBoutique,
          image: this.cleanString(item.image),
          type: this.normalizeType(item.type ?? item.typeProduit ?? name),
        };

        parfums.push(parfum);
      }

      // ✅ BON ENDROIT
      this.loadImagesInBackground(parfums);

      return [...parfums].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
      );
    } catch (error) {
      console.error('Erreur lors du chargement des parfums :', error);
      throw error;
    }
  }

  private async loadImagesInBackground(parfums: Parfum[]) {
    const BATCH_SIZE = 5;

    for (let i = 0; i < parfums.length; i += BATCH_SIZE) {
      const batch = parfums.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (parfum) => {
          if (parfum.image) return;

          const image = await this.fetchPerfumeImage(parfum);
          parfum.image = image;
        }),
      );
    }

    console.log('✅ Images chargées progressivement');
  }

  async fetchPerfumeImage(parfum: Parfum): Promise<string> {
    const key = `${parfum.brand}_${parfum.name}`.toLowerCase().trim();

    if (this.imageCache.has(key)) {
      return this.imageCache.get(key)!;
    }

    if (this.isBrowser) {
      const stored = localStorage.getItem(key);
      if (stored) {
        this.imageCache.set(key, stored);
        return stored;
      }
    }

    try {
      const response = await firstValueFrom(
        this.http.get<PerfumeImageResponse>(`${this.apiBaseUrl}/perfumes/image`, {
          params: {
            name: parfum.name,
            brand: parfum.brand,
          },
        }),
      );

      const image = response?.imageUrl || this.getFallbackImage(parfum);

      this.imageCache.set(key, image);

      if (this.isBrowser) {
        localStorage.setItem(key, image);
      }

      return image;
    } catch {
      return this.getFallbackImage(parfum);
    }
  }

  getBrands(parfums: Parfum[]): string[] {
    return [...new Set(parfums.map((p) => p.brand).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' }),
    );
  }

  getParfumsByBrand(parfums: Parfum[], brand: string): Parfum[] {
    const normalizedBrand = this.normalizeForCompare(brand);

    return parfums.filter((p) => this.normalizeForCompare(p.brand) === normalizedBrand);
  }

  getBrandProductCount(parfums: Parfum[], brand: string): number {
    return this.getParfumsByBrand(parfums, brand).length;
  }

  getDiscountPercent(parfum: Parfum): number {
    if (!parfum.prix_boutique || parfum.prix_boutique <= parfum.price) return 0;

    return Math.round(((parfum.prix_boutique - parfum.price) / parfum.prix_boutique) * 100);
  }

  getSavings(parfum: Parfum): number {
    if (!parfum.prix_boutique || parfum.prix_boutique <= parfum.price) return 0;

    return Number((parfum.prix_boutique - parfum.price).toFixed(2));
  }

  getParfumsByType(parfums: Parfum[], type: 'standard' | 'testeur' | 'coffret'): Parfum[] {
    return parfums.filter((p) => p.type === type);
  }

  private cleanString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private parsePrice(value: unknown): number | null {
    if (typeof value === 'number') return value;

    if (typeof value === 'string') {
      const parsed = Number(value.replace(',', '.').replace(/[^\d.]/g, ''));
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private normalizeGender(value: unknown): string {
    const g = this.cleanString(value).toLowerCase();
    if (g === 'homme') return 'Homme';
    if (g === 'femme') return 'Femme';
    if (['mixte', 'unisexe', 'unisex'].includes(g)) return 'Mixte';
    return '';
  }

  private normalizeType(value: unknown): 'standard' | 'testeur' | 'coffret' {
    const raw = this.cleanString(value).toLowerCase();

    if (raw === 'testeur' || raw.includes('testeur')) {
      return 'testeur';
    }

    if (raw === 'coffret' || raw.includes('coffret')) {
      return 'coffret';
    }

    const coffretKeywords = [
      'coffret',
      'découverte',
      'decouverte',
      'discovery',
      'set travel',
      'trousse',
      'miniature',
      'gel douche',
      'gel ',
      ' lait',
      'lait ',
      'deo',
      'déodorant',
      'deodorant',
      'crème',
      'creme',
      'mascara',
      'huile pure',
      'savon',
      'pochette',
      'sac bandoulière',
      'avec boite',
      'avec boîte',
      '4x',
      '5x',
      '8x',
      '+',
    ];

    if (coffretKeywords.some((keyword) => raw.includes(keyword))) {
      return 'coffret';
    }

    return 'standard';
  }

  private extractBrand(name: string): string {
    const normalizedName = this.normalizeForCompare(name);

    for (const brand of this.knownBrands) {
      const normalizedBrand = this.normalizeForCompare(brand);

      if (normalizedName === normalizedBrand || normalizedName.startsWith(`${normalizedBrand} `)) {
        return brand;
      }
    }

    return name.split(' ')[0] ?? 'Inconnue';
  }

  private normalizeForCompare(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private getFallbackImage(_: Partial<Parfum>): string {
    return '/images/placeholder-parfum.jpg';
  }
}
