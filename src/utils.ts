/**
 * Utility functions for Smart Quick Add
 */

import { EXTENSION_NAME, SELECTORS } from './constants';

export function log(...args: unknown[]) {
    console.log(`[${EXTENSION_NAME}]`, ...args);
}

/**
 * Formats a Date object to Google Calendar's display format
 * e.g., "Wednesday, January 7"
 */
export function formatDateForGCal(date: Date): string {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Sets the start date in Google Calendar's event editor
 */
export function setStartDate(date: Date): boolean {
    const dateInput = document.querySelector(SELECTORS.startDateInput) as HTMLInputElement | null;
    if (!dateInput) {
        log('Start date input not found');
        return false;
    }

    const formattedDate = formatDateForGCal(date);

    // Only update if different
    if (dateInput.value === formattedDate) {
        return false;
    }

    log('Setting start date to:', formattedDate);

    // Set value and dispatch events to trigger Google Calendar's handlers
    dateInput.value = formattedDate;
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));

    return true;
}

/**
 * Checks if text contains "today" (case-insensitive)
 */
export function containsToday(text: string): boolean {
    return /today/i.test(text);
}

