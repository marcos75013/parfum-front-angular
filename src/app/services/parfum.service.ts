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
  private readonly jsonUrl = '/data/parfums_with_real_market_prices.json';
  private readonly apiBaseUrl = environement.apiBaseUrl;

  /**
   * Liste des marques multi-mots présentes dans le JSON.
   * On les trie par longueur décroissante pour matcher d'abord les plus spécifiques.
   */
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

        if (!name || !gender || price === null) {
          continue;
        }

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

      const parfumsWithImages = await Promise.all(
        parfums.map(async (parfum) => {
          if (parfum.image) {
            return parfum;
          }

          const image = await this.fetchPerfumeImage(parfum);

          return {
            ...parfum,
            image,
          };
        }),
      );

      console.log('✅ Parfums JSON chargés :', parfumsWithImages.length);
      console.log('✅ Marques détectées :', this.getBrands(parfumsWithImages));
      console.log('✅ Types détectés :', {
        standard: parfumsWithImages.filter((p) => p.type === 'standard').length,
        testeur: parfumsWithImages.filter((p) => p.type === 'testeur').length,
        coffret: parfumsWithImages.filter((p) => p.type === 'coffret').length,
      });

      return [...parfumsWithImages].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
      );
    } catch (error) {
      console.error('Erreur lors du chargement des parfums :', error);
      throw error;
    }
  }

  async fetchPerfumeImage(parfum: Parfum): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.get<PerfumeImageResponse>(`${this.apiBaseUrl}/perfumes/image`, {
          params: {
            name: parfum.name,
            brand: parfum.brand,
          },
        }),
      );

      if (response?.imageUrl) {
        return response.imageUrl;
      }

      return this.getFallbackImage(parfum);
    } catch (error) {
      console.error(`Erreur image pour "${parfum.name}" :`, error);
      return this.getFallbackImage(parfum);
    }
  }

  getBrands(parfums: Parfum[]): string[] {
    return [...new Set(parfums.map((parfum) => parfum.brand).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' }),
    );
  }

  getParfumsByBrand(parfums: Parfum[], brand: string): Parfum[] {
    const normalizedBrand = this.normalizeForCompare(brand);

    return parfums.filter((parfum) => this.normalizeForCompare(parfum.brand) === normalizedBrand);
  }

  getBrandProductCount(parfums: Parfum[], brand: string): number {
    return this.getParfumsByBrand(parfums, brand).length;
  }

  getDiscountPercent(parfum: Parfum): number {
    if (!parfum.prix_boutique || parfum.prix_boutique <= parfum.price) {
      return 0;
    }

    return Math.round(((parfum.prix_boutique - parfum.price) / parfum.prix_boutique) * 100);
  }

  getSavings(parfum: Parfum): number {
    if (!parfum.prix_boutique || parfum.prix_boutique <= parfum.price) {
      return 0;
    }

    return Number((parfum.prix_boutique - parfum.price).toFixed(2));
  }

  getParfumsByType(parfums: Parfum[], type: 'standard' | 'testeur' | 'coffret'): Parfum[] {
    return parfums.filter((parfum) => parfum.type === type);
  }

  private cleanString(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }

  private parsePrice(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const normalized = value
        .replace(',', '.')
        .replace(/[^\d.]/g, '')
        .trim();

      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private normalizeGender(value: unknown): string {
    const gender = this.cleanString(value).toLowerCase();

    if (gender === 'homme') {
      return 'Homme';
    }

    if (gender === 'femme') {
      return 'Femme';
    }

    if (gender === 'mixte' || gender === 'unisexe' || gender === 'unisex') {
      return 'Mixte';
    }

    return '';
  }

  private normalizeType(value: unknown): 'standard' | 'testeur' | 'coffret' {
    const raw = this.cleanString(value).toLowerCase();

    if (raw === 'testeur') {
      return 'testeur';
    }

    if (raw === 'coffret') {
      return 'coffret';
    }

    if (raw === 'standard') {
      return 'standard';
    }

    if (raw.includes('testeur')) {
      return 'testeur';
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

    const parts = name.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1]}`;
    }

    return parts[0] ?? 'Inconnue';
  }

  private normalizeForCompare(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/["“”'’`´]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private getFallbackImage(_parfum: Partial<Parfum>): string {
    return '/images/placeholder-parfum.jpg';
  }
}
