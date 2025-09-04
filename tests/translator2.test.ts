import { describe, it, expect } from 'vitest';
import { translate } from '../src/lib/translator2';
import { DEFAULT_ROOTS, DEFAULT_NOUNS } from '../src/data/defaults';

describe('Translator 2.0 (pure API)', () => {
  // Transitive
  it('Transitive: I strike hunter', () => {
    const out = translate('I strike hunter', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toBe('ɪ dɪrak kalāb');
  });
  it('Transitive: I hunt prey', () => {
    const out = translate('I hunt prey', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^ɪ\s/);
    expect(out.surface).toMatch(/\bdray\b/);
  });
  it('Transitive: You hunt prey', () => {
    const out = translate('You hunt prey', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^su\b/);
    expect(out.surface).toMatch(/\bdray\b/);
  });
  it('Transitive: We did hunt prey (past)', () => {
    const out = translate('We did hunt prey', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^tɪ\s/);
    expect(out.surface).toMatch(/\bdray\b/);
  });
  it('Transitive: They will hunt prey (future)', () => {
    const out = translate('They will hunt prey', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^te\b/);
    expect(out.surface).toMatch(/\bdray\b/);
  });
  it('Transitive: They smell forest', () => {
    const out = translate('They smell forest', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface.split(/\s+/).length).toBeGreaterThanOrEqual(3);
  });

  // Intransitive
  it('Intransitive: He sits', () => {
    const out = translate('He sits', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^se\b/);
  });
  it('Intransitive: We move', () => {
    const out = translate('We move', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^tɪ\s/);
  });

  // Copula / Equatives
  it('Copula: I am a hunter (zero copula)', () => {
    const out = translate('I am a hunter', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toBe('ɪ kalāb');
  });
  it('Copula: They are hunters (zero copula)', () => {
    const out = translate('They are hunters', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^te\s+kalāb$/);
  });
  it('Copula: I am not a hunter (negated)', () => {
    const out = translate('I am not a hunter', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^ɪ\s+/);
    expect(out.surface).toMatch(/kalāb/);
    expect(out.surface).toMatch(/naaq|naq/);
  });

  // Existential / Locative-like
  it('Existential: There is water in cave', () => {
    const out = translate('There is water in cave', DEFAULT_ROOTS, DEFAULT_NOUNS);
    // Current behavior: may only include NP without location
    expect(out.surface).toContain('ʌmas');
  });
  it('Existential: There are animals in forest', () => {
    const out = translate('There are animals in forest', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toContain('tye');
  });
  it('Existential: There is fire at home', () => {
    const out = translate('There is fire at home', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toContain('χʌl');
  });

  // Particles
  it('Particles: WITH bow', () => {
    const out = translate('We will hunt with bow', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/\bri\b/);
  });
  it('Particles: TO home', () => {
    const out = translate('I move to home', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/\sith\s/);
    expect(out.surface).toContain('teʋikay');
  });
  it('Particles: FROM forest', () => {
    const out = translate('They come from forest', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/\sʌs\s/);
    expect(out.surface).toContain('ʋæʋi');
  });
  it('Particles: IN water', () => {
    const out = translate('She is in water', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toContain(' la ');
    expect(out.surface).toContain(' ʌmas');
  });

  // Negation
  it('Negation: I do not hunt (k- assimilation)', () => {
    const out = translate('I do not hunt', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^ɪ\s+naq/); // naq- before k/g/q
  });
  it('Negation: She does not strike (default long form)', () => {
    const out = translate('She does not strike', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/\bnaaq/);
  });

  // Aspect / Questions
  it('Aspect: Progressive + question', () => {
    const out = translate('You are hiding?', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface.endsWith('qa?')).toBe(true);
  });
  it('Aspect: Habitual (used to)', () => {
    const out = translate('We used to hunt prey', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^tɪ\s/);
    expect(out.surface).toMatch(/\bdray\b/);
  });
  it('Aspect: Plain question', () => {
    const out = translate('We hunt prey?', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface.endsWith('qa?')).toBe(true);
    expect(out.surface).toMatch(/\bdray\b/);
  });

  // Phrasal verb
  it('Phrasal: draw near + NP', () => {
    const out = translate('She draw near home', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^se\s/);
    // Ensure phrasal verb resolved to approach root
    expect(out.surface).toContain('qerab');
  });
});
