# Google Calendar Smart Add

A Chrome extension that brings Todoist-style natural language input to Google Calendar. Type event titles with dates and times in natural language, and the extension automatically parses them and fills in the date/time fields.

![Demo](demo.gif)

## Usage Examples

Type naturally in the event title field:

- `Team standup tomorrow at 9am` → Event on tomorrow at 9:00 AM
- `Coffee with Sarah next Tuesday at 2pm` → Event on next Tuesday at 2:00 PM
- `Vacation from July 15 to July 22` → All-day event spanning the dates
- `Dentist appointment on Friday at 10:30am` → Event this Friday at 10:30 AM

The highlighted blue chips show what the parser detected. Click "Turn off" if you want to temporarily disable parsing for a specific event.

## Features

- **Natural Language Parsing**: Type dates and times naturally (e.g., "Team meeting tomorrow at 3pm", "Lunch next Monday at noon")
- **Visual Feedback**: Date/time tokens are highlighted with colored chips as you type
- **Automatic Date/Time Population**: Parsed dates and times automatically fill the calendar editor fields
- **Clean Event Titles**: Date/time text is automatically removed from the final event title
- **Toggle On/Off**: Easily enable or disable the smart parsing feature with a button

> [!IMPORTANT]
> This extension only works on the **detailed event page**, not the quick add popup.

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the project directory

---

## For Developers

### How It Works

The extension uses [chrono-node](https://github.com/wanasit/chrono) for natural language date/time parsing. When you type in the event title field:

1. The parser detects date/time expressions in your text
2. Detected tokens are highlighted with colored chips using an overlay
3. Date and time fields in the editor are automatically populated
4. When you save, the date/time text is removed from the event title

### Prerequisites

- Node.js and npm
- Chrome browser

### Setup

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Watch mode for development
npm run dev

# Run tests
npm test

# Format code
npm run format
```

### Project Structure

```
src/
├── content.ts           # Extension entry point
├── AttachmentManager.ts # Manages lifecycle of editor attachments
├── TitleOverlay.ts      # Renders overlay with highlighted tokens
├── parser/
│   ├── InputParser.ts   # Natural language parsing logic
│   └── types.ts         # TypeScript type definitions
├── utils.ts             # Helper functions for DOM manipulation
├── constants.ts         # Selectors and constants
└── styles.css           # Extension styles

dist/                    # Built extension files
```

### Releasing

Update the version in `manifest.json` and `package.json`, then tag and push:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will automatically create a release with the extension ZIP attached.

## License

This project is licensed under the MIT License.
