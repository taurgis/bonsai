import { describe, it, expect } from 'vitest';
import { pluralize, resultListHeading, truncationNotice, type ResultListLabels } from './text.js';

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
