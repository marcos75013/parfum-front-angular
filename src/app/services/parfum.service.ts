import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Parfum } from '../models/parfum';

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
  private readonly jsonUrl =
    '/data/parfums_with_type_mai_2026_with_images.json';

  private readonly knownBrands: string[] = [
    'Yves Saint Laurent',
    'Jean Paul Gaultier',
    'Dolce & Gabbana',
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
    'Chloe',
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
      const data = await firstValueFrom(
        this.http.get<RawParfumJson[]>(this.jsonUrl),
      );

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
          prixBoutique !== null && prixBoutique > price
            ? prixBoutique
            : undefined;

        parfums.push({
          name,
          brand: explicitBrand || this.extractBrand(name),
          gender,
          price,
          prix_boutique: finalPrixBoutique,
          image: this.getSafeLocalImage(item.image),
          type: this.normalizeType(item.type ?? item.typeProduit ?? name),
        });
      }

      return parfums.sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
      );
    } catch (error) {
      console.error('Erreur lors du chargement des parfums :', error);
      throw error;
    }
  }

  async fetchPerfumeImage(parfum: Parfum): Promise<string> {
    return this.getSafeLocalImage(parfum.image);
  }

  getBrands(parfums: Parfum[]): string[] {
    return [...new Set(parfums.map((p) => p.brand).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }),
    );
  }

  getParfumsByBrand(parfums: Parfum[], brand: string): Parfum[] {
    const normalizedBrand = this.normalizeForCompare(brand);

    return parfums.filter(
      (p) => this.normalizeForCompare(p.brand) === normalizedBrand,
    );
  }

  getBrandProductCount(parfums: Parfum[], brand: string): number {
    return this.getParfumsByBrand(parfums, brand).length;
  }

  getDiscountPercent(parfum: Parfum): number {
    if (!parfum.prix_boutique || parfum.prix_boutique <= parfum.price) {
      return 0;
    }

    return Math.round(
      ((parfum.prix_boutique - parfum.price) / parfum.prix_boutique) * 100,
    );
  }

  getSavings(parfum: Parfum): number {
    if (!parfum.prix_boutique || parfum.prix_boutique <= parfum.price) {
      return 0;
    }

    return Number((parfum.prix_boutique - parfum.price).toFixed(2));
  }

  getParfumsByType(
    parfums: Parfum[],
    type: 'standard' | 'testeur' | 'coffret',
  ): Parfum[] {
    return parfums.filter((p) => p.type === type);
  }

  private getSafeLocalImage(value: unknown): string {
    const image = this.cleanString(value);

    if (!image) {
      return '';
    }

    if (image.startsWith('/images/')) {
      return image;
    }

    if (image.startsWith('images/')) {
      return `/${image}`;
    }

    if (image.startsWith('/assets/')) {
      return image;
    }

    if (image.startsWith('assets/')) {
      return `/${image}`;
    }

    if (image.startsWith('public/images/')) {
      return image.replace('public', '');
    }

    if (image.startsWith('/public/images/')) {
      return image.replace('/public', '');
    }

    return '';
  }

  private cleanString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private parsePrice(value: unknown): number | null {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.replace(',', '.').replace(/[^\d.]/g, ''));
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private normalizeGender(value: unknown): string {
    const gender = this.cleanString(value).toLowerCase();

    if (gender === 'homme') return 'Homme';
    if (gender === 'femme') return 'Femme';
    if (['mixte', 'unisexe', 'unisex'].includes(gender)) return 'Mixte';

    return '';
  }

  private normalizeType(value: unknown): 'standard' | 'testeur' | 'coffret' {
    const raw = this.cleanString(value).toLowerCase();

    if (raw.includes('testeur') || raw.includes('tester')) {
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
      'lait',
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
      'sac bandouliere',
      'avec boite',
      'avec boîte',
      '4x',
      '5x',
      '8x',
      '10x',
      '+',
    ];

    if (raw.includes('coffret')) {
      return 'coffret';
    }

    if (coffretKeywords.some((keyword) => raw.includes(keyword))) {
      return 'coffret';
    }

    return 'standard';
  }

  private extractBrand(name: string): string {
    const normalizedName = this.normalizeForCompare(name);

    for (const brand of this.knownBrands) {
      const normalizedBrand = this.normalizeForCompare(brand);

      if (
        normalizedName === normalizedBrand ||
        normalizedName.startsWith(`${normalizedBrand} `)
      ) {
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
}
