## Implementation Roadmap

### Phase 1: Foundation

#### Step 1.1 — Basic Extension Setup
**Goal**: Create a minimal Chrome extension that loads on Google Calendar

**Deliverables**:
- `manifest.json` (Manifest V3)
- `src/content.ts` (empty, just logs on load)
- Build configuration (TypeScript → JS)

**Verification**:
```
✓ Extension loads in chrome://extensions
✓ Console shows "Smart Quick Add loaded" on calendar.google.com
✓ No errors in console
```

---

#### Step 1.2 — Detect Event Editor Mount
**Goal**: Detect when the quick event popover or full editor opens

**Deliverables**:
- `AttachmentManager` class with MutationObserver
- Detect title input appearance

**Verification**:
```
✓ Click on a date in Google Calendar
✓ Console logs "Event editor detected" when popover appears
✓ Console logs "Event editor closed" when popover closes
✓ Works for both quick popover AND full editor (/eventedit URL)
```

---

#### Step 1.3 — Attach to Title Input
**Goal**: Get a reference to the title input and listen to changes

**Deliverables**:
- Find title input element reliably
- Attach `input` event listener
- Prevent double-attachment with data attribute

**Verification**:
```
✓ Type in title field → console logs each keystroke's full value
✓ Open/close popover multiple times → no duplicate listeners
✓ Works in both quick popover and full editor
```

---

### Phase 2: Overlay System

#### Step 2.1 — Create Overlay Container
**Goal**: Position an overlay element exactly over the title input

**Deliverables**:
- Shadow DOM host element
- Overlay container with matched positioning
- Basic styling (semi-transparent background for debugging)

**Verification**:
```
✓ Overlay appears directly over title input
✓ Overlay follows input if window resizes
✓ Overlay doesn't interfere with typing (pointer-events: none)
✓ Google Calendar's CSS doesn't affect overlay
```

---

#### Step 2.2 — Mirror Input Text in Overlay
**Goal**: Render the same text in overlay, synchronized with input

**Deliverables**:
- Match font family, size, padding, line-height
- Update overlay text on every input event
- Make input text transparent, keep caret visible

**Verification**:
```
✓ Type "hello world" → overlay shows "hello world"
✓ Text appears in same position as it would in input
✓ Caret (blinking cursor) is still visible
✓ Backspace/delete updates overlay correctly
```

---

#### Step 2.3 — Render Token Chips (Hardcoded)
**Goal**: Visually render a hardcoded token as a chip

**Deliverables**:
- If text contains "today", render it as a styled chip
- Chip styling (background, border-radius, color)

**Verification**:
```
✓ Type "meeting today" → "today" appears as a blue chip
✓ Type "hello world" → no chips, plain text
✓ Type "today is today" → both "today" words are chips
✓ Chips look visually distinct from regular text
```

---

### Phase 3: Parser

#### Step 3.1 — Basic Token Parser
**Goal**: Parse raw text into segments (Text and Token)

**Deliverables**:
- `Parser` class with `parse(text: string)` method
- Returns array of segments: `{ type: 'text' | 'token', value: string, ... }`
- Recognize: `today`, `tomorrow`

**Verification**:
```typescript
parse("meeting today at 3pm")
// → [
//   { type: 'text', value: 'meeting ' },
//   { type: 'token', tokenType: 'date', value: 'today', ... },
//   { type: 'text', value: ' at 3pm' }
// ]
```
```
✓ Unit tests pass for basic cases
✓ Parser is case-insensitive ("Today" = "today")
```

---

#### Step 3.2 — Date/Time Token Recognition
**Goal**: Expand parser to recognize dates and times

**Patterns to recognize**:
- Dates: `today`, `tomorrow`, `next Monday`, `Jan 7`, `1/7`
- Times: `3pm`, `15:00`, `noon`
- Ranges: `3-4pm`, `3pm-4:30pm`
- Duration: `for 30m`, `for 2h`

**Verification**:
```
✓ "meeting tomorrow 3pm" → tokens: tomorrow, 3pm
✓ "call at 15:00 for 30m" → tokens: 15:00, for 30m
✓ "lunch next Monday noon" → tokens: next Monday, noon
✓ Unit tests pass for all patterns
```

---

#### Step 3.3 — Semantic Extraction
**Goal**: Convert tokens into structured data

**Deliverables**:
- Extract actual Date objects from date tokens
- Extract start time, end time, duration
- Compute `cleanTitle` (text with tokens removed)

**Verification**:
```typescript
parse("Project sync tomorrow 3pm for 30m")
// → {
//   segments: [...],
//   cleanTitle: "Project sync",
//   semantics: {
//     date: Date(2026-01-08),
//     startTime: "15:00",
//     endTime: "15:30"  // computed from duration
//   }
// }
```
```
✓ Unit tests for semantic extraction
✓ Duration correctly computes end time
✓ Clean title has normalized whitespace
```

---

### Phase 4: Integration

#### Step 4.1 — Connect Parser to Overlay
**Goal**: Use real parser output to render chips

**Deliverables**:
- Wire up parser to input events
- Render segments with proper chip styling per token type

**Verification**:
```
✓ Type "meeting tomorrow 3pm" → two chips appear
✓ Chips have appropriate colors (date vs time)
✓ Editing text updates chips in real-time
```

---

#### Step 4.2 — Preview UI
**Goal**: Show what will be applied below the input

**Deliverables**:
- Preview line: "Will set: Thu Jan 8, 3:00pm–3:30pm"
- Only shows when tokens are detected

**Verification**:
```
✓ Type "meeting tomorrow 3pm for 30m"
✓ Below input shows: "Will set: Thu Jan 8, 3:00pm–3:30pm"
✓ Typing non-token text → preview hidden
```

---

### Phase 5: Commit & Apply

#### Step 5.1 — Intercept Save Action
**Goal**: Detect when user clicks Save/Create

**Deliverables**:
- Capture-phase listener on Save button
- Detect keyboard confirmation (Enter key in some contexts)

**Verification**:
```
✓ Click Save → console logs "Save intercepted"
✓ Event proceeds normally after logging (no blocking)
✓ Works for both quick popover Save and full editor Save
```

---

#### Step 5.2 — Strip Tokens from Title on Save
**Goal**: Replace title with clean title before save completes

**Deliverables**:
- On save intercept: set input.value = cleanTitle
- Dispatch input/change events

**Verification**:
```
✓ Type "Project sync tomorrow 3pm"
✓ Click Save
✓ Event is created with title "Project sync" (not the full text)
✓ Check in calendar that saved event has clean title
```

---

#### Step 5.3 — Apply Date/Time to Calendar Fields
**Goal**: Set Google Calendar's date/time pickers programmatically

**Deliverables**:
- `DateTimeApplicator` that finds and sets date fields
- Handle time fields
- Dispatch proper events for GCal to recognize changes

**Verification**:
```
✓ Type "meeting tomorrow 3pm for 1h"
✓ Click Save
✓ Event created for tomorrow, 3:00pm–4:00pm
✓ Verify in calendar the date/time is correct
```

---

### Phase 6: Polish & Edge Cases

#### Step 6.1 — IME Support (Korean/Japanese)
**Goal**: Don't tokenize during IME composition

**Deliverables**:
- Track `compositionstart` / `compositionend`
- Suspend parsing during composition

**Verification**:
```
✓ Type Korean text with IME
✓ No premature tokenization during composition
✓ Tokens recognized after composition ends
```

---

#### Step 6.2 — Undo/Cleanup
**Goal**: Handle edge cases gracefully

**Deliverables**:
- If user cancels (closes popover), no side effects
- Overlay cleans up on dialog close

**Verification**:
```
✓ Type tokens, then close popover without saving
✓ Reopen popover → starts fresh, no leftover state
✓ No memory leaks (check with DevTools)
```

---

#### Step 6.3 — Settings Integration
**Goal**: User preferences from extension options

**Deliverables**:
- Options page with settings:
  - Strip tokens from title: on/off
  - Default duration
- Settings loaded via `chrome.storage`

**Verification**:
```
✓ Change "default duration" to 45min in options
✓ Type "meeting tomorrow 3pm" (no duration)
✓ Event created: 3:00pm–3:45pm
```

---

## Summary Table

| Step | Description | Key Verification |
|------|-------------|------------------|
| 1.1 | Basic extension setup | Console log on GCal load |
| 1.2 | Detect event editor | Log on popover open/close |
| 1.3 | Attach to title input | Log keystrokes |
| 2.1 | Overlay container | Positioned over input |
| 2.2 | Mirror text | Transparent input, visible overlay |
| 2.3 | Hardcoded chips | "today" renders as chip |
| 3.1 | Basic parser | Segments array output |
| 3.2 | Date/time patterns | Recognize common patterns |
| 3.3 | Semantic extraction | cleanTitle + structured data |
| 4.1 | Parser → Overlay | Real-time chip rendering |
| 4.2 | Preview UI | "Will set: ..." line |
| 5.1 | Intercept save | Log on save click |
| 5.2 | Strip title | Clean title saved |
| 5.3 | Apply date/time | Correct event created |
| 6.1 | IME support | Korean typing works |
| 6.2 | Cleanup | No leftover state |
| 6.3 | Settings | User preferences applied |

---