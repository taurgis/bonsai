import { describe, it, expect } from 'vitest';
import Research from './research.js';

describe('research command unit tests', () => {
  it('runs the command class in-process and returns structured mock data', async () => {
    const result = await Research.run(['https://example.com']);
    expect(result).toBeDefined();
    if (result) {
      expect(result).toHaveProperty('schemaVersion', 1);
      expect(result).toHaveProperty('format', 'compressed');
    }
  });

  it('runs command with detailed format', async () => {
    const result = await Research.run(['https://example.com', '--format', 'detailed']);
    expect(result).toBeDefined();
    if (result) {
      expect(result).toHaveProperty('format', 'detailed');
    }
  });

  it('runs command in JSON mode in-process', async () => {
    const result = await Research.run(['https://example.com', '--json']);
    expect(result).toBeUndefined();
  });

  it('handles errors in JSON mode by formatting in JSON envelope', async () => {
    const originalExecute = Research.prototype.execute;
    Research.prototype.execute = async function () {
      throw new Error('Test forced execute error');
    };
    try {
      const result = await Research.run(['https://example.com', '--json']);
      expect(result).toBeUndefined();
    } finally {
      Research.prototype.execute = originalExecute;
    }
  });

  it('handles oclif errors with exit code in JSON mode', async () => {
    const originalExecute = Research.prototype.execute;
    Research.prototype.execute = async function () {
      const err = new Error('Test forced oclif error');
      (err as any).oclif = { exit: 2 };
      throw err;
    };
    try {
      const result = await Research.run(['https://example.com', '--json']);
      expect(result).toBeUndefined();
    } finally {
      Research.prototype.execute = originalExecute;
    }
  });

  it('handles string throws in JSON mode', async () => {
    const originalExecute = Research.prototype.execute;
    Research.prototype.execute = async function () {
      throw 'Forced string throw';
    };
    try {
      const result = await Research.run(['https://example.com', '--json']);
      expect(result).toBeUndefined();
    } finally {
      Research.prototype.execute = originalExecute;
    }
  });

  it('handles missing command ID in JSON mode', async () => {
    const originalId = Research.id;
    // Set to undefined to force fallback ?? 'research' branch
    (Research as any).id = undefined;
    try {
      const result = await Research.run(['https://example.com', '--json']);
      expect(result).toBeUndefined();
    } finally {
      Research.id = originalId;
    }
  });
});
