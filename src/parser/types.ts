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

export interface EventData {
    date?: Date;
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
    date: Date;
}
