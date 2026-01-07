/**
 * Smart Quick Add for Google Calendar
 * Content script that enables Todoist-like natural language input
 */

const EXTENSION_NAME = 'Smart Quick Add';
const ATTACHED_ATTR = 'data-smart-quick-add-attached';

const SELECTORS = {
    titleInput: 'input[aria-label*="Add title"], input[data-placeholder*="Add title"]',
};

function log(...args: unknown[]) {
    console.log(`[${EXTENSION_NAME}]`, ...args);
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
        // Replace spaces with non-breaking spaces to preserve whitespace rendering
        this.textContainer.textContent = text.replace(/ /g, '\u00A0');
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

        // Sync initial text if any
        overlay.updateText(input.value);

        const handleInput = (event: Event) => {
            const target = event.target as HTMLInputElement;
            log('Title input:', target.value);
            overlay.updateText(target.value);
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
