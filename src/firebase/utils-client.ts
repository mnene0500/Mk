'use client';

import { useMemo } from 'react';

/**
 * A helper to memoize Firebase references or queries within React components.
 */
export function useMemoFirebase<T>(factory: () => T, deps: any[]): T {
  return useMemo(factory, deps);
}
