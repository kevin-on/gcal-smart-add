import { Token } from './parser/types';

/**
 * Overlay that renders mirrored text over the title input
 */
export class TitleOverlay {
    private host: HTMLDivElement;
    private shadow: ShadowRoot;
    private textContainer: HTMLDivElement;
    private toggleButton: HTMLButtonElement;
    private tooltip: HTMLDivElement;
    private input: HTMLInputElement;
    private rafId: number | null = null;
    private isDestroyed = false;
    private isPaused = false;
    private isDisabled = false;
    private originalTextColor: string;
    private originalCaretColor: string;
    private onToggle?: (isDisabled: boolean) => void;

    constructor(input: HTMLInputElement, onToggle?: (isDisabled: boolean) => void) {
        this.input = input;
        this.onToggle = onToggle;

        // Capture original colors BEFORE modifying styles
        const computed = window.getComputedStyle(input);
        this.originalTextColor = computed.color;
        this.originalCaretColor = computed.caretColor;

        this.host = document.createElement('div');
        this.host.className = 'smart-add-overlay-host';
        this.shadow = this.host.attachShadow({ mode: 'closed' });

        // Create text container inside shadow DOM
        this.textContainer = document.createElement('div');
        this.textContainer.className = 'overlay-text';

        // Add styles and container to shadow DOM
        const style = document.createElement('style');
        style.textContent = this.getStyles();
        this.shadow.appendChild(style);
        this.shadow.appendChild(this.textContainer);

        this.toggleButton = document.createElement('button');
        this.toggleButton.type = 'button';
        this.toggleButton.className = 'toggle-button';
        this.toggleButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.setDisabled(!this.isDisabled);
            this.onToggle?.(this.isDisabled);
            this.input.focus();
        });
        this.toggleButton.addEventListener('mouseenter', () => this.showTooltip());
        this.toggleButton.addEventListener('mouseleave', () => this.hideTooltip());
        this.toggleButton.addEventListener('focus', () => this.showTooltip());
        this.toggleButton.addEventListener('blur', () => this.hideTooltip());
        this.shadow.appendChild(this.toggleButton);

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        this.shadow.appendChild(this.tooltip);

        // Mount and start continuous position tracking
        document.body.appendChild(this.host);
        this.startPositionTracking();

        // Make input text transparent (caret stays visible with original color)
        this.input.style.caretColor = this.getCaretColor();
        this.input.style.color = 'transparent';
        this.setDisabled(false);
    }

    private getStyles(): string {
        const computed = window.getComputedStyle(this.input);
        return `
            :host {
                position: absolute;
                pointer-events: none;
            }
            .overlay-text {
                font-family: ${computed.fontFamily};
                font-size: ${computed.fontSize};
                font-weight: ${computed.fontWeight};
                line-height: ${computed.lineHeight};
                letter-spacing: ${computed.letterSpacing};
                padding: ${computed.paddingTop} calc(${computed.paddingRight} + 64px) ${computed.paddingBottom} ${computed.paddingLeft};
                border: ${computed.borderWidth} solid transparent;
                box-sizing: border-box;
                white-space: pre;
                overflow: hidden;
                color: ${this.getTextColor()};
                height: 100%;
                display: flex;
                align-items: center;
                pointer-events: none;
            }
            .chip {
                background: #e8f0fe;
                color: #1a73e8;
                border-radius: 2px;
            }
            .toggle-button {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 12px;
                font-weight: 500;
                padding: 2px 8px;
                border-radius: 4px;
                border: 1px solid #dadce0;
                background: #f8f9fa;
                color: #5f6368;
                cursor: pointer;
                pointer-events: auto;
                height: 24px;
                display: inline-flex;
                align-items: center;
                box-shadow: 0 1px 2px rgba(60, 64, 67, 0.15);
            }
            .toggle-button:hover {
                background: #e8eaed;
            }
            .toggle-button:active {
                background: #d2e3fc;
            }
            .tooltip {
                position: absolute;
                right: 0;
                top: -34px;
                padding: 6px 8px;
                border-radius: 4px;
                background: #202124;
                color: #fff;
                font-size: 12px;
                line-height: 1.4;
                white-space: nowrap;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                opacity: 0;
                transform: translateY(4px);
                pointer-events: none;
                transition: opacity 120ms ease, transform 120ms ease;
            }
            .tooltip::after {
                content: '';
                position: absolute;
                bottom: -6px;
                right: 12px;
                border-width: 6px 6px 0 6px;
                border-style: solid;
                border-color: #202124 transparent transparent transparent;
            }
            .tooltip.visible {
                opacity: 1;
                transform: translateY(0);
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

    private setDisabled(disabled: boolean) {
        this.isDisabled = disabled;
        this.toggleButton.textContent = disabled ? 'Turn on' : 'Turn off';
        this.tooltip.textContent = disabled
            ? 'Turn on smart add'
            : 'Turn off smart add';

        if (disabled) {
            this.textContainer.style.opacity = '0';
            this.input.style.color = this.originalTextColor;
            this.input.style.caretColor = this.originalCaretColor;
            return;
        }

        this.textContainer.style.opacity = '1';
        this.input.style.caretColor = this.getCaretColor();
        this.input.style.color = 'transparent';
    }

    private showTooltip() {
        this.tooltip.classList.add('visible');
    }

    private hideTooltip() {
        this.tooltip.classList.remove('visible');
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
