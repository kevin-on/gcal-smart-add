/**
 * Smart Quick Add for Google Calendar
 * Content script that enables Todoist-like natural language input
 */

import { AttachmentManager } from './AttachmentManager';

// Initialize the extension
const manager = new AttachmentManager();

// Cleanup on page unload
window.addEventListener('unload', () => {
    manager.destroy();
});
