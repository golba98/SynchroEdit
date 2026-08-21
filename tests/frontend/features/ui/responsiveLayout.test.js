/**
 * @jest-environment jsdom
 */

import {
  layoutMode,
  VIEWPORT_BREAKPOINTS,
} from '../../../../public/js/features/ui/ResponsiveLayoutController.js';

describe('responsive layout breakpoints', () => {
  it.each([
    [320, 'mobile'],
    [599, 'mobile'],
    [600, 'tablet'],
    [899, 'tablet'],
    [900, 'compact'],
    [1199, 'compact'],
    [1200, 'desktop'],
    [2560, 'desktop'],
  ])('maps a %ipx viewport to %s mode', (width, expected) => {
    expect(layoutMode(width)).toBe(expected);
  });

  it('keeps the shared breakpoint contract stable', () => {
    expect(VIEWPORT_BREAKPOINTS).toEqual({ mobile: 600, tablet: 900, compact: 1200 });
  });
});
