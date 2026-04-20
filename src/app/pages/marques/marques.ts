import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Parfum } from '../../models/parfum';
import { ParfumService } from '../../services/parfum.service';

@Component({
  selector: 'app-marques',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './marques.html',
  styleUrls: ['./marques.scss'],
})
export class MarquesComponent implements OnInit {
  parfums: Parfum[] = [];
  brands: string[] = [];
  filteredBrands: string[] = [];
  search = '';
  loading = true;

  constructor(
    private readonly parfumService: ParfumService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.parfums = await this.parfumService.loadParfums();
      this.brands = this.parfumService.getBrands(this.parfums);
      this.filteredBrands = [...this.brands];
    } catch (error) {
      console.error('Erreur chargement marques', error);
      this.parfums = [];
      this.brands = [];
      this.filteredBrands = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  filterBrands(): void {
    const term = this.search.trim().toLowerCase();

    if (!term) {
      this.filteredBrands = [...this.brands];
      return;
    }

    this.filteredBrands = this.brands.filter((brand) => brand.toLowerCase().includes(term));
  }

  getCountForBrand(brand: string): number {
    return this.parfumService.getBrandProductCount(this.parfums, brand);
  }

  getBrandLink(brand: string): string[] {
    return ['/marques', encodeURIComponent(brand)];
  }

  trackByBrand(_index: number, brand: string): string {
    return brand;
  }
}
