/**
 * Smart Quick Add for Google Calendar
 * Constants and selectors
 */

export const EXTENSION_NAME = 'Smart Quick Add';
export const ATTACHED_ATTR = 'data-smart-quick-add-attached';

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
