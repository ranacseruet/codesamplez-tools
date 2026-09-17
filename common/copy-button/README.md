# 🔥 CopyButton Component

A stunning, feature-rich copy button component that provides seamless clipboard functionality for textarea, input, and pre elements. Built with modern web standards and designed for maximum usability and visual appeal.

## ✨ Features

- 🎯 **Smart Visibility**: Automatically shows/hides based on content presence
- 📋 **Modern Clipboard API**: Uses latest browser APIs with graceful fallback support
- 🎨 **Beautiful Animations**: Smooth success and error state transitions
- ♿ **Accessibility First**: Full ARIA support and keyboard navigation
- 🔧 **Easy Integration**: Works seamlessly with existing clear-button wrappers
- 📱 **Responsive Design**: Looks great on all devices and screen sizes
- 🎪 **Event System**: Dispatches custom events for easy integration
- 🛡️ **Robust Error Handling**: Multiple fallback mechanisms ensure reliability
- 🎭 **Visual Feedback**: Clear success/error animations with customizable styling

## 🚀 Quick Start

### Installation

Simply import the component files into your project:

```javascript
import CopyButton from './common/copy-button/CopyButton';
import './common/copy-button/copy-button.css';
```

### Basic Usage

```javascript
// Works with textarea elements
const textArea = document.getElementById('my-textarea');
const copyButton = new CopyButton(textArea);

// Works with input elements
const inputField = document.getElementById('my-input');
const inputCopyButton = new CopyButton(inputField);

// Works with pre elements (NEW!)
const preElement = document.getElementById('code-output');
const preCopyButton = new CopyButton(preElement);

// That's it! The copy button will automatically appear when there's content
```

### Advanced Usage with Event Handling

```javascript
import CopyButton from './common/copy-button/CopyButton';

const textArea = document.getElementById('my-textarea');
const copyButton = new CopyButton(textArea);

// Listen for successful copy events
textArea.addEventListener('contentCopied', (event) => {
    console.log('Content copied:', event.detail.content);
    console.log('Length:', event.detail.length);
    console.log('Timestamp:', event.detail.timestamp);
    
    // Show custom notification
    showNotification(`Copied ${event.detail.length} characters!`);
});

// Clean up when component is no longer needed
// copyButton.disconnect();
```

## 🎨 Styling

The component comes with beautiful default styles, but you can easily customize it to match your design:

### Default Styling

The copy button features:
- Elegant copy icon with smooth hover effects
- Gradient background with subtle shadows
- Smooth scale and color transitions
- Success state with checkmark animation
- Error state with warning indication

### Custom Styling

```css
/* Customize the copy button appearance */
.copy-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    width: 32px;
    height: 32px;
}

.copy-button:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* Customize success animation */
.copy-button.copy-success {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

/* Customize error animation */
.copy-button.copy-error {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
}

/* Customize the wrapper positioning */
.copy-button-wrapper {
    position: relative;
}

.copy-button-wrapper .copy-button {
    position: absolute;
    top: 8px;
    right: 8px;
}
```

## 📚 API Reference

### Constructor

```javascript
new CopyButton(targetElement)
```

**Parameters:**
- `targetElement` (HTMLTextAreaElement | HTMLInputElement | HTMLPreElement): The textarea, input, or pre element to attach the copy button to

**Throws:**
- `Error`: If the target element is not a valid HTMLTextAreaElement, HTMLInputElement, or HTMLPreElement

### Methods

#### `copyContent()`
Manually trigger the copy functionality.

```javascript
await copyButton.copyContent();
```

**Returns:** `Promise<void>`

#### `disconnect()`
Remove all event listeners and clean up the component.

```javascript
copyButton.disconnect();
```

### Events

#### `contentCopied`
Dispatched when content is successfully copied to the clipboard.

```javascript
textArea.addEventListener('contentCopied', (event) => {
    console.log(event.detail);
    // {
    //   content: "copied text",
    //   length: 11,
    //   timestamp: "2024-01-01T12:00:00.000Z"
    // }
});
```

**Event Detail:**
- `content` (string): The copied content
- `length` (number): Length of the copied content
- `timestamp` (string): ISO timestamp of when the copy occurred

## 🔧 Integration Examples

### With Existing Clear Button

The CopyButton automatically detects and integrates with existing clear-button wrappers:

```html
<div class="clear-button-wrapper">
    <textarea id="my-textarea">Some content</textarea>
    <!-- Clear button already here -->
</div>
```

```javascript
// CopyButton will use the existing wrapper
const copyButton = new CopyButton(document.getElementById('my-textarea'));
```

### Pre Element Usage

Perfect for code output, formatted text, and read-only content:

```html
<!-- Code output example -->
<pre id="jwt-output" class="c-code-output">
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
</pre>

<!-- JSON formatter output -->
<pre id="json-output" class="c-code-output">
{
  "name": "John Doe",
  "age": 30,
  "city": "New York"
}
</pre>
```

```javascript
// Add copy buttons to pre elements
const jwtOutput = document.getElementById('jwt-output');
const jsonOutput = document.getElementById('json-output');

const jwtCopyButton = new CopyButton(jwtOutput);
const jsonCopyButton = new CopyButton(jsonOutput);

// The copy button automatically detects content changes via MutationObserver
// No need to manually trigger updates when content changes!
```

### Multiple Instances

```javascript
// Create copy buttons for multiple elements
const textAreas = document.querySelectorAll('textarea');
const copyButtons = Array.from(textAreas).map(textarea => new CopyButton(textarea));

// Clean up all instances
copyButtons.forEach(button => button.disconnect());
```

### Framework Integration

#### React Example

```jsx
import { useEffect, useRef } from 'react';
import CopyButton from './common/copy-button/CopyButton';

function MyTextArea() {
    const textAreaRef = useRef(null);
    const copyButtonRef = useRef(null);

    useEffect(() => {
        if (textAreaRef.current) {
            copyButtonRef.current = new CopyButton(textAreaRef.current);
            
            const handleCopy = (event) => {
                console.log('Content copied:', event.detail.content);
            };
            
            textAreaRef.current.addEventListener('contentCopied', handleCopy);
            
            return () => {
                copyButtonRef.current?.disconnect();
                textAreaRef.current?.removeEventListener('contentCopied', handleCopy);
            };
        }
    }, []);

    return (
        <textarea
            ref={textAreaRef}
            placeholder="Type something..."
        />
    );
}
```

## 🛠️ Browser Support

- ✅ Chrome 66+
- ✅ Firefox 63+
- ✅ Safari 13.1+
- ✅ Edge 79+

**Fallback Support:**
- Copying is delegated to `common/clipboard.ts` (`copyTextToClipboard`), the one
  clipboard strategy shared by every copy affordance in the repo
- That helper uses `document.execCommand('copy')` for older browsers, for
  non-secure contexts, and as a retry when the Clipboard API rejects
- This component owns only the feedback: success/error animation and the
  `contentCopied` event

## 🧪 Testing

The component includes comprehensive test coverage:

```bash
npm test -- common/copy-button/CopyButton.test.js
```

**Test Coverage:**
- ✅ Initialization and DOM manipulation
- ✅ Visibility management
- ✅ Copy functionality (success and total-failure paths; the API/execCommand
  sequence itself is covered by `common/clipboard.test.ts`)
- ✅ Event dispatching
- ✅ Animation states
- ✅ Event listener management
- ✅ Error handling

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by modern clipboard management patterns
- Built with accessibility and usability in mind
- Designed to complement the existing clear-button component
