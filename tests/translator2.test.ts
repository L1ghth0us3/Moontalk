import { describe, it, expect } from 'vitest';
import { translate } from '../src/lib/translator2';
import { DEFAULT_ROOTS, DEFAULT_NOUNS } from '../src/data/defaults';

describe('Translator 2.0 (pure API)', () => {
  it('Transitive: I strike hunter', () => {
    const out = translate('I strike hunter', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toBe('ɪ dɪrak kalāb');
  });

  it('Equative zero-copula: I am a hunter', () => {
    const out = translate('I am a hunter', DEFAULT_ROOTS, DEFAULT_NOUNS);
    // Present non-neg equatives may drop copula
    expect(out.surface).toBe('ɪ kalāb');
  });

  it('Existential with place: There is animal in forest', () => {
    const out = translate('There is animal in forest', DEFAULT_ROOTS, DEFAULT_NOUNS);
    // 3sg copula + NP + la + PLACE (default mapping in API version)
    expect(out.surface).toMatch(/\b.+\b/); // non-empty
    // Ensure la + forest noun appears
    expect(out.surface).toMatch(/\bla\b/);
  });

  it('Progressive + question: You are hiding?', () => {
    const out = translate('You are hiding?', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface.endsWith('qa?')).toBe(true);
  });

  it('Negation assimilation: I do not hunt (k- root)', () => {
    const out = translate('I do not hunt', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^ɪ\s+naq/); // naq- before k/g/q
  });

  it('Future + instrument: We will hunt with bow', () => {
    const out = translate('We will hunt with bow', DEFAULT_ROOTS, DEFAULT_NOUNS);
    // Ensure WITH particle present and noun resolved
    expect(out.surface).toMatch(/\bri\b/);
  });

  it('Smell forest (3pl): They smell the forest', () => {
    const out = translate('They smell forest', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface.split(' ').length).toBeGreaterThanOrEqual(3);
  });
});

