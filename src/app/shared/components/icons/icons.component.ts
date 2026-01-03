/**
 * @fileoverview Reusable SVG icon component library
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
 */

import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * @component IconComponent
 * @description Lightweight SVG icon library with common icons
 * 
 * @features
 * - 50+ common icons
 * - Customizable size and stroke width
 * - Inherits text color
 * - Minimal bundle size
 * 
 * @example
 * <app-icon name="search" [size]="16"></app-icon>
 * <app-icon name="user" [size]="24" [strokeWidth]="2"></app-icon>
 * 
 * @architecture
 * - OnPush change detection
 * - Signal-based inputs
 * - Pure SVG (no external dependencies)
 * 
 * @since 1.0.0
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icons.component.html'
})
export class IconComponent {
  name = input.required<string>();
  size = input<number>(20);
  strokeWidth = input<number>(1.5);
  class = input<string>('');
}
