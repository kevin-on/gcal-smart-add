/**
 * Smart Quick Add for Google Calendar
 * Content script that enables Todoist-like natural language input
 */

const EXTENSION_NAME = 'Smart Quick Add 1';
const ATTACHED_ATTR = 'data-smart-quick-add-attached';

const SELECTORS = {
    titleInput: 'input[aria-label*="Add title"], input[data-placeholder*="Add title"]',
    startDateInput: 'input[aria-label="Start date"]',
};

function log(...args: unknown[]) {
    console.log(`[${EXTENSION_NAME}]`, ...args);
}

/**
 * Formats a Date object to Google Calendar's display format
 * e.g., "Wednesday, January 7"
 */
function formatDateForGCal(date: Date): string {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Sets the start date in Google Calendar's event editor
 */
function setStartDate(date: Date): boolean {
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
function containsToday(text: string): boolean {
    return /today/i.test(text);
}

/**
 * Overlay that renders mirrored text over the title input
 */
class TitleOverlay {
    private host: HTMLDivElement;
    private shadow: ShadowRoot;
    private textContainer: HTMLDivElement;
    private input: HTMLInputElement;
    private rafId: number | null = null;
    private isDestroyed = false;
    private originalTextColor: string;
    private originalCaretColor: string;

    constructor(input: HTMLInputElement) {
        this.input = input;

        // Capture original colors BEFORE modifying styles
        const computed = window.getComputedStyle(input);
        this.originalTextColor = computed.color;
        this.originalCaretColor = computed.caretColor;

        this.host = document.createElement('div');
        this.host.className = 'smart-quick-add-overlay-host';
        this.shadow = this.host.attachShadow({ mode: 'closed' });

        // Create text container inside shadow DOM
        this.textContainer = document.createElement('div');
        this.textContainer.className = 'overlay-text';

        // Add styles and container to shadow DOM
        const style = document.createElement('style');
        style.textContent = this.getStyles();
        this.shadow.appendChild(style);
        this.shadow.appendChild(this.textContainer);

        // Mount and start continuous position tracking
        document.body.appendChild(this.host);
        this.startPositionTracking();

        // Make input text transparent (caret stays visible with original color)
        this.input.style.caretColor = this.getCaretColor();
        this.input.style.color = 'transparent';
    }

    private getStyles(): string {
        const computed = window.getComputedStyle(this.input);
        return `
            :host {
                position: absolute;
                pointer-events: none;
                z-index: 9999;
            }
            .overlay-text {
                font-family: ${computed.fontFamily};
                font-size: ${computed.fontSize};
                font-weight: ${computed.fontWeight};
                line-height: ${computed.lineHeight};
                letter-spacing: ${computed.letterSpacing};
                padding: ${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft};
                border: ${computed.borderWidth} solid transparent;
                box-sizing: border-box;
                white-space: pre;
                overflow: hidden;
                color: ${this.getTextColor()};
            }
            .chip {
                background: #e8f0fe;
                color: #1a73e8;
                border-radius: 2px;
            }
        `;
    }

    private getTextColor(): string {
        // Use captured original color; fallback if transparent/invalid
        const color = this.originalTextColor;
        if (!color || color === 'rgba(0, 0, 0, 0)' || color === 'transparent') {
            return '#3c4043'; // Google Calendar default
        }
        return color;
    }

    private getCaretColor(): string {
        // 'auto' means browser uses text color as caret color
        if (this.originalCaretColor === 'auto') {
            return this.getTextColor();
        }
        return this.originalCaretColor;
    }

    private updatePosition() {
        const rect = this.input.getBoundingClientRect();
        this.host.style.left = `${rect.left + window.scrollX}px`;
        this.host.style.top = `${rect.top + window.scrollY}px`;
        this.host.style.width = `${rect.width}px`;
        this.host.style.height = `${rect.height}px`;
    }

    private startPositionTracking() {
        const tick = () => {
            if (this.isDestroyed) return;
            this.updatePosition();
            this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
    }

    updateText(text: string) {
        this.textContainer.innerHTML = '';

        // Split by "today" (case-insensitive), keeping the delimiter
        const segments = text.split(/(today)/i);

        for (const segment of segments) {
            if (!segment) continue;

            if (segment.toLowerCase() === 'today') {
                const chip = document.createElement('span');
                chip.className = 'chip';
                chip.textContent = segment;
                this.textContainer.appendChild(chip);
            } else {
                // Replace spaces with non-breaking spaces
                const textNode = document.createTextNode(segment.replace(/ /g, '\u00A0'));
                this.textContainer.appendChild(textNode);
            }
        }
    }

    destroy() {
        this.isDestroyed = true;

        // Cancel RAF loop
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Restore input styles
        this.input.style.color = '';
        this.input.style.caretColor = '';

        // Remove from DOM
        this.host.remove();
    }
}

/**
 * Manages attachment of listeners to Google Calendar's event editor
 */
class AttachmentManager {
    private observer: MutationObserver | null = null;
    private currentTitleInput: HTMLInputElement | null = null;
    private overlay: TitleOverlay | null = null;

    constructor() {
        this.init();
    }

    private init() {
        log('Loaded on Google Calendar');
        this.startObserving();
        this.checkForEditor();
    }

    private startObserving() {
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node instanceof HTMLElement) {
                            this.checkNodeForEditor(node);
                        }
                    }
                    for (const node of mutation.removedNodes) {
                        if (node instanceof HTMLElement) {
                            this.checkNodeForEditorClose(node);
                        }
                    }
                }
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    private checkForEditor() {
        const titleInput = document.querySelector(SELECTORS.titleInput);
        if (titleInput instanceof HTMLInputElement) {
            this.onEditorDetected(titleInput);
        }
    }

    private checkNodeForEditor(node: HTMLElement) {
        const titleInput = node.querySelector?.(SELECTORS.titleInput);
        if (titleInput instanceof HTMLInputElement) {
            this.onEditorDetected(titleInput);
            return;
        }

        if (node instanceof HTMLInputElement && node.matches(SELECTORS.titleInput)) {
            this.onEditorDetected(node);
        }
    }

    private checkNodeForEditorClose(node: HTMLElement) {
        if (this.currentTitleInput && node.contains(this.currentTitleInput)) {
            this.onEditorClosed();
        }
    }

    private onEditorDetected(input: HTMLInputElement) {
        if (input.hasAttribute(ATTACHED_ATTR)) {
            return;
        }

        // Clean up any existing attachment before creating new one
        if (this.currentTitleInput && this.currentTitleInput !== input) {
            this.detachFromTitleInput(this.currentTitleInput);
        }

        log('Event editor detected');
        input.setAttribute(ATTACHED_ATTR, 'true');
        this.currentTitleInput = input;
        this.attachToTitleInput(input);
    }

    private onEditorClosed() {
        log('Event editor closed');
        this.detachFromTitleInput(this.currentTitleInput);
        this.currentTitleInput = null;
    }

    private attachToTitleInput(input: HTMLInputElement) {
        log('Attached to title input');

        // Create overlay
        const overlay = new TitleOverlay(input);
        this.overlay = overlay;

        // Track if we've already set today's date for current "today" detection
        let todayDateApplied = false;

        const processText = (text: string) => {
            overlay.updateText(text);

            // Set date to today if "today" detected and not already applied
            if (containsToday(text)) {
                if (!todayDateApplied) {
                    setStartDate(new Date());

                    // This is a trick to trigger a re-render of the editor component
                    // Without this, the date input will not update immediately
                    input.dispatchEvent(new Event('focus', { bubbles: true }));

                    todayDateApplied = true;
                }
            } else {
                // Reset flag when "today" is removed
                todayDateApplied = false;
            }
        };

        // Sync initial text if any
        processText(input.value);

        const handleInput = (event: Event) => {
            const target = event.target as HTMLInputElement;
            log('Title input:', target.value);
            processText(target.value);
        };

        input.addEventListener('input', handleInput);
        (input as any).__smartQuickAddHandler = handleInput;
    }

    private detachFromTitleInput(input: HTMLInputElement | null) {
        if (!input) return;

        // Destroy overlay
        this.overlay?.destroy();
        this.overlay = null;

        const handler = (input as any).__smartQuickAddHandler;
        if (handler) {
            input.removeEventListener('input', handler);
            delete (input as any).__smartQuickAddHandler;
        }
        input.removeAttribute(ATTACHED_ATTR);
    }

    destroy() {
        this.observer?.disconnect();
        this.detachFromTitleInput(this.currentTitleInput);
        this.currentTitleInput = null;
    }
}

// Initialize the extension
const manager = new AttachmentManager();

// Cleanup on page unload
window.addEventListener('unload', () => {
    manager.destroy();
});
