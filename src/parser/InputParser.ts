/**
 * Parses natural language input using chrono-node
 * https://github.com/wanasit/chrono
 */

import * as chrono from 'chrono-node';
import { Token, EventData, ParseResult, ParsedDateTime, Match } from './types';

/**
 * Convert chrono ParsedComponents to ParsedDateTime.
 * Checks isCertain('hour') to determine if time was explicitly specified.
 * Checks date components (weekday, day, month, year) to determine if date was explicitly specified.
 */
function toDateTime(components: chrono.ParsedComponents): ParsedDateTime {
    const hasDate =
        components.isCertain('weekday') ||
        components.isCertain('day') ||
        components.isCertain('month') ||
        components.isCertain('year');
    return {
        date: components.date(),
        hasTime: components.isCertain('hour'),
        hasDate,
    };
}

export class InputParser {
    parse(text: string): ParseResult {
        const results = chrono.parse(text);

        // Use only the last match for event data (consistent with previous behavior)
        const lastResult = results.length > 0 ? results[results.length - 1] : null;

        // Build match info for token generation
        const lastMatch: Match | null = lastResult
            ? {
                  start: lastResult.index,
                  end: lastResult.index + lastResult.text.length,
                  raw: lastResult.text,
              }
            : null;

        // Build tokens
        const tokens = this.buildTokens(text, lastMatch);

        // Build event data from chrono result
        const event: EventData = {};
        if (lastResult) {
            event.start = toDateTime(lastResult.start);
            if (lastResult.end) {
                event.end = toDateTime(lastResult.end);
            }
        }

        // Build clean title by joining text tokens
        const cleanTitle = tokens
            .filter((t) => t.type === 'text')
            .map((t) => t.raw.trim())
            .filter((s) => s.length > 0)
            .join(' ');

        return { tokens, event, cleanTitle };
    }

    private buildTokens(text: string, activeMatch: Match | null): Token[] {
        if (!activeMatch) {
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
