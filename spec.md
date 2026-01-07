## Brief spec: “Smart Quick Add for Google Calendar” Chrome Extension

### 1) Goal

Enable Todoist-like natural language input inside Google Calendar’s **event title** field to automatically extract date/time, duration, recurrence, guests, and location, then apply them to the event form while keeping the remaining text as the title.

### 2) Target surfaces

* Google Calendar web app (`https://calendar.google.com/*`)
* Event creation flows:

  * Quick event popover (“Add title and time”)
  * Full event editor (“Event details”)

### 3) Core user experience

**Inline mode (primary)**

* When the user types in the title field, the extension:

  * Detects natural language tokens (date, time, duration, recurrence, timezone)
  * Shows lightweight inline UI:

    * “Detected: Thu 3pm–4pm” chip, with Apply and Undo
    * Optional suggestions dropdown (multiple parses)
* On Apply (or Enter behavior configurable):

  * Sets Calendar’s date/time fields accordingly
  * Removes the parsed phrase from the title (optional)
  * Preserves cursor position and typing flow

**Fallback mode (secondary)**

* Hotkey opens an extension-owned command palette overlay.
* User types: `Team sync tomorrow 3pm for 30m @ Gangnam #reliv invite alice@example.com`
* On Enter:

  * If event editor is open, fill fields.
  * If not open, open the create-event UI and fill fields.

### 4) Supported parsing (MVP)

* Dates: today, tomorrow, next Mon, Jan 7, 2026, 1/7
* Times: 3pm, 15:00, noon
* Ranges: 3–4pm, 3pm-4:30pm
* Duration: “for 45m”, “for 2h”
* All-day: “all day”
* Recurrence (basic): “every day”, “every week”, “every Mon”
* Timezone (basic): “KST”, “PST”, “UTC+9”
* Guests: emails detected automatically (optional)
* Location: `@ place` (optional)

### 5) Rules and behaviors

* Never auto-apply without a visible confirmation (default).
* Undo always available for the last applied parse.
* If multiple parses are plausible, show a chooser (dropdown).
* If user manually edits date/time after applying, parsing does not override unless re-applied.
* If title contains no parseable tokens, do nothing.

### 6) UI requirements

* Inline chip near the title field (non-intrusive).
* Command palette overlay:

  * Keyboard-first (Esc closes, Enter applies)
  * Shows preview line: “Will set: Jan 7, 3:00–3:30pm”
* Settings page:

  * Auto-apply on Enter: on/off
  * Strip parsed tokens from title: on/off
  * Default duration if only start time provided
  * Locale: English/Korean parsing preset

### 7) Technical approach (high-level)

* Manifest V3 extension.
* Content script on `calendar.google.com`:

  * Detect event editor mount via `MutationObserver`
  * Attach listeners to title input
  * Render inline UI via shadow DOM to avoid CSS conflicts
  * Write values into Google Calendar fields by setting input values + dispatching input/change events
* Background/service worker for:

  * Hotkey command handling
  * Settings storage (chrome.storage)

### 8) Permissions

* Host permission: `https://calendar.google.com/*`
* Storage permission for settings
* Commands permission for hotkeys

### 9) Non-goals (v1)

* Creating events via Google Calendar API (OAuth)
* Deep support for complex recurrence grammar
* Natural language parsing for non-title fields directly

### 10) Success criteria

* User can type: “Project sync tomorrow 3pm for 30m” in the title field
* With one action, Calendar fields are set correctly and the title becomes “Project sync”
* Works reliably in both quick popover and full editor flows
