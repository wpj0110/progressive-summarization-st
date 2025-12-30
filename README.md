# Progressive Summarization Extension for SillyTavern

A SillyTavern extension that automatically summarizes conversation messages when they reach a specified token threshold, helping manage long conversations efficiently.

## Features

- 🔄 **Automatic Summarization**: Summarizes messages every X tokens (user-configurable)
- 📚 **Progressive Context**: New summaries take previous summaries into account
- ✅ **Smart Message Tracking**: Already-summarized messages won't be re-summarized
- 💾 **Persistent Storage**: Settings and summaries are saved across sessions
- 🎯 **Manual Control**: Trigger summarization manually when needed
- 📊 **Status Display**: View current token count, summaries, and progress

## How It Works

1. **Token Counting**: The extension monitors your conversation and counts tokens in unsummarized messages
2. **Threshold Trigger**: When the token count reaches your specified threshold, summarization is triggered automatically
3. **Context-Aware**: Each new summary includes previous summaries for continuity
4. **Message Exclusion**: Summarized messages are marked and won't be included in future prompts

## Installation

1. Copy this extension folder to your SillyTavern extensions directory:
   ```
   SillyTavern/public/scripts/extensions/third-party/progressive-summarization-st/
   ```

2. Build the extension:
   ```bash
   npm install
   npm run build
   ```

3. Restart SillyTavern and enable the extension in Settings > Extensions

## Usage

### Settings

- **Enable Progressive Summarization**: Toggle the extension on/off
- **Token Threshold**: Set how many tokens should accumulate before triggering a summary (default: 1000)
- **Save Settings**: Persist your configuration

### Buttons

- **Save Settings**: Save your current configuration
- **Summarize Now**: Manually trigger summarization of unsummarized messages
- **Clear Summaries**: Remove all stored summaries and reset tracking

### Status Display

The extension shows:
- Current token count vs threshold
- Total number of summaries created
- Number of messages that have been summarized
- List of recent summaries with timestamps

## For Developers

### React Concepts (Angular Comparison)

If you're coming from Angular, here are the React equivalents:

| Angular | React |
|---------|-------|
| `@Component` | Function component |
| `ngOnInit()` | `useEffect(() => {}, [])` |
| `ngOnDestroy()` | `useEffect(() => { return () => {} }, [])` |
| `[(ngModel)]="value"` | `value={state}` + `onChange={(e) => setState(e.target.value)}` |
| `*ngIf="condition"` | `{condition && <Component />}` |
| `*ngFor="let item of items"` | `{items.map(item => <Component key={item.id} />)}` |
| Service injection | Import and use functions |
| Two-way binding | State + callbacks (one-way flow) |

### State Management

- Uses React's `useState` hook for component state
- `useEffect` for side effects and lifecycle management
- Settings stored in `SillyTavern.getContext().extensionSettings`

### Key Functions

- `loadSettings()`: Load saved configuration
- `saveSettings()`: Persist settings to SillyTavern
- `estimateTokens()`: Approximate token count from text
- `checkAndSummarize()`: Check if threshold reached
- `performSummarization()`: Create summary via API call
- `handleMessageSent/Received()`: Event listeners for new messages

## Requirements

- SillyTavern version 1.11.0 or higher
- Node.js and npm for building

## License

See LICENSE file

## Author

wpj0110
