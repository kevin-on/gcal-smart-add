/**
 * Google Calendar Smart Add
 * Constants and selectors
 */

export const EXTENSION_NAME = 'Google Calendar Smart Add';
export const ATTACHED_ATTR = 'data-smart-add-attached';

export const SELECTORS = {
    titleInput:
        'input[aria-label*="Add title"], input[data-placeholder*="Add title"], input[placeholder*="Add title"]',
    startDateInput: 'input[aria-label="Start date"]',
    endDateInput: 'input[aria-label="End date"]',
    startTimeInput: 'input[aria-label="Start time"]',
    endTimeInput: 'input[aria-label="End time"]',
    allDayCheckbox: 'input[aria-label="All day"]',
    eventEditPage: '*[aria-label="Event edit page"]',
};
