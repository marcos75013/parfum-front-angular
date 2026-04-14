import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

import { Parfum } from '../models/parfum';
import { environement } from '../../environements/environement';

interface PerfumeImageResponse {
  imageUrl: string;
}

@Injectable({
  providedIn: 'root',
})
export class ParfumService {
  private readonly excelUrl = '/data/parfums.xlsx';
  private readonly apiBaseUrl = environement.apiBaseUrl;

  constructor(private http: HttpClient) {}

  async loadParfums(): Promise<Parfum[]> {
    try {
      const data = await firstValueFrom(
        this.http.get(this.excelUrl, { responseType: 'arraybuffer' }),
      );

      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const parfums: Parfum[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        const rawName = row[0];
        const rawGender = row[1];
        const rawPrice = row[2];

        const name = this.cleanString(rawName);
        const gender = this.cleanString(rawGender);
        const price = this.parsePrice(rawPrice);

        if (!name || !gender || price === null) {
          continue;
        }

        if (!this.isValidGender(gender)) {
          continue;
        }

        parfums.push({
          name,
          brand: this.extractBrand(name),
          gender,
          price,
          image: this.getFallbackImage({ name }),
        });
      }

      return [...parfums].sort((a, b) =>
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

  private cleanString(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }

  private parsePrice(value: unknown): number | null {
    if (typeof value === 'number') {
      return value;
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

  private isValidGender(gender: string): boolean {
    const normalized = gender.toLowerCase();
    return normalized === 'homme' || normalized === 'femme';
  }

  private extractBrand(name: string): string {
    const parts = name.split(' ').filter(Boolean);
    return parts.length > 0 ? parts[0] : 'Inconnue';
  }

  private getFallbackImage(parfum: Partial<Parfum>): string {
    return `https://picsum.photos/seed/${encodeURIComponent(parfum.name ?? 'parfum')}/600/600`;
  }
}
