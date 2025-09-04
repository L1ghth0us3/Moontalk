import { describe, it, expect } from 'vitest';
import { translate } from '../src/lib/translator2/index';
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
    expect(out.surface).toMatch(/^te\b/);
    expect(out.surface).toContain('ʋæʋi');
    expect(out.surface.includes('jæula')).toBe(false);
  });

  // Intransitive
  it('Intransitive: He sits', () => {
    const out = translate('He sits', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^se\b/);
    expect(out.surface.split(/\s+/).length).toBe(2);
    expect(out.surface.includes('turalu')).toBe(false);
  });
  it('Intransitive: We move', () => {
    const out = translate('We move', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^tɪ\s/);
    expect(out.surface.split(/\s+/).length).toBe(2);
    expect(out.surface.includes('kæʃ')).toBe(false);
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

  // (Existential expletive "there is/are" intentionally not covered: feature not yet implemented)

  // Particles
  it('Particles: WITH bow', () => {
    const out = translate('We will hunt with bow', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/\bri\b/);
  });
  it('Particles: WITH the queen', () => {
    const out = translate('I hunt with the queen', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toBe('ɪ kɪlab ri kin');
  });
  it('Particles: TO home', () => {
    const out = translate('I move to home', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/\sith\s/);
    expect(out.surface).toContain('teʋikay');
    expect(out.surface.includes('kæʃ')).toBe(false);
  });
  it('Particles: FROM forest', () => {
    const out = translate('They come from forest', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/\sʌs\s/);
    expect(out.surface).toContain('ʋæʋi');
    expect(out.surface.includes('teʋikay')).toBe(false);
  });
  it('Particles: IN water', () => {
    const out = translate('She is in water', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toContain(' la ');
    expect(out.surface).toContain(' ʌmas');
  });

  // Coordination — multiple AND
  it('Coordination: I live in shroud and hunt with traps and smell forest', () => {
    const out = translate('I live in shroud and hunt with traps and smell forest', DEFAULT_ROOTS, DEFAULT_NOUNS);
    // three segments joined by ʋa
    const s = out.surface;
    const countVa = (s.match(/\sʋa\s/g)||[]).length;
    expect(countVa).toBe(2);
    expect(s).toMatch(/\bla\s+sharūd\b/);
    expect(s).toMatch(/\bkɪlab\b/);
    expect(s).toMatch(/\bri\s+maklūb\b/);
    expect(s).toContain('χ'); // smell verb present
    expect(s).toContain('ʋæʋi'); // forest
  });

  // Coordination — OR
  it('Coordination: I hunt with bow or with knife', () => {
    const out = translate('I hunt with bow or with knife', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toContain(' ri ');
    // default OR joiner is ra
    expect(out.surface).toContain(' ra ');
  });

  // NP lists within a PP
  it('NP list (PP): I hunt with trap and knife', () => {
    const out = translate('I hunt with trap and knife', DEFAULT_ROOTS, DEFAULT_NOUNS);
    // Expect: subject + verb + ri + maklūb ʋa kʌy
    expect(out.surface).toMatch(/^ɪ\s/);
    expect(out.surface).toContain(' kɪlab ');
    expect(out.surface).toContain(' ri ');
    expect(out.surface).toMatch(/ri\s+maklūb\s+ʋa\s+kʌy/);
  });
  it('NP list (PP, either/or): I hunt with either trap or knife', () => {
    const out = translate('I hunt with either trap or knife', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toContain(' ri ');
    // OR/NOR default joiner is ra
    expect(out.surface).toMatch(/ri\s+maklūb\s+ra\s+kʌy/);
  });
  it('NP list (PP, neither/nor): I hunt with neither trap nor knife', () => {
    const out = translate('I hunt with neither trap nor knife', DEFAULT_ROOTS, DEFAULT_NOUNS);
    // NOR uses same default joiner as OR ('ra'); ensure both nouns present
    expect(out.surface).toMatch(/ri\s+maklūb\s+ra\s+kʌy/);
  });
  it('NP list (PP, not only/but): I hunt with not only trap but knife', () => {
    const out = translate('I hunt with not only trap but knife', DEFAULT_ROOTS, DEFAULT_NOUNS);
    // BUT default joiner is ma
    expect(out.surface).toMatch(/ri\s+maklūb\s+ma\s+kʌy/);
  });

  // Direct object NP list
  it('NP list (object): I strike hunter and prey', () => {
    const out = translate('I strike hunter and prey', DEFAULT_ROOTS, DEFAULT_NOUNS);
    // ɪ dɪrak kalāb ʋa dray
    expect(out.surface).toMatch(/^ɪ\s/);
    expect(out.surface).toContain(' dɪrak ');
    expect(out.surface).toMatch(/kalāb\s+ʋa\s+dray/);
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
    const out = translate('She draw near cave', DEFAULT_ROOTS, DEFAULT_NOUNS);
    expect(out.surface).toMatch(/^se\s/);
    expect(out.surface).toContain('qerab');
    expect(out.surface).toContain('hʌiru');
    expect(out.surface.includes('dray')).toBe(false);
  });

  // Coordination + particles ordering
  it('Coordination: I live in shroud and hunt with traps', () => {
    const out = translate('I live in shroud and hunt with traps', DEFAULT_ROOTS, DEFAULT_NOUNS);
    // Expected: subject + live + la shroud + ʋa + hunt + ri trap
    expect(out.surface).toContain('ɪ');
    expect(out.surface).toMatch(/\bla\s+sharūd\b/);
    expect(out.surface.includes(' ʋa ')).toBe(true);
    expect(out.surface).toMatch(/\bkɪlab\b/);
    expect(out.surface).toMatch(/\bri\s+maklūb\b/);
  });
});
