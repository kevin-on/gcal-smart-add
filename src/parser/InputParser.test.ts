import { describe, it, expect, beforeEach } from 'vitest';
import { InputParser } from './InputParser';

describe('InputParser', () => {
    let parser: InputParser;

    beforeEach(() => {
        parser = new InputParser();
    });

    // Helper to compare dates (ignoring time)
    const sameDay = (d1: Date | undefined, d2: Date) => {
        if (!d1) return false;
        return (
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate()
        );
    };

    const today = () => new Date();
    const addDays = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d;
    };

    describe('relative dates', () => {
        it('parses "today"', () => {
            const result = parser.parse('Meeting today');
            expect(sameDay(result.event.start?.date, today())).toBe(true);
            expect(result.cleanTitle).toBe('Meeting');
        });

        it('parses "tomorrow"', () => {
            const result = parser.parse('Meeting tomorrow');
            expect(sameDay(result.event.start?.date, addDays(1))).toBe(true);
            expect(result.cleanTitle).toBe('Meeting');
        });

        it('parses "yesterday"', () => {
            const result = parser.parse('Meeting yesterday');
            expect(sameDay(result.event.start?.date, addDays(-1))).toBe(true);
        });
    });

    describe('weekdays', () => {
        it('parses full weekday names', () => {
            const weekdays = [
                'sunday',
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
                'saturday',
            ];
            weekdays.forEach((day, index) => {
                const result = parser.parse(`Meeting ${day}`);
                expect(result.event.start?.date).toBeDefined();
                expect(result.event.start!.date.getDay()).toBe(index);
            });
        });

        it('parses abbreviated weekday names', () => {
            const abbreviations = [
                { abbr: 'sun', day: 0 },
                { abbr: 'mon', day: 1 },
                { abbr: 'tue', day: 2 },
                { abbr: 'wed', day: 3 },
                { abbr: 'thu', day: 4 },
                { abbr: 'fri', day: 5 },
                { abbr: 'sat', day: 6 },
            ];
            abbreviations.forEach(({ abbr, day }) => {
                const result = parser.parse(`Meeting ${abbr}`);
                expect(result.event.start!.date.getDay()).toBe(day);
            });
        });
    });

    describe('numeric formats', () => {
        it('parses ISO format: 2025-01-27', () => {
            const result = parser.parse('Meeting 2025-01-27');
            expect(result.event.start?.date.getFullYear()).toBe(2025);
            expect(result.event.start?.date.getMonth()).toBe(0); // January
            expect(result.event.start?.date.getDate()).toBe(27);
            expect(result.cleanTitle).toBe('Meeting');
        });

        it('parses US format with 4-digit year: 01/27/2025', () => {
            const result = parser.parse('Meeting 01/27/2025');
            expect(result.event.start?.date.getFullYear()).toBe(2025);
            expect(result.event.start?.date.getMonth()).toBe(0);
            expect(result.event.start?.date.getDate()).toBe(27);
        });

        it('parses US format with 2-digit year: 01/27/25', () => {
            const result = parser.parse('Meeting 01/27/25');
            expect(result.event.start?.date.getFullYear()).toBe(2025);
            expect(result.event.start?.date.getMonth()).toBe(0);
            expect(result.event.start?.date.getDate()).toBe(27);
        });
    });

    describe('month name formats', () => {
        it('parses "jan 27"', () => {
            const result = parser.parse('Meeting jan 27');
            expect(result.event.start?.date.getMonth()).toBe(0);
            expect(result.event.start?.date.getDate()).toBe(27);
            expect(result.cleanTitle).toBe('Meeting');
        });

        it('parses "27 jan"', () => {
            const result = parser.parse('Meeting 27 jan');
            expect(result.event.start?.date.getMonth()).toBe(0);
            expect(result.event.start?.date.getDate()).toBe(27);
        });

        it('parses "january 27"', () => {
            const result = parser.parse('Meeting january 27');
            expect(result.event.start?.date.getMonth()).toBe(0);
            expect(result.event.start?.date.getDate()).toBe(27);
        });

        it('parses "27 january"', () => {
            const result = parser.parse('Meeting 27 january');
            expect(result.event.start?.date.getMonth()).toBe(0);
            expect(result.event.start?.date.getDate()).toBe(27);
        });

        it('parses "jan 27 2025" with year', () => {
            const result = parser.parse('Meeting jan 27 2025');
            expect(result.event.start?.date.getFullYear()).toBe(2025);
            expect(result.event.start?.date.getMonth()).toBe(0);
            expect(result.event.start?.date.getDate()).toBe(27);
        });

        it('parses "27 jan 2025" with year', () => {
            const result = parser.parse('Meeting 27 jan 2025');
            expect(result.event.start?.date.getFullYear()).toBe(2025);
            expect(result.event.start?.date.getMonth()).toBe(0);
            expect(result.event.start?.date.getDate()).toBe(27);
        });

        it('parses all month names', () => {
            const months = [
                { name: 'jan', month: 0 },
                { name: 'feb', month: 1 },
                { name: 'mar', month: 2 },
                { name: 'apr', month: 3 },
                { name: 'may', month: 4 },
                { name: 'jun', month: 5 },
                { name: 'jul', month: 6 },
                { name: 'aug', month: 7 },
                { name: 'sep', month: 8 },
                { name: 'oct', month: 9 },
                { name: 'nov', month: 10 },
                { name: 'dec', month: 11 },
            ];
            months.forEach(({ name, month }) => {
                const result = parser.parse(`Meeting ${name} 15`);
                expect(result.event.start?.date.getMonth()).toBe(month);
            });
        });
    });

    describe('ordinal formats', () => {
        it('parses "27th jan"', () => {
            const result = parser.parse('Meeting 27th jan');
            expect(result.event.start?.date.getDate()).toBe(27);
            expect(result.event.start?.date.getMonth()).toBe(0);
        });

        it('parses "jan 27th"', () => {
            const result = parser.parse('Meeting jan 27th');
            expect(result.event.start?.date.getDate()).toBe(27);
            expect(result.event.start?.date.getMonth()).toBe(0);
        });
    });

    describe('time parsing', () => {
        it('parses time and sets hasTime to true', () => {
            const result = parser.parse('Meeting tomorrow at 3pm');
            expect(result.event.start?.hasTime).toBe(true);
            expect(result.event.start?.date.getHours()).toBe(15);
        });

        it('date-only input has hasTime false', () => {
            const result = parser.parse('Meeting tomorrow');
            expect(result.event.start?.hasTime).toBe(false);
        });

        it('parses time range with start and end', () => {
            const result = parser.parse('Meeting tomorrow from 10 to 11 AM');
            expect(result.event.start?.date).toBeDefined();
            expect(result.event.end?.date).toBeDefined();
            expect(result.event.start?.date.getHours()).toBe(10);
            expect(result.event.end?.date.getHours()).toBe(11);
        });

        it('time-only input has hasDate false', () => {
            const result = parser.parse('Meeting at 3pm');
            expect(result.event.start?.hasTime).toBe(true);
            expect(result.event.start?.hasDate).toBe(false);
        });

        it('date with time has both hasDate and hasTime true', () => {
            const result = parser.parse('Meeting tomorrow at 3pm');
            expect(result.event.start?.hasTime).toBe(true);
            expect(result.event.start?.hasDate).toBe(true);
        });

        it('date-only input has hasDate true', () => {
            const result = parser.parse('Meeting tomorrow');
            expect(result.event.start?.hasDate).toBe(true);
        });

        it('weekday-only input has hasDate true', () => {
            const result = parser.parse('Meeting monday');
            expect(result.event.start?.hasDate).toBe(true);
        });

        it('month and day has hasDate true', () => {
            const result = parser.parse('Meeting jan 27');
            expect(result.event.start?.hasDate).toBe(true);
        });
    });

    describe('validation', () => {
        it('handles text without dates', () => {
            const result = parser.parse('Regular meeting notes');
            expect(result.event.start).toBeUndefined();
            expect(result.cleanTitle).toBe('Regular meeting notes');
        });
    });

    describe('clean title extraction', () => {
        it('removes date from title', () => {
            const result = parser.parse('Team standup tomorrow');
            expect(result.cleanTitle).toBe('Team standup');
        });

        it('removes date from middle of title', () => {
            const result = parser.parse('Meeting jan 27 with John');
            expect(result.cleanTitle).toBe('Meeting with John');
        });

        it('handles date at start', () => {
            const result = parser.parse('tomorrow Team standup');
            expect(result.cleanTitle).toBe('Team standup');
        });
    });

    describe('token generation', () => {
        it('generates correct tokens for date at end', () => {
            const result = parser.parse('Meeting tomorrow');
            expect(result.tokens).toHaveLength(2);
            expect(result.tokens[0].type).toBe('text');
            expect(result.tokens[0].raw).toBe('Meeting ');
            expect(result.tokens[1].type).toBe('date');
            expect(result.tokens[1].raw).toBe('tomorrow');
        });

        it('generates correct tokens for date in middle', () => {
            const result = parser.parse('Call jan 27 with Bob');
            expect(result.tokens).toHaveLength(3);
            expect(result.tokens[0].type).toBe('text');
            expect(result.tokens[1].type).toBe('date');
            expect(result.tokens[2].type).toBe('text');
        });
    });

    describe('2-digit year handling', () => {
        it('interprets 2-digit year close to current year', () => {
            const currentYear = new Date().getFullYear();
            const twoDigit = currentYear % 100;

            const result = parser.parse(`Meeting 01/15/${twoDigit}`);
            expect(result.event.start?.date.getFullYear()).toBe(currentYear);
        });
    });
});

