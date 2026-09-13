import { describe, expect, it } from 'vitest';

import { VERSION_MOTEUR } from '../src/index';

describe('@loupe/moteur', () => {
  it('expose une version sémantique', () => {
    expect(VERSION_MOTEUR).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
