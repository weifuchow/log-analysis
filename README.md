# 智能日志分析工具 (Intelligent Log Analysis Tool)

A Chrome browser extension for analyzing log files from industrial automation systems with support for local file upload, remote API fetching, advanced search, and workspace management.

## Project Overview

This extension provides a powerful interface for analyzing log files from warehouse/factory automation systems. It supports multiple log formats, advanced filtering, and collaborative analysis features.

## File Structure

```
log-analysis/
├── manifest.json          # Chrome extension configuration
├── background.js          # Service worker for extension lifecycle
├── main.html             # Main UI application page
├── main.js               # Core application logic (2000+ lines)
├── libs/                 # External libraries
│   ├── pako.min.js      # gzip compression/decompression
│   ├── jszip.min.js     # ZIP file handling
│   ├── tar.js           # TAR archive parsing (full version)
│   ├── tar.min.js       # TAR archive parsing (minified)
│   ├── header.js        # Library headers/utilities
│   └── utils.js         # Utility functions
└── README.md            # This file
```

## Core Files Description

### 1. manifest.json
**Purpose**: Chrome Extension Manifest V3 configuration file

**Key Components**:
- Extension metadata (name, version, description)
- Permissions: storage, activeTab, downloads, background, tabs
- Host permissions for HTTP/HTTPS requests
- Service worker configuration
- Content security policy

**Lines**: 32

---

### 2. background.js
**Purpose**: Service worker handling extension lifecycle and cross-origin requests

**Key Components**:
- Extension icon click handler (opens main.html)
- Message listener for remote log fetching
- Background fetch operations for CORS bypass
- Remote API integration for log retrieval

**Key Functions**:
- `chrome.action.onClicked`: Opens the main application
- `fetchRemoteLogsFromBackground()`: Fetches logs from remote servers

**Lines**: 67

---

### 3. main.html
**Purpose**: Main application UI with three-panel layout

**Structure**:
1. **Header Section** (lines 820-826)
   - Title and branding
   - Settings and template management buttons

2. **Left Panel** (lines 830-926) - Data Source & Search
   - Preset templates grid
   - Local file upload area (drag & drop support)
   - Remote API configuration
   - Search filters (keywords, time range, logic)

3. **Center Panel** (lines 929-940) - Search Results
   - Real-time result display
   - Result count indicator
   - Log item cards with marking capability

4. **Right Panel** (lines 943-958) - Workspace
   - Marked logs collection
   - Tag management
   - Export functionality

5. **Modals** (lines 961-1021)
   - Variable replacement modal
   - Settings modal
   - Template manager modal

**Styling**: Comprehensive CSS (lines 7-817)
- Modern responsive design
- Three-column grid layout
- Custom scrollbars
- Loading animations
- Tag and badge styling

**Lines**: 1027

---

### 4. main.js
**Purpose**: Core application logic and business operations

**Major Sections**:

#### Global State (lines 1-10)
- `fileList[]`: Uploaded files tracking
- `remoteLogData`: Remote log storage
- `searchResults[]`: Current search matches
- `workspace[]`: Marked logs for analysis
- `overallTimeRange`: Combined time range from all sources

#### Preset Templates (lines 11-83)
Predefined search patterns for:
- Device communication
- Status request queue
- Order assignment
- Vehicle path planning
- Traffic control (resource allocation/release)
- Order lifecycle
- Elevator state monitoring

#### File Processing (lines 422-630)
- **TAR Archive Parser** (lines 86-165): Custom implementation
  - Header parsing
  - File extraction
  - Multi-format support
- **File Handlers**:
  - `handleFileSelect()`: User file upload
  - `preprocessFile()`: Extract time ranges
  - `processTarFile()`: TAR archive processing
  - `extractFromZipBuffer()`: ZIP/deflate handling
  - `extractTimeRangeFromContent()`: Timestamp extraction

#### Remote Log Fetching (lines 847-1077)
- Two-phase API process:
  1. Prepare logs (POST request)
  2. Download TAR archive
- Progress tracking and UI updates
- TAR processing and time range extraction
- Summary display generation

#### Search Engine (lines 1080-1581)
- **Multi-threaded Search** (lines 1206-1434)
  - Batch processing for performance
  - Real-time result streaming
  - 20,000 result limit
- **Search Logic**:
  - AND/OR keyword matching
  - Time range filtering
  - Source file tracking
- **Result Display**:
  - Real-time updates during search
  - Keyword highlighting
  - Sortable results

#### Workspace Management (lines 1620-1767)
- Mark logs for detailed analysis
- Tag system with color coding
- Export marked logs to text file
- Persistent storage via Chrome Storage API

#### Template System (lines 1800-1904)
- Save custom search templates
- Load/apply templates
- Variable substitution for reusable patterns
- CRUD operations for templates

#### Settings & Storage (lines 1907-1950)
- API token management
- Chrome Storage API integration
- Server address persistence
- Workspace persistence

#### Utility Functions (lines 1952-2001)
- Date formatting for HTML inputs
- File size formatting
- Status message display
- Search clearing
- Resource cleanup on page unload

**Lines**: 2001

---

## Key Features

### 1. File Format Support
- **Plain text**: .log, .txt
- **Compressed**: .gz (gzip)
- **Archives**: .tar (with nested .gz files)
- **Hybrid**: .tar.gz archives with multiple log files

### 2. Data Sources
- **Local Upload**: Drag & drop or file picker
- **Remote API**: RESTful API integration
  - Endpoint: `/api/v4/system-logs/prepare`
  - Endpoint: `/api/v4/system-logs/download/{filePath}`
  - Bearer token authentication

### 3. Search Capabilities
- **Keyword Search**: Multi-keyword with AND/OR logic
- **Time Filtering**: Precise datetime range selection
- **Quick Ranges**: Last 1h, 6h, 24h, all time
- **Result Highlighting**: Visual keyword emphasis
- **Real-time Display**: Streaming results during search

### 4. Preset Templates
Domain-specific templates for industrial automation:
- Device communication monitoring
- Order assignment tracking
- Vehicle path planning analysis
- Traffic control resource management
- Order lifecycle tracking
- Elevator state monitoring

### 5. Workspace Features
- Mark important logs for collaboration
- Multi-tag system with color coding
- Export workspace to text file
- Persistent storage across sessions

## Technical Architecture

### Data Flow

```
┌─────────────────┐
│  File Upload    │
│  or Remote API  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Preprocessing  │
│  - TAR extract  │
│  - gzip decomp  │
│  - Time range   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Search Engine  │
│  - Keyword scan │
│  - Time filter  │
│  - Result limit │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Display/Export │
│  - Results view │
│  - Workspace    │
│  - File export  │
└─────────────────┘
```

### Performance Optimizations

1. **Batched Processing**: Files processed in batches to prevent UI blocking
2. **Real-time Streaming**: Results displayed as they're found
3. **Result Limiting**: 20,000 result cap to prevent memory issues
4. **Lazy Rendering**: Only render visible results initially
5. **Web Workers**: (Prepared but using main thread for compatibility)

### Storage Architecture

- **Chrome Storage API**: Workspace and settings
- **LocalStorage**: Search templates and last server address
- **In-Memory**: File buffers and search results (cleared on close)

## API Integration

### Remote Log Fetching

**Phase 1: Prepare**
```http
POST http://{serverAddress}/api/v4/system-logs/prepare?beginDate={iso8601}&endDate={iso8601}
Authorization: Bearer {token}
```

**Phase 2: Download**
```http
GET http://{serverAddress}/api/v4/system-logs/download/{filePath}
Authorization: Bearer {token}
```

Returns: TAR archive containing multiple .gz compressed log files

## Dependencies

### External Libraries

1. **pako** (CDN: libs/pako.min.js)
   - Purpose: gzip compression/decompression
   - Used in: File preprocessing, TAR entry extraction

2. **JSZip** (CDN: libs/jszip.min.js)
   - Purpose: ZIP file handling (deflate format)
   - Used in: Fallback for .gz files using ZIP compression

3. **Custom TAR Parser** (libs/tar.js)
   - Purpose: TAR archive extraction
   - Implementation: SimpleTarReader class (lines 86-165 in main.js)

## Usage Patterns

### Typical Workflow

1. **Load Data**
   - Upload local .tar file OR
   - Fetch from remote server with time range

2. **Apply Template**
   - Select preset template (e.g., "Vehicle Path Planning")
   - Fill in variables (e.g., vehicle name)

3. **Search**
   - Auto-populated keywords from template
   - Adjust time range if needed
   - Execute search

4. **Analyze**
   - Browse results with highlighted keywords
   - Mark important logs to workspace
   - Add tags for categorization

5. **Export**
   - Export search results OR
   - Export workspace with tags

## Browser Compatibility

- **Required**: Chrome/Chromium-based browsers
- **Manifest Version**: V3 (modern extension format)
- **Minimum Chrome Version**: 88+ (Manifest V3 support)

## Security Considerations

1. **CORS Bypass**: Background script handles cross-origin requests
2. **Token Storage**: Chrome Storage API (encrypted at rest)
3. **Default Token**: Hardcoded fallback token (should be removed in production)
4. **Host Permissions**: Requires permission for HTTP/HTTPS domains

## Known Limitations

1. **Result Limit**: Maximum 20,000 search results
2. **Memory**: Large TAR files (>500MB) may cause performance issues
3. **Browser Only**: No standalone version available
4. **Timezone**: All timestamps displayed in local browser timezone

## Development Notes

### Code Organization

- **Separation of Concerns**: UI (HTML/CSS) separated from logic (JS)
- **Event-Driven**: Heavy use of event listeners for user interactions
- **Async/Await**: Modern async patterns throughout
- **Error Handling**: Try-catch blocks with user-friendly error messages

### Future Enhancements

1. True Web Worker implementation for search
2. IndexedDB for larger dataset support
3. Chart visualization for time-series analysis
4. Regex support in keyword search
5. Multi-language support (currently Chinese UI)

## License

[License information not specified in source files]

## Contributing

[Contribution guidelines not specified in source files]
