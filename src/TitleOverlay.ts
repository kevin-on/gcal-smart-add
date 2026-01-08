import { Token } from './parser/types';

/**
 * Overlay that renders mirrored text over the title input
 */
export class TitleOverlay {
    private host: HTMLDivElement;
    private shadow: ShadowRoot;
    private textContainer: HTMLDivElement;
    private input: HTMLInputElement;
    private rafId: number | null = null;
    private isDestroyed = false;
    private isPaused = false;
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
            if (this.isPaused) {
                this.rafId = null;
                return;
            }
            this.updatePosition();
            this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
    }

    /**
     * Pauses the RAF loop to reduce CPU usage when tab is hidden
     */
    pause() {
        if (this.isPaused) return;
        this.isPaused = true;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    /**
     * Resumes the RAF loop when tab becomes visible
     */
    resume() {
        if (!this.isPaused || this.isDestroyed) return;
        this.isPaused = false;
        this.startPositionTracking();
    }

    updateTokens(tokens: Token[]) {
        this.textContainer.innerHTML = '';

        for (const token of tokens) {
            if (token.type === 'text') {
                // Replace spaces with non-breaking spaces
                const textNode = document.createTextNode(token.raw.replace(/ /g, '\u00A0'));
                this.textContainer.appendChild(textNode);
            } else {
                const chip = document.createElement('span');
                chip.className = 'chip';
                chip.textContent = token.raw;
                this.textContainer.appendChild(chip);
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
