/**
 * Parses natural language input into tokens and event data
 * Pattern design inspired by chrono-node (https://github.com/wanasit/chrono)
 */

import { Token, EventData, ParseResult, Match } from './types';

// Month dictionary (1-indexed, following chrono's convention)
const MONTH_DICTIONARY: Record<string, number> = {
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sep: 9,
    sept: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
};

// Ordinal word dictionary (from chrono)
const ORDINAL_WORD_DICTIONARY: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10,
    eleventh: 11,
    twelfth: 12,
    thirteenth: 13,
    fourteenth: 14,
    fifteenth: 15,
    sixteenth: 16,
    seventeenth: 17,
    eighteenth: 18,
    nineteenth: 19,
    twentieth: 20,
    'twenty-first': 21,
    'twenty-second': 22,
    'twenty-third': 23,
    'twenty-fourth': 24,
    'twenty-fifth': 25,
    'twenty-sixth': 26,
    'twenty-seventh': 27,
    'twenty-eighth': 28,
    'twenty-ninth': 29,
    thirtieth: 30,
    'thirty-first': 31,
};

// Generate regex pattern from dictionary keys (sorted by length to avoid partial matches)
function matchAnyPattern(dict: Record<string, unknown>): string {
    return Object.keys(dict)
        .sort((a, b) => b.length - a.length)
        .join('|');
}

const MONTH_PATTERN = matchAnyPattern(MONTH_DICTIONARY);
const ORDINAL_WORD_PATTERN = matchAnyPattern(ORDINAL_WORD_DICTIONARY);
const ORDINAL_NUMBER_PATTERN = `(?:${ORDINAL_WORD_PATTERN}|\\d{1,2}(?:st|nd|rd|th)?)`;

// Validate day and month ranges
function isValidDate(day: number, month: number): boolean {
    return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

// Smart swap: if month > 12 but could be a day, swap them
function normalizeMonthDay(
    first: number,
    second: number,
    firstIsMonth: boolean
): { day: number; month: number } | null {
    let month = firstIsMonth ? first : second;
    let day = firstIsMonth ? second : first;

    if (month > 12) {
        if (day >= 1 && day <= 12 && month <= 31) {
            [day, month] = [month, day];
        } else {
            return null;
        }
    }

    if (!isValidDate(day, month)) return null;
    return { day, month };
}

// Parse ordinal (handles both "27th" and "twenty-seventh")
function parseOrdinal(text: string): number {
    const lower = text.toLowerCase();
    if (ORDINAL_WORD_DICTIONARY[lower] !== undefined) {
        return ORDINAL_WORD_DICTIONARY[lower];
    }
    return parseInt(lower.replace(/(?:st|nd|rd|th)$/i, ''));
}

// Convert 2-digit year to 4-digit by finding the closest century
function findMostLikelyADYear(yearNumber: number): number {
    if (yearNumber >= 100) return yearNumber;

    const currentYear = new Date().getFullYear();
    const currentCentury = Math.floor(currentYear / 100) * 100;

    const candidates = [
        currentCentury + yearNumber, // e.g. 2000 + 26 = 2026
        currentCentury - 100 + yearNumber, // e.g. 1900 + 26 = 1926
    ];

    // Pick the year closest to current year
    return candidates.reduce((closest, year) =>
        Math.abs(year - currentYear) < Math.abs(closest - currentYear) ? year : closest
    );
}

// Date patterns with resolvers (return null to reject invalid matches)
const DATE_PATTERNS: { pattern: RegExp; resolve: (m: RegExpExecArray) => Date | null }[] = [
    // Relative dates
    { pattern: /\b(today|tod)\b/gi, resolve: () => new Date() },
    { pattern: /\b(tomorrow|tom)\b/gi, resolve: () => addDays(new Date(), 1) },
    { pattern: /\byesterday\b/gi, resolve: () => addDays(new Date(), -1) },

    // Weekdays
    { pattern: /\b(sunday|sun)\b/gi, resolve: () => nextWeekday(0) },
    { pattern: /\b(monday|mon)\b/gi, resolve: () => nextWeekday(1) },
    { pattern: /\b(tuesday|tues|tue)\b/gi, resolve: () => nextWeekday(2) },
    { pattern: /\b(wednesday|wed)\b/gi, resolve: () => nextWeekday(3) },
    { pattern: /\b(thursday|thurs|thur|thu)\b/gi, resolve: () => nextWeekday(4) },
    { pattern: /\b(friday|fri)\b/gi, resolve: () => nextWeekday(5) },
    { pattern: /\b(saturday|sat)\b/gi, resolve: () => nextWeekday(6) },

    // ISO format: 2023-01-27 (strict, no month/day swap)
    {
        pattern: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
        resolve: (m) => {
            const month = +m[2];
            const day = +m[3];
            if (!isValidDate(day, month)) return null;
            return new Date(+m[1], month - 1, day);
        },
    },

    // US format with year: 01/27/2023 or 01/27/23 (month/day/year)
    {
        pattern: /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g,
        resolve: (m) => {
            const result = normalizeMonthDay(+m[1], +m[2], true);
            if (!result) return null;
            const year = findMostLikelyADYear(+m[3]);
            return new Date(year, result.month - 1, result.day);
        },
    },

    // Short slash format: 27/1 (day/month, no year)
    // Skip version numbers like "1.12" (only match with "/")
    {
        pattern: /\b(\d{1,2})\/(\d{1,2})\b/g,
        resolve: (m) => {
            const result = normalizeMonthDay(+m[1], +m[2], false);
            return result ? findYearClosestToRef(result.day, result.month) : null;
        },
    },

    // Month day year: jan 27 2025, january 27 2025 (with negative lookahead for time)
    {
        pattern: new RegExp(
            `\\b(${MONTH_PATTERN})\\s+(${ORDINAL_NUMBER_PATTERN})(?!\\s*(?:am|pm|:\\d))[,\\s]+(\\d{2,4})\\b`,
            'gi'
        ),
        resolve: (m) => {
            const month = MONTH_DICTIONARY[m[1].toLowerCase()];
            const day = parseOrdinal(m[2]);
            if (!isValidDate(day, month)) return null;
            const year = findMostLikelyADYear(+m[3]);
            return new Date(year, month - 1, day);
        },
    },

    // Day month year: 27 jan 2025, 27 january 2025
    {
        pattern: new RegExp(
            `\\b(${ORDINAL_NUMBER_PATTERN})\\s+(${MONTH_PATTERN})[,\\s]+(\\d{2,4})\\b`,
            'gi'
        ),
        resolve: (m) => {
            const day = parseOrdinal(m[1]);
            const month = MONTH_DICTIONARY[m[2].toLowerCase()];
            if (!isValidDate(day, month)) return null;
            const year = findMostLikelyADYear(+m[3]);
            return new Date(year, month - 1, day);
        },
    },

    // Month day: jan 27, january 27 (with negative lookahead to avoid "jan 12:00")
    {
        pattern: new RegExp(
            `\\b(${MONTH_PATTERN})\\s+(${ORDINAL_NUMBER_PATTERN})(?!\\s*(?:am|pm|:\\d))\\b`,
            'gi'
        ),
        resolve: (m) => {
            const month = MONTH_DICTIONARY[m[1].toLowerCase()];
            const day = parseOrdinal(m[2]);
            if (!isValidDate(day, month)) return null;
            return findYearClosestToRef(day, month);
        },
    },

    // Day month: 27 jan, 27 january, twenty-seventh january
    {
        pattern: new RegExp(`\\b(${ORDINAL_NUMBER_PATTERN})\\s+(${MONTH_PATTERN})\\b`, 'gi'),
        resolve: (m) => {
            const day = parseOrdinal(m[1]);
            const month = MONTH_DICTIONARY[m[2].toLowerCase()];
            if (!isValidDate(day, month)) return null;
            return findYearClosestToRef(day, month);
        },
    },
];

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Today is inclusive (e.g. "Monday" on a Monday returns today)
function nextWeekday(targetDay: number): Date {
    const today = new Date();
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) {
        daysUntil += 7;
    }
    return addDays(today, daysUntil);
}

// Find the year closest to today (inspired by chrono's findYearClosestToRef)
function findYearClosestToRef(day: number, month: number): Date {
    const ref = new Date();
    const year = ref.getFullYear();
    const candidate = new Date(year, month - 1, day);
    const nextYear = new Date(year + 1, month - 1, day);
    const lastYear = new Date(year - 1, month - 1, day);

    const diffCurrent = Math.abs(candidate.getTime() - ref.getTime());
    const diffNext = Math.abs(nextYear.getTime() - ref.getTime());
    const diffLast = Math.abs(lastYear.getTime() - ref.getTime());

    if (diffNext < diffCurrent && diffNext < diffLast) return nextYear;
    if (diffLast < diffCurrent) return lastYear;
    return candidate;
}

// Filter overlapping matches, keeping the longest one at each position
function filterOverlappingMatches(matches: Match[]): Match[] {
    if (matches.length <= 1) return matches;

    // Sort by start position, then by length (longer first)
    matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

    const result: Match[] = [];
    let lastEnd = -1;

    for (const match of matches) {
        // Skip if this match overlaps with previous kept match
        if (match.start < lastEnd) continue;
        result.push(match);
        lastEnd = match.end;
    }

    return result;
}

export class InputParser {
    parse(text: string): ParseResult {
        // Find all date matches
        const matches = this.findAllMatches(text);

        // Filter overlapping matches (prefer longer)
        const filtered = filterOverlappingMatches(matches);

        // Use only the last match for event data
        const lastMatch = filtered.length > 0 ? filtered[filtered.length - 1] : null;

        // Build tokens (only last match is 'date', rest are 'text')
        const tokens = this.buildTokens(text, lastMatch);

        // Build event data
        const event: EventData = lastMatch ? { date: lastMatch.date } : {};

        // Build clean title by joining text tokens
        const cleanTitle = tokens
            .filter((t) => t.type === 'text')
            .map((t) => t.raw.trim())
            .filter((s) => s.length > 0)
            .join(' ');

        return { tokens, event, cleanTitle };
    }

    private findAllMatches(text: string): Match[] {
        const matches: Match[] = [];

        for (const { pattern, resolve } of DATE_PATTERNS) {
            // Reset regex state
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;

            while ((match = pattern.exec(text)) !== null) {
                const date = resolve(match);
                // Skip invalid dates (resolver returns null)
                if (date === null) continue;

                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    raw: match[0],
                    date,
                });
            }
        }

        return matches;
    }

    private buildTokens(text: string, activeMatch: Match | null): Token[] {
        if (!activeMatch) {
            // No matches - entire text is one text token
            return text ? [{ type: 'text', raw: text, start: 0, end: text.length }] : [];
        }

        const tokens: Token[] = [];

        // Text before the match
        if (activeMatch.start > 0) {
            tokens.push({
                type: 'text',
                raw: text.slice(0, activeMatch.start),
                start: 0,
                end: activeMatch.start,
            });
        }

        // The date token
        tokens.push({
            type: 'date',
            raw: activeMatch.raw,
            start: activeMatch.start,
            end: activeMatch.end,
        });

        // Text after the match
        if (activeMatch.end < text.length) {
            tokens.push({
                type: 'text',
                raw: text.slice(activeMatch.end),
                start: activeMatch.end,
                end: text.length,
            });
        }

        return tokens;
    }
}
