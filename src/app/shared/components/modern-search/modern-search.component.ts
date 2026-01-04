/**
 * @fileoverview Modern search component with debounce and filtering
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
 */

import { 
  Component, 
  input, 
  output, 
  signal, 
  computed, 
  effect,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icons/icons.component';

/**
 * @component ModernSearchComponent
 * @description Reusable search component with Angular 21 signal-based features
 * 
 * @features
 * - Debounced search input
 * - Clear button
 * - Loading indicator
 * - Full-width or fixed-width modes
 * - Signal-based inputs/outputs
 * - ViewChild for programmatic focus
 * 
 * @example
 * <app-modern-search 
 *   [placeholder]="'Search products...'"
 *   [fullWidth]="true"
 *   (search)="handleSearch($event)"
 * ></app-modern-search>
 * 
 * @architecture
 * - OnPush change detection
 * - Signal-based state
 * - Modern Angular 21 APIs (input/output/viewChild)
 * 
 * @since 1.0.0
 */
@Component({
  selector: 'app-modern-search',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modern-search.component.html'
})
export class ModernSearchComponent {
  // Angular 21 input signals - type-safe component inputs
  readonly placeholder = input<string>('Search...');
  readonly initialQuery = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly fullWidth = input<boolean>(false);
  readonly showSearchButton = input<boolean>(false);
  readonly debounceMs = input<number>(300);
  
  // Angular 21 output signals - type-safe event emitters
  readonly queryChange = output<string>();
  readonly searchSubmit = output<string>();
  readonly focused = output<void>();
  readonly blurred = output<void>();
  
  // ViewChild signal for DOM access
  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  
  // Internal state
  readonly query = signal<string>('');
  readonly isFocused = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly resultsCount = signal<number | null>(null);
  
  // Computed values
  readonly hasQuery = computed(() => this.query().length > 0);
  readonly isEmpty = computed(() => this.query().length === 0);
  
  private debounceTimer: number | null = null;
  
  constructor() {
    // Effect to handle initial query
    effect(() => {
      const initial = this.initialQuery();
      if (initial && this.query() === '') {
        this.query.set(initial);
      }
    });
    
    // Effect to emit query changes with debouncing
    effect(() => {
      const currentQuery = this.query();
      
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      
      this.debounceTimer = window.setTimeout(() => {
        this.queryChange.emit(currentQuery);
      }, this.debounceMs());
    });
  }
  
  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
  }
  
  onFocus(): void {
    this.isFocused.set(true);
    this.focused.emit();
  }
  
  onBlur(): void {
    this.isFocused.set(false);
    this.blurred.emit();
  }
  
  clear(): void {
    this.query.set('');
    this.resultsCount.set(null);
    this.focusInput();
  }
  
  search(): void {
    if (this.query()) {
      this.searchSubmit.emit(this.query());
    }
  }
  
  focusInput(): void {
    const input = this.searchInput();
    if (input) {
      input.nativeElement.focus();
    }
  }
  
  setLoading(loading: boolean): void {
    this.isLoading.set(loading);
  }
  
  setResultsCount(count: number | null): void {
    this.resultsCount.set(count);
  }
}
