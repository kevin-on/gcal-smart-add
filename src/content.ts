/**
 * Smart Quick Add for Google Calendar
 * Content script that enables Todoist-like natural language input
 */

import { AttachmentManager } from './AttachmentManager';

// Initialize the extension
const manager = new AttachmentManager();

// Cleanup on page unload - use pagehide instead of deprecated unload event
// pagehide fires reliably even with bfcache
window.addEventListener('pagehide', () => {
    manager.destroy();
});

// Also handle visibility changes for tab switching/backgrounding
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        manager.pause();
    } else {
        manager.resume();
    }
});
