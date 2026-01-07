/**
 * Manages attachment of listeners to Google Calendar's event editor
 */

import { ATTACHED_ATTR, SELECTORS } from './constants';
import { TitleOverlay } from './TitleOverlay';
import { containsToday, log, setStartDate } from './utils';

export class AttachmentManager {
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

