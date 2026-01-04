import { 
  Directive, 
  ElementRef, 
  input, 
  output, 
  effect,
  inject,
  HostListener,
  HostBinding
} from '@angular/core';

/**
 * Modern Click Outside Directive using Angular 21 patterns
 */
@Directive({
  selector: '[appClickOutside]',
  standalone: true
})
export class ClickOutsideDirective {
  private readonly elementRef = inject(ElementRef);
  
  // Input signal
  readonly enabled = input<boolean>(true);
  
  // Output signal
  readonly clickOutside = output<MouseEvent>();
  
  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent): void {
    if (!this.enabled()) return;
    
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.clickOutside.emit(event);
    }
  }
}

/**
 * Auto Focus Directive
 */
@Directive({
  selector: '[appAutoFocus]',
  standalone: true
})
export class AutoFocusDirective {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  
  readonly delay = input<number>(0);
  readonly enabled = input<boolean>(true);
  
  constructor() {
    effect(() => {
      if (this.enabled()) {
        setTimeout(() => {
          this.elementRef.nativeElement.focus();
        }, this.delay());
      }
    });
  }
}

/**
 * Tooltip Directive
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective {
  private readonly elementRef = inject(ElementRef);
  
  readonly text = input.required<string>({ alias: 'appTooltip' });
  readonly position = input<'top' | 'bottom' | 'left' | 'right'>('top');
  
  @HostBinding('attr.title')
  get title(): string {
    return this.text();
  }
  
  @HostBinding('class.cursor-help')
  readonly cursorHelp = true;
}

/**
 * Debounce Click Directive
 */
@Directive({
  selector: '[appDebounceClick]',
  standalone: true
})
export class DebounceClickDirective {
  readonly debounceTime = input<number>(300);
  readonly debounceClick = output<MouseEvent>();
  
  private timeoutId: number | null = null;
  
  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = window.setTimeout(() => {
      this.debounceClick.emit(event);
      this.timeoutId = null;
    }, this.debounceTime());
  }
}

/**
 * Loading State Directive
 */
@Directive({
  selector: '[appLoading]',
  standalone: true
})
export class LoadingDirective {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  
  readonly loading = input.required<boolean>({ alias: 'appLoading' });
  readonly loadingText = input<string>('Loading...');
  
  constructor() {
    effect(() => {
      const element = this.elementRef.nativeElement;
      
      if (this.loading()) {
        element.style.opacity = '0.6';
        element.style.pointerEvents = 'none';
        element.style.cursor = 'wait';
        element.setAttribute('aria-busy', 'true');
      } else {
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
        element.style.cursor = 'auto';
        element.removeAttribute('aria-busy');
      }
    });
  }
}

/**
 * Intersection Observer Directive for lazy loading
 */
@Directive({
  selector: '[appInView]',
  standalone: true
})
export class InViewDirective {
  private readonly elementRef = inject(ElementRef);
  
  readonly threshold = input<number>(0.1);
  readonly inView = output<boolean>();
  
  private observer: IntersectionObserver | null = null;
  
  constructor() {
    effect((onCleanup) => {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            this.inView.emit(entry.isIntersecting);
          });
        },
        { threshold: this.threshold() }
      );
      
      this.observer.observe(this.elementRef.nativeElement);
      
      onCleanup(() => {
        this.observer?.disconnect();
      });
    });
  }
}

/**
 * Copy to Clipboard Directive
 */
@Directive({
  selector: '[appCopyToClipboard]',
  standalone: true
})
export class CopyToClipboardDirective {
  readonly text = input.required<string>({ alias: 'appCopyToClipboard' });
  readonly copied = output<boolean>();
  
  @HostListener('click')
  async onClick(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.text());
      this.copied.emit(true);
      
      setTimeout(() => {
        this.copied.emit(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      this.copied.emit(false);
    }
  }
  
  @HostBinding('class.cursor-pointer')
  readonly cursorPointer = true;
}
