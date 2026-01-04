/**
 * @fileoverview Reusable empty state component for first-time users
 * Provides consistent, accessible empty states across the application
 * 
 * @author Thuraya Systems
 * @version 1.0.0
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icons/icons.component';

export interface EmptyStateAction {
  label: string;
  icon?: string;
  primary?: boolean;
}

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      class="flex flex-col items-center justify-center p-8 md:p-12 text-center"
      [class.h-full]="fullHeight"
      role="status"
      [attr.aria-label]="title"
    >
      <!-- Icon -->
      @if (icon) {
        <div 
          class="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300"
          [class]="iconBgClass"
        >
          <app-icon [name]="icon" [size]="40" [class]="iconClass"></app-icon>
        </div>
      }
      
      <!-- Illustration (optional) -->
      @if (illustration) {
        <div class="mb-6">
          <ng-content select="[illustration]"></ng-content>
        </div>
      }
      
      <!-- Title -->
      <h3 class="text-xl font-semibold text-slate-800 mb-2">
        {{ title }}
      </h3>
      
      <!-- Description -->
      @if (description) {
        <p class="text-slate-500 max-w-md mb-6 leading-relaxed">
          {{ description }}
        </p>
      }
      
      <!-- Actions -->
      @if (actions.length > 0) {
        <div class="flex flex-wrap gap-3 justify-center">
          @for (action of actions; track action.label) {
            <button
              (click)="onAction.emit(action)"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
              [class]="action.primary 
                ? 'bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500 shadow-lg shadow-teal-500/20' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400'"
              [attr.aria-label]="action.label"
            >
              @if (action.icon) {
                <app-icon [name]="action.icon" [size]="18"></app-icon>
              }
              {{ action.label }}
            </button>
          }
        </div>
      }
      
      <!-- Additional content slot -->
      <div class="mt-6">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class EmptyStateComponent {
  @Input() icon: string = '';
  @Input() title: string = 'No data yet';
  @Input() description: string = '';
  @Input() actions: EmptyStateAction[] = [];
  @Input() fullHeight: boolean = true;
  @Input() illustration: boolean = false;
  @Input() variant: 'default' | 'success' | 'warning' | 'info' = 'default';
  
  @Output() onAction = new EventEmitter<EmptyStateAction>();
  
  get iconBgClass(): string {
    const variants: Record<string, string> = {
      'default': 'bg-slate-100',
      'success': 'bg-teal-50',
      'warning': 'bg-amber-50',
      'info': 'bg-blue-50'
    };
    return variants[this.variant] || variants['default'];
  }
  
  get iconClass(): string {
    const variants: Record<string, string> = {
      'default': 'text-slate-400',
      'success': 'text-teal-500',
      'warning': 'text-amber-500',
      'info': 'text-blue-500'
    };
    return variants[this.variant] || variants['default'];
  }
}

