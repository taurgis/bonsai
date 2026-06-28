import { describe, it, expect } from 'vitest';
import {
  closestMatch,
  levenshtein,
  maxFuzzyDistance,
  pluralize,
  resultListHeading,
  truncationNotice,
  type ResultListLabels,
} from './text.js';

const LIST: ResultListLabels = { noun: 'cached research', order: 'first', maxLimit: 100 };
const SEARCH: ResultListLabels = { noun: 'matching cached research', order: 'top', maxLimit: 50 };

describe('pluralize', () => {
  it('selects singular only for a count of 1', () => {
    expect(pluralize(1, 'entry', 'entries')).toBe('entry');
    expect(pluralize(0, 'entry', 'entries')).toBe('entries');
    expect(pluralize(2, 'entry', 'entries')).toBe('entries');
  });
});

describe('resultListHeading', () => {
  it('omits the truncation clause when everything matched is shown', () => {
    expect(resultListHeading(3, 3, LIST)).toBe('Found 3 cached research entries:');
    expect(resultListHeading(1, 1, LIST)).toBe('Found 1 cached research entry:');
  });

  it('adds the truncation clause with the label order word when results are capped', () => {
    expect(resultListHeading(5, 2, LIST)).toBe(
      'Found 5 cached research entries (showing first 2; raise --limit to see more):'
    );
    expect(resultListHeading(5, 2, SEARCH)).toBe(
      'Found 5 matching cached research entries (showing top 2; raise --limit to see more):'
    );
  });
});

describe('truncationNotice', () => {
  it('returns null when nothing was cut', () => {
    expect(truncationNotice(3, 3, LIST)).toBeNull();
    expect(truncationNotice(2, 5, LIST)).toBeNull();
  });

  it('reports the total, order word, and the command-specific max limit', () => {
    expect(truncationNotice(5, 2, LIST)).toBe(
      '5 entries matched; returning the first 2. Raise --limit (max 100) to see more.'
    );
    expect(truncationNotice(5, 2, SEARCH)).toBe(
      '5 entries matched; returning the top 2. Raise --limit (max 50) to see more.'
    );
  });
});

describe('maxFuzzyDistance', () => {
  it('uses tighter thresholds for short inputs', () => {
    expect(maxFuzzyDistance('ab')).toBe(1);
    expect(maxFuzzyDistance('abcd')).toBe(2);
    expect(maxFuzzyDistance('abcdef')).toBe(3);
  });
});

describe('levenshtein', () => {
  it('is zero for identical strings and symmetric', () => {
    expect(levenshtein('status', 'status')).toBe(0);
    expect(levenshtein('kitten', 'sitting')).toBe(levenshtein('sitting', 'kitten'));
  });

  it('counts single-edit insert, delete, and substitute as distance 1', () => {
    expect(levenshtein('status', 'statuss')).toBe(1); // insert
    expect(levenshtein('lists', 'list')).toBe(1); // delete
    expect(levenshtein('list', 'lisp')).toBe(1); // substitute
  });
});

describe('closestMatch', () => {
  const COMMANDS = ['import', 'inspect', 'list', 'prune', 'search', 'status', 'config:set'];

  it('returns the nearest command for a plausible typo', () => {
    expect(closestMatch('statuss', COMMANDS, 3)).toBe('status');
    expect(closestMatch('improt', COMMANDS, 3)).toBe('import');
    expect(closestMatch('lst', COMMANDS, 3)).toBe('list');
  });

  it('returns null when nothing is within the distance threshold', () => {
    expect(closestMatch('frobnicate', COMMANDS, 3)).toBeNull();
    expect(closestMatch('x', COMMANDS, 3)).toBeNull();
  });

  it('includes a candidate exactly at the distance threshold', () => {
    // 'lisppp' is 3 edits from 'list' (one substitution + two insertions): the <= boundary matches.
    expect(levenshtein('lisppp', 'list')).toBe(3);
    expect(closestMatch('lisppp', COMMANDS, 3)).toBe('list');
    expect(closestMatch('lisppp', COMMANDS, 2)).toBeNull();
  });

  it('returns null for an empty candidate list', () => {
    expect(closestMatch('status', [], 3)).toBeNull();
  });
});
