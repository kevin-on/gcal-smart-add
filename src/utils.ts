/**
 * Utility functions for Google Calendar Smart Add
 */

import { EXTENSION_NAME, SELECTORS } from './constants';

export function log(...args: unknown[]) {
    console.log(`[${EXTENSION_NAME}]`, ...args);
}

/**
 * Extracts the date portion from a Date object in ISO format (YYYY-MM-DD)
 * Uses local timezone, not UTC.
 */
export function toISODateString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Extracts the time portion from a Date object in 12-hour format with AM/PM
 */
export function toTimeString(date: Date): string {
    const hours24 = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${minutes} ${period}`;
}

/**
 * Cached references to editor form elements
 */
export interface EditorElements {
    allDayCheckbox: HTMLInputElement | null;
    startDateInput: HTMLInputElement | null;
    endDateInput: HTMLInputElement | null;
    startTimeInput: HTMLInputElement | null;
    endTimeInput: HTMLInputElement | null;
}

/**
 * Queries and caches all editor form elements once
 */
export function queryEditorElements(): EditorElements {
    return {
        allDayCheckbox: document.querySelector(SELECTORS.allDayCheckbox) as HTMLInputElement | null,
        startDateInput: document.querySelector(SELECTORS.startDateInput) as HTMLInputElement | null,
        endDateInput: document.querySelector(SELECTORS.endDateInput) as HTMLInputElement | null,
        startTimeInput: document.querySelector(SELECTORS.startTimeInput) as HTMLInputElement | null,
        endTimeInput: document.querySelector(SELECTORS.endTimeInput) as HTMLInputElement | null,
    };
}

/**
 * Checks if cached editor elements are still connected to the DOM.
 * Returns false if any required element is disconnected (stale reference).
 */
export function isEditorElementsValid(elements: EditorElements | null): boolean {
    if (!elements) return false;
    // Check if the primary element (startDateInput) is still in the DOM
    // If it's disconnected, the cache is stale and needs refresh
    return elements.startDateInput?.isConnected ?? false;
}

/**
 * Returns whether the all-day checkbox is checked.
 * Returns null if checkbox is not available.
 */
export function isAllDayChecked(elements: EditorElements): boolean | null {
    if (!elements.allDayCheckbox) return null;
    return elements.allDayCheckbox.checked;
}

/**
 * Sets the all-day checkbox to the desired state.
 * Returns true if the state was changed.
 */
export function setAllDayCheckbox(elements: EditorElements, checked: boolean): boolean {
    const checkbox = elements.allDayCheckbox;
    if (!checkbox || !checkbox.checkVisibility()) {
        log('All-day checkbox not found');
        return false;
    }

    if (checkbox.checked === checked) {
        return false;
    }

    checkbox.click();
    return true;
}

/**
 * Ensures the editor is ready for date-only input (all-day event).
 */
export function prepareForDateOnly(elements: EditorElements): void {
    setAllDayCheckbox(elements, true);
}

/**
 * Ensures the editor is ready for date+time input.
 */
export function prepareForDateTime(elements: EditorElements): void {
    setAllDayCheckbox(elements, false);
}

/**
 * Sets start or end date in Google Calendar's event editor
 */
export function setDate(elements: EditorElements, date: Date, which: 'start' | 'end'): boolean {
    const dateInput = which === 'start' ? elements.startDateInput : elements.endDateInput;
    if (!dateInput) {
        log(`${which} date input not found`);
        return false;
    }

    const formattedDate = toISODateString(date);

    if (dateInput.value === formattedDate) {
        return false;
    }

    log(`Setting ${which} date to:`, formattedDate);
    dateInput.value = formattedDate;
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));

    return true;
}

/**
 * Sets start or end time in Google Calendar's event editor
 */
export function setTime(elements: EditorElements, time: Date, which: 'start' | 'end'): boolean {
    const timeInput = which === 'start' ? elements.startTimeInput : elements.endTimeInput;
    if (!timeInput) {
        log(`${which} time input not found`);
        return false;
    }

    const formattedTime = toTimeString(time);

    if (timeInput.value === formattedTime) {
        return false;
    }

    log(`Setting ${which} time to:`, formattedTime);
    timeInput.value = formattedTime;
    timeInput.dispatchEvent(new Event('input', { bubbles: true }));

    return true;
}
