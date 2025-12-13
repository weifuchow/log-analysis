# Log Analysis Extension - Technical Documentation

This document provides in-depth technical details for developers working on the log analysis Chrome extension.

## File-by-File Breakdown

### manifest.json (32 lines)

Chrome Extension configuration following Manifest V3 specifications.

**Critical Sections**:
- **Line 2**: `manifest_version: 3` - Uses modern extension architecture
- **Lines 6-12**: Permissions array
  - `storage`: Chrome Storage API for workspace/settings
  - `activeTab`: Access to current tab
  - `downloads`: File export capability
  - `background`: Service worker support
  - `tabs`: Tab creation for main UI
- **Lines 13-16**: `host_permissions` - Unrestricted HTTP/HTTPS access for remote log fetching
- **Lines 20-22**: Service worker registration (`background.js`)
- **Lines 23-25**: CSP - Restricts script execution to extension files only
- **Lines 26-31**: Web-accessible resources for main application

**Important**: No `content_scripts` - this is a popup-style extension, not a page modifier.

---

### background.js (67 lines)

Service worker handling extension lifecycle and network operations.

#### Section 1: Extension Click Handler (Lines 2-6)
```javascript
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL('main.html') });
});
```
**Behavior**: Opens main.html in new tab when extension icon clicked (no default popup).

#### Section 2: Message Router (Lines 9-16)
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchRemoteLogs') {
        fetchRemoteLogsFromBackground(request.data)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Async response
    }
});
```
**Purpose**: CORS bypass - fetch operations performed in background context.

#### Section 3: Remote Fetch Implementation (Lines 18-67)
**Function**: `fetchRemoteLogsFromBackground(data)`

**Process**:
1. **Prepare Phase** (Lines 23-39)
   - POST to `/api/v4/system-logs/prepare`
   - Query params: `beginDate`, `endDate` (ISO 8601)
   - Response: `{ code: "0", data: { filePath: string } }`

2. **Download Phase** (Lines 44-54)
   - GET from `/api/v4/system-logs/download/{filePath}`
   - Returns: ArrayBuffer (TAR archive)

3. **Return Format** (Lines 58-62)
   - Converts ArrayBuffer to Array (for message passing)
   - Includes metadata: fileName, size

**Security Note**: Line 27 & 48 contain hardcoded Bearer token - **REMOVE IN PRODUCTION**.

---

### main.html (1027 lines)

Full-page application with embedded CSS and minimal external dependencies.

#### Head Section (Lines 1-818)

**Meta Tags** (Lines 3-6):
- UTF-8 encoding
- Viewport for responsive design
- Chinese language declaration

**CSS Architecture** (Lines 7-817):

1. **Global Reset** (Lines 8-12): Box-sizing and margin reset
2. **Layout System** (Lines 54-60): CSS Grid with 3 columns (350px | 1fr | 350px)
3. **Component Styles**:
   - Panels (Lines 62-83)
   - Upload area (Lines 103-121) - Drag & drop visual states
   - Forms (Lines 123-160)
   - Buttons (Lines 189-231) - Multiple variants
   - File list (Lines 268-334) - Nested structure for TAR contents
   - Log items (Lines 357-413) - Monospace content display
   - Workspace (Lines 415-475) - Tag system
   - Progress bars (Lines 477-496)
   - Modals (Lines 524-600)
   - Templates (Lines 233-266, 577-639)
   - Responsive breakpoints (Lines 642-659) - Mobile/tablet support
   - Custom scrollbars (Lines 677-701) - Webkit styling
   - Remote logs summary (Lines 702-817) - Tree structure display

**Design Patterns**:
- Modern flat design with subtle shadows
- Color scheme: Blue primary (#3498db), dark headers (#2c3e50)
- Monospace font for log content
- Highlight color: #fff3cd (yellow) for keywords

#### Body Section (Lines 819-1027)

**Header** (Lines 820-826):
- Title
- Settings button → `#settingsModal`
- Template manager button → `#templateManagerModal`

**Left Panel** (Lines 830-926):

1. **Preset Templates** (Lines 836-848)
   - Grid layout (2 columns)
   - 8 predefined templates + custom option
   - Click handlers set in main.js

2. **Local Upload** (Lines 851-861)
   - Drag & drop area (`#uploadArea`)
   - Hidden file input (`#fileInput`)
   - Multiple file selection
   - Accept: `.log,.txt,.gz,.tar,.out`

3. **Remote Fetch** (Lines 864-884)
   - Server address input (default: 10.10.21.60:12000)
   - DateTime range pickers (`#beginDate`, `#endDate`)
   - Fetch button → `fetchRemoteLogs()`
   - Progress bar (hidden by default)

4. **Search Configuration** (Lines 887-924)
   - Search time range (separate from fetch range)
   - Quick range buttons (all, 1h, 6h, 24h)
   - Keywords textarea (multi-line)
   - Logic selector (AND/OR radio buttons)
   - Search/Clear buttons

**Center Panel** (Lines 929-940):
- Result count in header
- Result container (`#searchResults`)
- Default: Empty state with search icon

**Right Panel** (Lines 943-958):
- Export and clear buttons in header
- Workspace container (`#workspace`)
- Default: Empty state with document icon

**Modals** (Lines 961-1021):

1. **Variable Modal** (Lines 961-975)
   - Dynamic form generation for template variables
   - Apply/Cancel buttons

2. **Settings Modal** (Lines 978-996)
   - API token input (password field)
   - Save/Cancel buttons

3. **Template Manager** (Lines 999-1021)
   - Template list display
   - Template form (name + keywords from current search)
   - Save/Close buttons

**Scripts** (Lines 1023-1026):
1. pako.min.js - gzip library
2. jszip.min.js - ZIP library
3. main.js - Application logic

---

### main.js (2001 lines)

Core application logic. This is the heart of the extension.

#### Global State (Lines 1-10)

```javascript
let fileList = [];           // { file, name, size, status, timeRange, subFiles[] }
let remoteLogData = null;    // { fileName, timeRange, subFiles[] }
let searchResults = [];      // { timestamp, content, source, id }
let workspace = [];          // { ...log, markedAt, tags[] }
let isSearching = false;     // Search lock
let overallTimeRange = null; // { start: Date, end: Date }
let tagColors = [...];       // Color palette for tags
let nextTagColorIndex = 0;   // Round-robin color assignment
let currentTemplate = null;  // Active template for variable substitution
```

#### Preset Templates Definition (Lines 12-83)

**Structure**:
```javascript
{
    'template-key': {
        name: 'Display Name',
        keywords: ['keyword1', '${variable}', ...],
        logic: 'and' | 'or',
        variables: ['variable']  // Required substitutions
    }
}
```

**Templates**:
1. **communication**: Device communication logs
2. **status-request**: GlobalRequestHandler queue logs
3. **order-assign**: AssignFreeTasksPhase logs
4. **path-planning**: Vehicle route planning (7 specific log lines)
5. **traffic-control**: Resource allocation/release (6 patterns)
6. **order-execute**: Task lifecycle (9 patterns with orderID)
7. **elevator-state**: ResourceDevice elevator logs

**Variable Substitution**: Uses `${variable}` syntax, replaced in `applyTemplate()` (line 396).

#### TAR Parser (Lines 86-165)

**Class**: `SimpleTarReader`

Custom implementation (no external library) for TAR archive extraction.

**Constructor** (Lines 87-90):
- Accepts ArrayBuffer
- Converts to Uint8Array
- Initializes read offset

**Methods**:

1. **`readString(length)`** (Lines 92-101)
   - Reads ASCII string from buffer
   - Null-terminates at first \0 byte
   - Advances offset

2. **`readOctal(length)`** (Lines 103-106)
   - Reads octal number (TAR uses octal for sizes)
   - Converts string to base-8 integer

3. **`extractFiles()`** (Lines 108-164) - Main extraction logic
   - Loops through 512-byte TAR header blocks
   - Detects end-of-archive (consecutive zeros)
   - Parses header fields:
     - name (100 bytes)
     - mode, uid, gid (8 bytes each)
     - size (12 bytes, octal)
     - mtime, checksum, type
   - Reads file data
   - Skips to next 512-byte boundary
   - Returns array: `[{ name, size, buffer }, ...]`

**Limitations**: Only handles regular files (type '0' or '\0'), skips directories.

#### Initialization (Lines 168-188)

**Function**: `initializeApp()`

Sets default time ranges to last 1 hour:
```javascript
const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
document.getElementById('beginDate').value = formatDateForInput(oneHourAgo);
document.getElementById('endDate').value = formatDateForInput(now);
// Same for search date pickers
```

#### Event Listeners Setup (Lines 190-267)

**Function**: `setupEventListeners()`

**File Upload Events** (Lines 194-215):
- `fileInput.change` → `handleFileSelect()`
- `uploadArea.click` → Trigger file input
- `uploadArea.dragover` → Add `dragover` class
- `uploadArea.dragleave` → Remove `dragover` class
- `uploadArea.drop` → `handleFileSelect()` with dropped files

**Template Events** (Lines 218-226):
- Event delegation on `#presetTemplates` container
- Click on `.template-btn` → `handlePresetTemplateClick()`

**Button Events** (Lines 229-255):
- All bound via `addEventListener`
- Modal close buttons use `[data-modal]` attribute

**Time Range Buttons** (Lines 241-245):
- Use `data-range` attribute
- Call `setSearchTimeRange(range)`

#### Template System Implementation (Lines 270-420)

**Flow**:

1. **`setupPresetTemplates()`** (Lines 270-283)
   - Finds all `[data-template]` buttons
   - Attaches `templateClickHandler`

2. **`templateClickHandler(e)`** (Lines 286-295)
   - Removes `active` class from all buttons
   - Adds `active` to clicked button
   - Calls `handleTemplateSelection()`

3. **`handleTemplateSelection(templateKey)`** (Lines 315-341)
   - If 'custom' → Show template manager
   - If has variables → `showVariableModal()`
   - Else → `applyTemplateDirectly()`

4. **`showVariableModal(template)`** (Lines 343-364)
   - Dynamically generates input fields
   - Shows modal for user input

5. **`applyTemplate()`** (Lines 366-412)
   - Collects variable values
   - Validates all required variables filled
   - Regex replace: `/\$\{${variable}\}/g`
   - Populates keywords textarea
   - Sets logic radio button

6. **`applyTemplateDirectly(template)`** (Lines 414-420)
   - No variable substitution needed
   - Direct keyword application

#### File Processing Pipeline (Lines 422-630)

**Entry Point**: `handleFileSelect(event)` (Lines 423-431)

**Step 1**: `addFileToList(file)` (Lines 433-451)
- Deduplicates by name+size
- Creates fileInfo object:
  ```javascript
  {
      file: File object,
      name: string,
      size: number,
      status: 'processing' | 'ready' | 'error',
      timeRange: { start: Date, end: Date } | null,
      subFiles: [{ name, size, timeRange, data }, ...]
  }
  ```

**Step 2**: `preprocessFile(file)` (Lines 453-483)
- Sets status to 'processing'
- Routes by extension:
  - `.tar` → `processTarFile()`
  - Other → `extractTimeRangeFromFile()`
- Updates overallTimeRange
- Sets status to 'ready' or 'error'

**Step 3a**: `processTarFile(file, fileInfo)` (Lines 486-540)
- Reads file as ArrayBuffer
- Creates SimpleTarReader instance
- Calls `extractFiles()`
- For each `.gz` or `.log` entry:
  - `extractTimeRangeFromTarEntry()` → Gets time range
  - Pushes to `fileInfo.subFiles`
  - Updates overall start/end times
- Sets `fileInfo.timeRange` to overall range

**Step 3b**: `extractTimeRangeFromFile(file)` (Lines 594-630)
- Handles `.gz` files:
  - Reads as ArrayBuffer
  - Tries `pako.inflate()` (standard gzip)
  - Fallback: Check for ZIP magic bytes (0x504B)
  - If ZIP: `extractFromZipBuffer()`
  - Else: Try `pako.ungzip()`
- Plain files: `file.text()`
- Calls `extractTimeRangeFromContent()`

**Helper**: `extractTimeRangeFromTarEntry(entry)` (Lines 543-591)
- Similar to `extractTimeRangeFromFile()` but works with buffer
- Handles `.gz` with same fallback logic
- Returns timeRange object

**Helper**: `extractFromZipBuffer(buffer)` (Lines 634-684)
- Uses JSZip library
- Loads buffer into JSZip instance
- Finds first non-directory file
- Tries `zipEntry.async('string')`
- Fallback: Read as `uint8array` + TextDecoder
- Returns decompressed content

**Helper**: `extractTimeRangeFromContent(content)` (Lines 687-716)
- Regex: `/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}/`
- Scans first 1000 lines for first timestamp
- Scans last 1000 lines for last timestamp
- Returns `{ start: Date, end: Date }`

**Display**: `updateFileListDisplay()` (Lines 718-761)
- Renders file list with status indicators
- Shows nested subFiles for TAR archives
- Displays time ranges
- Adds delete button event listeners

#### Overall Time Range Management (Lines 764-836)

**Function**: `updateOverallTimeRange()` (Lines 764-795)
- Combines time ranges from:
  - All local files (`fileList`)
  - Remote log data (`remoteLogData`)
- Finds min start and max end
- Auto-populates search date pickers

**Function**: `setSearchTimeRange(type)` (Lines 798-836)
- Quick range selection
- Types: 'all', 'last1h', 'last6h', 'last24h'
- Calculates from `overallTimeRange.end` backwards
- Clamps to file boundaries

#### Remote Log Fetching (Lines 847-1077)

**Main Function**: `fetchRemoteLogs()` (Lines 847-940)

**Phase 1: Validation** (Lines 848-856)
- Check server address, begin/end dates
- Show error if missing

**Phase 2: API Call** (Lines 863-917)
- Disable fetch button
- Show progress bar
- Get API token from storage
- **Prepare Request** (Lines 873-890):
  - POST to `/api/v4/system-logs/prepare`
  - Query string: `?date=&beginDate={iso}&endDate={iso}`
  - Response validation: `code === "0"`
  - Extract `filePath`
- **Download Request** (Lines 898-909):
  - GET from `/api/v4/system-logs/download/{filePath}`
  - Returns TAR archive as ArrayBuffer
- **Process TAR** (Line 917):
  - `processRemoteTarData()` → Parse and extract

**Phase 3: UI Update** (Lines 919-938)
- Update progress to 100%
- Update overall time range
- Save server address to localStorage
- Show summary: `showRemoteLogsSummary()`
- Display success message

**Error Handling** (Lines 931-933):
- Catch all errors
- Display error message to user

**Cleanup** (Lines 935-939):
- Re-enable fetch button
- Hide progress bar after 3 seconds

**Helper**: `showRemoteLogsSummary(logData, beginDate, endDate)` (Lines 943-1037)
- Creates/updates `#remoteLogsSummary` div
- Displays:
  - Requested time range
  - Actual log time range
  - Number of sub-files
  - Total size
  - File tree structure with icons
- Uses HTML formatting with emoji icons

**Helper**: `processRemoteTarData(arrayBuffer, fileName)` (Lines 1040-1077)
- Creates SimpleTarReader
- Extracts all entries
- For each `.gz` or `.log`:
  - Extract time range
  - Add to subFiles array
  - Update overall range
- Returns:
  ```javascript
  {
      fileName: string,
      timeRange: { start, end } | null,
      subFiles: [{ name, size, timeRange, data }, ...]
  }
  ```

#### Search Engine (Lines 1080-1605)

**Main Function**: `performSearch()` (Lines 1080-1203)

**Setup** (Lines 1081-1104):
- Check if search already running (prevent duplicate)
- Parse keywords from textarea
- Get logic (AND/OR) and date range
- Validate inputs (keywords, files loaded)
- Lock search with `isSearching = true`

**Initialization** (Lines 1106-1127):
- Disable search button
- Clear previous results
- Set result limit: 20,000
- Show loading UI with progress indicator

**Task Preparation** (Lines 1129-1162):
- Build task array from all sources:
  - **Local files**: Each file or subFile becomes a task
  - **Remote logs**: Each subFile becomes a task
- Task structure:
  ```javascript
  {
      type: 'file' | 'subFile' | 'preprocessed',
      data: File | { name, size, data: Uint8Array },
      source: string  // Display name
  }
  ```

**Execution** (Lines 1165-1178):
- Call `performMultiThreadSearch()` with:
  - Task list
  - Search params (keywords, logic, time range)
  - Max results
  - Callback for streaming results
- Callback receives results in batches:
  - Adds to `searchResults[]`
  - Calls `updateRealTimeResults()` for live display
  - Returns `true` to stop if limit reached

**Completion** (Lines 1181-1202):
- Remove progress indicator
- Call `displaySearchResults()` for final render
- Show completion message (with warning if limit hit)
- Unlock search
- Re-enable button

**Multi-Thread Simulation**: `performMultiThreadSearch()` (Lines 1206-1319)

**Note**: Named "multi-thread" but actually uses batched main-thread processing. Real Web Workers prepared but not implemented due to complexity of passing pako/JSZip instances.

**Algorithm** (Lines 1214-1255):
1. Split tasks into batches (one per "worker")
2. Process batches in parallel Promises
3. For each task in batch:
   - Preprocess (decompress if needed)
   - Process in main thread
   - Call result callback
   - Pause every 2 tasks (10ms) to keep UI responsive
4. Wait for all batches to complete

**Preprocess**: `preprocessTask(task)` (Lines 1259-1315)
- If `.gz` file:
  - Try `pako.inflate()`
  - Fallback to ZIP detection
  - Fallback to `pako.ungzip()`
  - Return preprocessed task with content string
- Else: Return task as-is

**Process**: `processTaskInMainThread(task, searchParams)` (Lines 1322-1434)

**Content Extraction** (Lines 1329-1390):
- Decompress based on task type:
  - `file` with `.gz`: pako inflate → ZIP fallback → ungzip
  - `subFile` with `.gz`: Same decompression logic
  - `preprocessed`: Already decompressed
  - Plain: TextDecoder or `file.text()`

**Log Parsing** (Lines 1393-1432):
- Timestamp regex: `/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}/`
- Split into lines
- Build multi-line log entries:
  - Line with timestamp → Start new log
  - Line without timestamp → Append to current log
- For each complete log:
  - Check match: `checkLogMatch()`
  - If match: Add to results
  - Limit: 20,000 per task
- Yield control every 1000 lines (0ms setTimeout)

**Match Logic**: `checkLogMatch(log, keywords, logic, beginTime, endTime)` (Lines 1437-1447)
```javascript
if (beginTime && log.timestamp < beginTime) return false;
if (endTime && log.timestamp > endTime) return false;

const content = log.content.toLowerCase();
const matches = keywords.map(kw => content.includes(kw.toLowerCase()));

return logic === 'and' ? matches.every(m => m) : matches.some(m => m);
```

**Real-Time Display**: `updateRealTimeResults()` (Lines 1450-1492)
- Updates result count
- Sorts by timestamp
- Renders last 100 results only (performance)
- Highlights keywords
- Adds mark buttons with event listeners
- Scrolls to bottom

**Final Display**: `displaySearchResults()` (Lines 1521-1581)
- Renders all results (no limit)
- Adds export button
- Highlights keywords
- Mark button handlers

**Export**: `exportSearchResults()` (Lines 1584-1604)
- Formats as plain text
- Each log: timestamp + content + separator
- Creates Blob and triggers download

**Utilities**:
- `highlightKeywords(content, keywords)` (Lines 1606-1613): Wraps matches in `<span class="highlight">`
- `escapeRegex(string)` (Lines 1615-1617): Escapes special regex characters
- `extractTimestamp(line)` (Lines 1515-1518): Parses timestamp to Date object

#### Workspace Management (Lines 1620-1767)

**Add to Workspace**: `markLog(index)` or `markLogById(log)` (Lines 1620-1639, 1495-1513)
- Check for duplicates by ID
- Add log to workspace with:
  ```javascript
  {
      ...log,           // timestamp, content, source, id
      markedAt: new Date(),
      tags: []
  }
  ```
- Call `saveWorkspace()` and `displayWorkspace()`

**Display**: `displayWorkspace()` (Lines 1641-1705)
- Sort by timestamp
- Render each item with:
  - Timestamp
  - Tag input box
  - Remove button
  - Tag badges (with remove icons)
  - Log content
- Event listeners for:
  - Tag input (Enter key)
  - Remove button
  - Tag remove button

**Tag Management**:
- `addTag(workspaceIndex, tagName)` (Lines 1707-1723)
  - Check for duplicates
  - Assign color from palette (round-robin)
  - Save and redisplay
- `removeTag(workspaceIndex, tagName)` (Lines 1725-1730)
  - Filter out tag
  - Save and redisplay

**Remove**: `removeFromWorkspace(index)` (Lines 1732-1736)
- Splice from array
- Save and redisplay

**Clear**: `clearWorkspace()` (Lines 1738-1745)
- Confirmation dialog
- Clear array
- Save and redisplay

**Export**: `exportWorkspace()` (Lines 1747-1767)
- Format: tags + timestamp + content + separator
- Plain text file download

**Persistence**:
- `saveWorkspace()` (Lines 1770-1781)
  - Convert Dates to ISO strings
  - Store in Chrome Storage API
- `loadWorkspace()` (Lines 1783-1797)
  - Read from Chrome Storage
  - Parse ISO strings back to Dates
  - Display

#### Template Management (Lines 1800-1904)

**Storage**: LocalStorage (not Chrome Storage)

**Get**: `getTemplates()` (Lines 1800-1802)
- Parse JSON from `localStorage.searchTemplates`
- Returns array

**Load**: `loadTemplates()` (Lines 1804-1822)
- Called on init
- If empty, populate defaults:
  - 路径规划结果 (Path planning results)
  - 订单分配 (Order assignment)

**Show Manager**: `showTemplateManager()` (Lines 1824-1863)
- Display modal
- Render template list
- Populate current keywords in save form
- Event listeners:
  - Click template → `loadTemplate(index)`
  - Click remove → `deleteTemplate(index)`

**Save**: `saveTemplate()` (Lines 1865-1882)
- Validate name and keywords
- Push to array
- Save to localStorage
- Refresh manager display

**Load**: `loadTemplate(index)` (Lines 1884-1894)
- Populate keywords textarea
- Set logic radio button
- Close modal
- Show success message

**Delete**: `deleteTemplate(index)` (Lines 1896-1904)
- Confirmation dialog
- Splice from array
- Save to localStorage
- Refresh manager

#### Settings (Lines 1907-1930)

**Show**: `showSettings()` (Lines 1907-1909)
- Display settings modal

**Save**: `saveSettings()` (Lines 1911-1918)
- Get API token from input
- Store in Chrome Storage
- Close modal

**Load**: `loadSettings()` (Lines 1920-1930)
- Get token from Chrome Storage
- Populate input field
- Get last server from localStorage
- Populate server input

#### Storage Wrappers (Lines 1938-1950)

**Get**: `getStorageValue(key)` (Lines 1938-1944)
```javascript
return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
    });
});
```

**Set**: `setStorageValue(key, value)` (Lines 1946-1950)
```javascript
return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
});
```

#### Utility Functions (Lines 1952-2001)

1. **`formatDateForInput(date)`** (Lines 1953-1960)
   - Converts Date to `YYYY-MM-DDTHH:mm` format
   - For `<input type="datetime-local">`

2. **`formatFileSize(bytes)`** (Lines 1962-1968)
   - Human-readable sizes
   - Units: Bytes, KB, MB, GB

3. **`getStatusText(status)`** (Lines 1970-1977)
   - Chinese status labels
   - Maps: processing/ready/error → display text

4. **`showStatusMessage(message, type)`** (Lines 1979-1985)
   - Displays temporary message in `#searchStatus`
   - Types: success/error/info/warning
   - Auto-hides after 5 seconds

5. **`clearSearch()`** (Lines 1987-1993)
   - Clear keywords
   - Remove active template
   - Clear results
   - Show info message

6. **Cleanup** (Lines 1996-2001)
   - `window.beforeunload` listener
   - Clears in-memory data
   - Note: Chrome Storage persists

## Data Structures

### File Info Object
```javascript
{
    file: File,              // Original File object
    name: string,            // File name
    size: number,            // Bytes
    status: string,          // 'processing' | 'ready' | 'error'
    timeRange: {
        start: Date,
        end: Date
    } | null,
    subFiles: [              // For TAR archives
        {
            name: string,
            size: number,
            timeRange: { start: Date, end: Date },
            data: Uint8Array // Raw file data
        }
    ]
}
```

### Log Entry Object
```javascript
{
    timestamp: Date,
    content: string,         // Multi-line log entry
    source: string,          // File name
    id: string              // Unique: `${source}-${timestamp}-${random}`
}
```

### Workspace Item
```javascript
{
    ...logEntry,             // All log properties
    markedAt: Date,          // When marked
    tags: [
        {
            name: string,
            color: string    // Hex color
        }
    ]
}
```

### Template Object
```javascript
{
    name: string,
    keywords: string[],      // Can contain ${variable} placeholders
    logic: 'and' | 'or',
    variables?: string[]     // Optional, for preset templates
}
```

## Performance Characteristics

### Time Complexity

- **File Upload**: O(n) where n = file size (preprocessing scans first/last 1000 lines)
- **TAR Extraction**: O(m) where m = archive size (linear scan)
- **Search**: O(k * l) where k = number of files, l = average file size
  - With batching: Amortized over multiple event loop cycles
- **Display**: O(r) where r = number of results (limited to 20,000)

### Space Complexity

- **File Storage**: O(f) where f = total uploaded file size (in-memory)
- **Search Results**: O(r) where r = number of results
- **Workspace**: O(w) where w = number of marked logs
- **Chrome Storage**: Limited to 5MB (workspace only)

### Bottlenecks

1. **Large TAR Files**: Loading 500MB+ TAR into memory
   - **Solution**: Stream processing (not implemented)

2. **Search on Large Datasets**: Scanning gigabytes of logs
   - **Solution**: IndexedDB with full-text index (not implemented)
   - **Current Mitigation**: 20,000 result limit, batched processing

3. **Result Rendering**: DOM manipulation for thousands of items
   - **Solution**: Virtual scrolling (not implemented)
   - **Current Mitigation**: Real-time display limited to 100 items

4. **Gzip Decompression**: CPU-intensive
   - **Solution**: Web Workers (prepared but not used)
   - **Current Mitigation**: Async/await with periodic yields

## Error Handling Patterns

### Try-Catch Blocks
- All async functions wrapped in try-catch
- Errors displayed to user via `showStatusMessage()`
- Console logging for debugging

### Graceful Degradation
- If TAR parsing fails, skip file
- If time range extraction fails, show warning but continue
- If decompression fails, try fallback methods

### User Feedback
- Status messages for all operations
- Progress bars for long operations
- Loading indicators during search

## Security Considerations

### XSS Prevention
- **Issue**: User log content displayed as HTML
- **Mitigation**:
  - Content inserted as text, not HTML (except highlights)
  - Highlight uses controlled `<span>` tags only
  - No `innerHTML` for user content

### Token Storage
- **Issue**: Hardcoded default token in source
- **Risk**: HIGH - exposed in extension code
- **Recommendation**: Remove default, require user input

### CORS Bypass
- **Mechanism**: Background script fetches
- **Permissions**: Unrestricted host_permissions
- **Risk**: Extension can access any HTTP endpoint
- **Mitigation**: Only used for configured server address

### Content Security Policy
- **Policy**: `script-src 'self'; object-src 'self'`
- **Effect**: No inline scripts, no external script loading
- **Compliance**: All JS in external files

## Testing Considerations

### Unit Test Targets
1. `SimpleTarReader.extractFiles()` - TAR parsing
2. `extractTimeRangeFromContent()` - Timestamp extraction
3. `checkLogMatch()` - Search logic
4. `formatFileSize()` - Size formatting
5. Template variable substitution

### Integration Test Scenarios
1. Upload TAR file → Extract → Search → Export
2. Fetch remote logs → Search → Mark → Tag → Export workspace
3. Apply template → Substitute variables → Search
4. Edge cases:
   - Empty files
   - Files without timestamps
   - Corrupted TAR headers
   - Network failures during fetch

### Manual Test Checklist
- [ ] Upload .log file
- [ ] Upload .gz file
- [ ] Upload .tar file
- [ ] Upload .tar with .gz subfiles
- [ ] Drag & drop upload
- [ ] Fetch remote logs with valid credentials
- [ ] Search with AND logic
- [ ] Search with OR logic
- [ ] Search with time range filter
- [ ] Mark logs to workspace
- [ ] Add tags to workspace items
- [ ] Export workspace
- [ ] Export search results
- [ ] Save custom template
- [ ] Load template
- [ ] Apply preset template with variables
- [ ] Clear search
- [ ] Clear workspace
- [ ] Settings persistence across sessions

## Development Setup

### Prerequisites
- Chrome browser (version 88+)
- Text editor (VS Code recommended)
- Basic understanding of Chrome Extension APIs

### Installation
1. Clone repository
2. Open Chrome → Extensions → Developer Mode
3. Load Unpacked → Select project directory
4. Click extension icon to launch

### Development Workflow
1. Make code changes
2. Click "Reload" in Chrome Extensions page
3. Re-open extension to test
4. Check console for errors (F12 in extension tab)

### Debugging
- **Main UI**: F12 in extension tab
- **Background Script**: Extensions page → Inspect views: service worker
- **Storage**: Chrome DevTools → Application → Storage

## Deployment Checklist

### Code Changes
- [ ] Remove hardcoded Bearer token
- [ ] Add proper error messages (currently some in Chinese)
- [ ] Minify JavaScript files
- [ ] Compress image assets (if any)
- [ ] Update version in manifest.json

### Testing
- [ ] Test on clean Chrome profile
- [ ] Test with no prior data
- [ ] Test with maximum file sizes
- [ ] Test offline behavior
- [ ] Test on different screen sizes

### Chrome Web Store
- [ ] Prepare screenshots
- [ ] Write store description
- [ ] Set privacy policy
- [ ] Set pricing (free/paid)
- [ ] Submit for review

## Known Issues

1. **Hardcoded Token**: Default Bearer token in source code (lines background.js:27, 48, main.js:878, 903)
2. **No Pagination**: All results rendered at once (can freeze on 20k results)
3. **No Progress for TAR**: TAR extraction has no progress indicator
4. **Chinese UI**: All labels in Chinese (no i18n)
5. **Memory Leak**: Large files not released until tab closed
6. **No Cancellation**: Cannot cancel in-progress search
7. **Timezone Assumptions**: All dates assume local timezone

## Future Enhancements

### High Priority
1. Remove hardcoded credentials
2. Add result pagination/virtual scrolling
3. Implement true Web Worker search
4. Add search cancellation

### Medium Priority
1. IndexedDB for large datasets
2. Streaming TAR parser
3. Regex keyword support
4. Chart visualization (time-series graphs)
5. Multi-language support (i18n)

### Low Priority
1. Dark mode
2. Custom color themes
3. Keyboard shortcuts
4. Search history
5. Collaborative workspace sharing

## Useful Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [TAR Format Specification](https://www.gnu.org/software/tar/manual/html_node/Standard.html)
- [pako Documentation](https://github.com/nodeca/pako)
- [JSZip Documentation](https://stuk.github.io/jszip/)
