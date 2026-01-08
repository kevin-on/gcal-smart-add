/**
 * Manages attachment of listeners to Google Calendar's event editor
 */

import { ATTACHED_ATTR, SELECTORS } from './constants';
import { InputParser } from './parser/InputParser';
import { TitleOverlay } from './TitleOverlay';
import {
    log,
    setDate,
    setTime,
    prepareForDateOnly,
    prepareForDateTime,
    queryEditorElements,
    isEditorElementsValid,
    EditorElements,
} from './utils';

export class AttachmentManager {
    private observer: MutationObserver | null = null;
    private currentTitleInput: HTMLInputElement | null = null;
    private overlay: TitleOverlay | null = null;
    private parser = new InputParser();
    private editorElements: EditorElements | null = null;
    private cleanTitle: string = '';
    private saveButtonHandler: ((e: Event) => void) | null = null;
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

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

        // Only work on full event edit page, ignore popup editor
        if (!document.querySelector(SELECTORS.eventEditPage)) {
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
        // Magic function to rerender the editor component
        const rerender = () => {
            input.dispatchEvent(new Event('focus', { bubbles: true }));
        };

        // Create overlay
        const overlay = new TitleOverlay(input);
        this.overlay = overlay;

        // Cache editor elements (re-queried if stale)
        this.editorElements = queryEditorElements();

        const getElements = (): EditorElements => {
            if (!isEditorElementsValid(this.editorElements)) {
                this.editorElements = queryEditorElements();
            }
            return this.editorElements!;
        };

        const processText = (text: string) => {
            const result = this.parser.parse(text);
            overlay.updateTokens(result.tokens);
            this.cleanTitle = result.cleanTitle;

            if (result.event.start) {
                log('parsed result:', result);
                const elements = getElements();

                // Prepare the editor state based on whether we have time or not
                if (result.event.start.hasTime) {
                    prepareForDateTime(elements);
                    rerender();
                } else {
                    prepareForDateOnly(elements);
                    rerender();
                }

                // Compute default end when not explicitly given
                if (!result.event.end) {
                    if (result.event.start.hasTime) {
                        const endDate = new Date(result.event.start.date);
                        endDate.setHours(endDate.getHours() + 1);
                        result.event.end = {
                            date: endDate,
                            hasTime: true,
                            hasDate: result.event.start.hasDate,
                        };
                    } else if (result.event.start.hasDate) {
                        // End = same date, no time
                        result.event.end = {
                            date: new Date(result.event.start.date),
                            hasTime: false,
                            hasDate: true,
                        };
                    }
                }

                const startDateChanged = result.event.start.hasDate
                    ? setDate(elements, result.event.start.date, 'start')
                    : false;
                const endDateChanged = result.event.end?.hasDate
                    ? setDate(elements, result.event.end.date, 'end')
                    : false;

                let startTimeChanged = false;
                let endTimeChanged = false;
                if (result.event.start.hasTime) {
                    startTimeChanged = setTime(elements, result.event.start.date, 'start');
                    endTimeChanged = result.event.end?.hasTime
                        ? setTime(elements, result.event.end.date, 'end')
                        : false;
                }

                // Trigger re-render when start or end date changed
                if (startDateChanged || endDateChanged || startTimeChanged || endTimeChanged) {
                    rerender();
                }
            }
        };

        // For initial input, only update the overlay and do not change the editor state
        const initialResult = this.parser.parse(input.value);
        overlay.updateTokens(initialResult.tokens);
        this.cleanTitle = initialResult.cleanTitle;

        const handleInput = (event: Event) => {
            const target = event.target as HTMLInputElement;
            log('Title input:', target.value);
            processText(target.value);
        };

        input.addEventListener('input', handleInput);
        (input as any).__smartQuickAddHandler = handleInput;

        // Attach save button handler to replace title with cleanTitle before submit
        this.attachSaveButtonHandler(input);
    }

    private attachSaveButtonHandler(input: HTMLInputElement) {
        // Helper to replace title with cleanTitle
        const replaceWithCleanTitle = () => {
            if (this.cleanTitle && input.value !== this.cleanTitle) {
                log('Replacing title with cleanTitle:', this.cleanTitle);

                // Set the native value to bypass React's controlled input
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    HTMLInputElement.prototype,
                    'value'
                )?.set;
                nativeInputValueSetter?.call(input, this.cleanTitle);

                // Dispatch input event to sync React state
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };

        // Handle Save button click
        const saveButton = document.querySelector('button[aria-label="Save"]');
        if (saveButton) {
            this.saveButtonHandler = () => replaceWithCleanTitle();
            saveButton.addEventListener('click', this.saveButtonHandler, { capture: true });
            log('Save button handler attached');
        } else {
            log('Save button not found');
        }

        // Handle Enter key in title input
        this.keydownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                replaceWithCleanTitle();
            }
        };
        input.addEventListener('keydown', this.keydownHandler, { capture: true });
        log('Keydown handler attached');
    }

    private detachSaveButtonHandler() {
        if (this.saveButtonHandler) {
            const saveButton = document.querySelector('button[aria-label="Save"]');
            saveButton?.removeEventListener('click', this.saveButtonHandler, { capture: true });
            this.saveButtonHandler = null;
        }
    }

    private detachKeydownHandler(input: HTMLInputElement) {
        if (this.keydownHandler) {
            input.removeEventListener('keydown', this.keydownHandler, { capture: true });
            this.keydownHandler = null;
        }
    }

    private detachFromTitleInput(input: HTMLInputElement | null) {
        if (!input) return;

        // Destroy overlay
        this.overlay?.destroy();
        this.overlay = null;

        // Clear cached elements
        this.editorElements = null;

        // Detach save handlers
        this.detachSaveButtonHandler();
        this.detachKeydownHandler(input);
        this.cleanTitle = '';

        const handler = (input as any).__smartQuickAddHandler;
        if (handler) {
            input.removeEventListener('input', handler);
            delete (input as any).__smartQuickAddHandler;
        }
        input.removeAttribute(ATTACHED_ATTR);
    }

    destroy() {
        this.observer?.disconnect();
        this.observer = null;
        this.detachFromTitleInput(this.currentTitleInput);
        this.currentTitleInput = null;
    }

    /**
     * Pauses expensive operations (RAF loop) when tab is hidden
     */
    pause() {
        this.overlay?.pause();
    }

    /**
     * Resumes operations when tab becomes visible
     */
    resume() {
        this.overlay?.resume();
    }
}
