/**
 * Utility functions for Smart Quick Add
 */

import { EXTENSION_NAME, SELECTORS } from './constants';

export function log(...args: unknown[]) {
    console.log(`[${EXTENSION_NAME}]`, ...args);
}

/**
 * Formats a Date object to ISO format for Google Calendar
 * e.g., "2025-01-27"
 */
export function formatDateForGCal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
