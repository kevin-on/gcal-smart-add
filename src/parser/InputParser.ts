/**
 * Parses natural language input into tokens and event data
 */

import { Token, EventData, ParseResult, Match } from './types';

// Date keywords mapped to day offset or weekday index (0=Sunday)
const DATE_PATTERNS: { pattern: RegExp; resolve: () => Date }[] = [
    { pattern: /\b(today|tod)\b/gi, resolve: () => new Date() },
    { pattern: /\b(tomorrow|tom)\b/gi, resolve: () => addDays(new Date(), 1) },
    { pattern: /\byesterday\b/gi, resolve: () => addDays(new Date(), -1) },
    { pattern: /\b(sunday|sun)\b/gi, resolve: () => nextWeekday(0) },
    { pattern: /\b(monday|mon)\b/gi, resolve: () => nextWeekday(1) },
    { pattern: /\b(tuesday|tues|tue)\b/gi, resolve: () => nextWeekday(2) },
    { pattern: /\b(wednesday|wed)\b/gi, resolve: () => nextWeekday(3) },
    { pattern: /\b(thursday|thurs|thur|thu)\b/gi, resolve: () => nextWeekday(4) },
    { pattern: /\b(friday|fri)\b/gi, resolve: () => nextWeekday(5) },
    { pattern: /\b(saturday|sat)\b/gi, resolve: () => nextWeekday(6) },
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

export class InputParser {
    parse(text: string): ParseResult {
        // Find all date matches
        const matches = this.findAllMatches(text);

        // Use only the last match for event data
        const lastMatch = matches.length > 0 ? matches[matches.length - 1] : null;

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
                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    raw: match[0],
                    date: resolve(),
                });
            }
        }

        // Sort by position
        matches.sort((a, b) => a.start - b.start);
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
