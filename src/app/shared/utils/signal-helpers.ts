import { Signal, computed } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { Observable, debounceTime, distinctUntilChanged, map } from 'rxjs';

/**
 * Utility functions for Angular 21 Signal patterns
 */

/**
 * Creates a debounced signal from another signal
 */
export function debouncedSignal<T>(
  source: Signal<T>,
  delayMs: number = 300
): Signal<T | undefined> {
  const observable$ = toObservable(source).pipe(
    debounceTime(delayMs),
    distinctUntilChanged()
  );
  
  return toSignal(observable$);
}

/**
 * Combines multiple signals into a single computed signal
 */
export function combineSignals<T extends readonly unknown[]>(
  signals: { [K in keyof T]: Signal<T[K]> }
): Signal<T> {
  return computed(() => 
    signals.map(signal => signal()) as unknown as T
  );
}

/**
 * Creates a signal that filters values based on a predicate
 */
export function filterSignal<T>(
  source: Signal<T[]>,
  predicate: (value: T) => boolean
): Signal<T[]> {
  return computed(() => source().filter(predicate));
}

/**
 * Creates a signal that maps array values
 */
export function mapSignal<T, R>(
  source: Signal<T[]>,
  mapper: (value: T, index: number) => R
): Signal<R[]> {
  return computed(() => source().map(mapper));
}

/**
 * Creates a paginated signal
 */
export function paginateSignal<T>(
  source: Signal<T[]>,
  page: Signal<number>,
  pageSize: Signal<number>
): Signal<{ items: T[]; total: number; pages: number }> {
  return computed(() => {
    const items = source();
    const currentPage = page();
    const size = pageSize();
    
    const start = (currentPage - 1) * size;
    const end = start + size;
    
    return {
      items: items.slice(start, end),
      total: items.length,
      pages: Math.ceil(items.length / size)
    };
  });
}

/**
 * Creates a sorted signal
 */
export function sortSignal<T>(
  source: Signal<T[]>,
  compareFn: (a: T, b: T) => number
): Signal<T[]> {
  return computed(() => [...source()].sort(compareFn));
}

/**
 * Creates a search signal that filters items based on query
 */
export function searchSignal<T>(
  source: Signal<T[]>,
  query: Signal<string>,
  searchFn: (item: T, query: string) => boolean
): Signal<T[]> {
  return computed(() => {
    const q = query().toLowerCase().trim();
    if (!q) return source();
    return source().filter(item => searchFn(item, q));
  });
}

/**
 * Creates a signal that tracks loading state
 */
export function loadingSignal<T>(
  observable: Observable<T>
): Signal<{ data: T | null; loading: boolean; error: Error | null }> {
  type LoadingState = { data: T | null; loading: boolean; error: Error | null };
  
  const result$ = observable.pipe(
    map((data): LoadingState => ({ data, loading: false, error: null }))
  );
  
  const initialState: LoadingState = { data: null, loading: true, error: null };
  
  return toSignal(result$, { initialValue: initialState }) as Signal<LoadingState>;
}

/**
 * Creates a signal that groups array items by a key
 */
export function groupBySignal<T, K extends string | number>(
  source: Signal<T[]>,
  keyFn: (item: T) => K
): Signal<Map<K, T[]>> {
  return computed(() => {
    const groups = new Map<K, T[]>();
    source().forEach(item => {
      const key = keyFn(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });
    return groups;
  });
}

/**
 * Creates a signal that provides aggregate statistics
 */
export function statsSignal<T>(
  source: Signal<T[]>,
  valueFn: (item: T) => number
): Signal<{
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}> {
  return computed(() => {
    const items = source();
    const values = items.map(valueFn);
    
    if (values.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
    }
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  });
}
