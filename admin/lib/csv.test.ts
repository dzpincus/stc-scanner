import { describe, it, expect } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Nov 14, 2026 9:55 AM')).toBe('"Nov 14, 2026 9:55 AM"');
    expect(csvCell('O"Brien')).toBe('"O""Brien"');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell(null)).toBe('');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-5')).toBe("'-5");
  });
});

describe('toCsv', () => {
  it('starts with a BOM and uses CRLF', () => {
    expect(toCsv([['a', 'b'], ['1', 'x,y']])).toBe('﻿a,b\r\n1,"x,y"\r\n');
  });
});
