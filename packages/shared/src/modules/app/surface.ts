export type AppPlatform = 'ios' | 'android' | 'desktop' | 'unknown';

export interface AppSurface {
  isMobile: boolean;
  isStandalone: boolean;
  platform: AppPlatform;
}

export function detectAppSurface(scopeInput = globalThis): AppSurface {
  const scope = scopeInput as typeof globalThis & {
    innerWidth?: number;
    matchMedia?: (query: string) => MediaQueryList;
    navigator?: Navigator & {
      standalone?: boolean;
      maxTouchPoints?: number;
      userAgent?: string;
    };
  };

  const userAgent = scope.navigator?.userAgent ?? '';
  const isIos =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && (scope.navigator?.maxTouchPoints ?? 0) > 1);
  const isAndroid = /Android/i.test(userAgent);
  const prefersStandalone =
    typeof scope.matchMedia === 'function'
      ? scope.matchMedia('(display-mode: standalone)').matches
      : false;
  const isStandalone = prefersStandalone || scope.navigator?.standalone === true;
  const coarsePointer =
    typeof scope.matchMedia === 'function' ? scope.matchMedia('(pointer: coarse)').matches : false;
  const narrowViewport =
    typeof scope.innerWidth === 'number' && scope.innerWidth > 0 ? scope.innerWidth <= 820 : false;
  const isMobile = isIos || isAndroid || (coarsePointer && narrowViewport);

  return {
    isMobile,
    isStandalone,
    platform: isIos ? 'ios' : isAndroid ? 'android' : isMobile ? 'unknown' : 'desktop',
  };
}
