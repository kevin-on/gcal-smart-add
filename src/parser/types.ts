/**
 * Parser types for Smart Quick Add
 */

export type TokenType = 'text' | 'date';

export interface Token {
    type: TokenType;
    raw: string;
    start: number;
    end: number;
}

/**
 * Represents a parsed date/time with certainty information.
 * If hasTime is false, only the date portion should be used.
 * If hasDate is false, only the time portion should be used.
 */
export interface ParsedDateTime {
    date: Date;
    hasTime: boolean;
    hasDate: boolean;
}

/**
 * Event data extracted from the input.
 * start is always present if a date was parsed.
 * end is present if a date range was detected (e.g., "from 10 to 11 AM").
 */
export interface EventData {
    start?: ParsedDateTime;
    end?: ParsedDateTime;
}

export interface ParseResult {
    tokens: Token[];
    event: EventData;
    cleanTitle: string;
}

export interface Match {
    start: number;
    end: number;
    raw: string;
}
