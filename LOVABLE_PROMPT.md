# Lovable Prompt: AI Yearbook Generator Frontend

Build a modern, professional React frontend for an AI-powered yearbook page generator. This connects to an existing Node.js/Express backend deployed at Railway.

## Project Overview

Create a web application that allows yearbook staff to upload photos and content, then generate print-ready yearbook pages (8" x 10.5" single pages or 16" x 10.5" spreads) using AI-powered layouts.

## Backend API

The backend is already deployed. Connect to it via environment variable `VITE_API_URL` (default: `https://yearbook-ai-generator-production.up.railway.app`).

### Endpoints:

1. **GET /api/themes** - Returns available preset themes
2. **POST /api/extract-theme** - Upload an image to extract its visual theme
3. **POST /api/generate-spread** - Generate a yearbook page/spread (returns PDF or PNG)
4. **POST /api/preview-layout** - Get layout JSON without rendering

---

## Core Features

### 1. Page Type Selection
- **Single Page** (8" x 10.5") - for individual pages
- **Double-Page Spread** (16" x 10.5") - for facing pages

### 2. Page Category Selection
Auto-detected from content, but allow manual override:
- **Sports** - Teams, games, seasons (soccer, basketball, football, etc.)
- **Events** - Dances, prom, homecoming, assemblies, pep rallies
- **Clubs & Organizations** - Robotics, drama, choir, band, NHS, student council
- **Academics** - Classroom moments, subjects, teachers, academic achievements
- **People** - Senior portraits, faculty, superlatives, candids
- **Student Life** - Campus life, lunch, hallways, spirit week, everyday moments

### 3. Photo Upload
- Drag & drop zone for multiple photos (1-15 photos)
- Show thumbnails with remove button
- Reorder capability (drag to reorder)
- For each photo, allow adding:
  - Caption text
  - People in photo
  - Mark as "primary/hero" photo

### 4. Page Content Form

Dynamic form based on page category, with these fields:

#### Universal Fields (all categories):
- **Section Name** (required) - e.g., "Varsity Soccer", "Fall Formal", "Robotics Club"
- **School Name/Abbreviation** - e.g., "DCHS", "Lincoln High"
- **Headline** - Main page headline
- **Subheadline** - Optional secondary headline
- **Date or Year** - e.g., "2024", "October 15, 2024"
- **Body Copy** - Main descriptive text (textarea, supports multiple paragraphs)
- **Folio** - Page numbers (e.g., "42-43")

#### Sports-Specific Fields:
- **Record** - Season record (e.g., "12-5-1", "State Champions")
- **Roster** - Team roster (comma-separated or line-by-line entry)
- **Roster Title** - Default "Team Roster:", customizable
- **Highlights** - Season highlights/achievements (list)

#### Events-Specific Fields:
- **Theme** - Event theme (e.g., "Enchanted Forest")
- **Date** - Event date
- **Quotes** - Array of quotes with attribution
- **Highlights** - Event highlights (list)

#### Clubs-Specific Fields:
- **Members Count** - e.g., "24 Members"
- **Roster** - Member names
- **Roster Title** - Default "Members:", customizable
- **Highlights** - Club achievements/activities (list)

#### Academics-Specific Fields:
- **Subject/Department** - e.g., "Science Department", "AP History"
- **Quotes** - Student/teacher quotes

#### People-Specific Fields:
- **Senior Class** - e.g., "Class of 2024"
- **Superlative Category** - if applicable

### 5. Theme Selection

Three options:
1. **Preset Themes** - Dropdown of available themes from `/api/themes`
2. **Extract from Image** - Upload a sample yearbook page to extract its style
3. **Custom Theme** - Advanced JSON editor for power users

### 6. Quotes Manager
- Add multiple quotes with:
  - Quote text
  - Attribution (who said it)
- Drag to reorder
- Remove button

### 7. Output Options
- **Format**: PDF (default) or PNG
- **Download** button - generates and downloads the file

---

## UI/UX Requirements

### Layout
- Clean, modern design (think Canva or Figma)
- Left sidebar: Photo uploads + thumbnails
- Center: Live preview area (show layout preview if available)
- Right sidebar: Content form with collapsible sections

### Preview
- After photos are uploaded and minimal content added, show a loading preview
- Call `/api/preview-layout` to get layout JSON
- Render a simplified preview showing photo placement

### Responsive
- Desktop-first (yearbook staff typically use computers)
- Tablet-friendly for photo selection

### Loading States
- Show progress during generation (can take 10-30 seconds)
- "Generating your yearbook page..." with spinner
- Show estimated time remaining if possible

---

## Form Field Details

```typescript
interface PageContent {
  // Universal
  section: string;           // "Varsity Basketball"
  pageCategory?: string;     // "sports" | "events" | "clubs" | "academics" | "people" | "student-life"
  schoolName?: string;       // "DCHS"
  headline?: string;         // "UNSTOPPABLE SEASON"
  subheadline?: string;      // "Team rises to state championship"
  dateOrYear?: string;       // "2024" or "March 15, 2024"
  bodyCopy?: string;         // Main body text (multi-paragraph)
  folio?: string;            // "42-43"

  // Sports/Clubs
  record?: string;           // "18-4" or "24 Members"
  roster?: string[];         // ["John Smith", "Jane Doe", ...]
  rosterTitle?: string;      // "Team Roster:" or "Members:" or "Cast:"

  // Any category
  highlights?: string[];     // ["State Champions", "Undefeated at home"]
  quotes?: Quote[];          // [{text: "...", attribution: "Coach Smith"}]

  // Photo info
  photoCaptions?: PhotoCaption[];
}

interface Quote {
  text: string;
  attribution: string;
}

interface PhotoCaption {
  photoIndex: number;
  caption: string;
  people?: string;
  isPrimary?: boolean;
}
```

---

## API Integration

### Generate Spread Request

```javascript
const formData = new FormData();

// Add photos
photos.forEach((photo, index) => {
  formData.append('photos', photo.file);
});

// Add configuration
formData.append('pageType', 'spread'); // or 'page'
formData.append('format', 'pdf'); // or 'png'
formData.append('theme', 'modern'); // or JSON string

// Add content as JSON
formData.append('pageContent', JSON.stringify({
  section: 'Varsity Soccer',
  pageCategory: 'sports',
  schoolName: 'DCHS',
  headline: 'KICKING TO VICTORY',
  record: '15-3-2',
  roster: ['Player 1', 'Player 2', ...],
  rosterTitle: 'Team Roster:',
  bodyCopy: 'The 2024 season was one for the record books...',
  quotes: [
    { text: 'Best team I ever coached', attribution: 'Coach Johnson' }
  ],
  highlights: ['District Champions', 'Undefeated at home'],
  photoCaptions: [
    { photoIndex: 0, caption: 'Goal celebration', people: 'Jake scoring', isPrimary: true }
  ],
  folio: '42-43'
}));

const response = await fetch(`${API_URL}/api/generate-spread`, {
  method: 'POST',
  body: formData
});

// Response is the PDF/PNG file blob
const blob = await response.blob();
downloadFile(blob, 'yearbook-page.pdf');
```

---

## Component Structure Suggestion

```
src/
  components/
    PhotoUploader/
      PhotoUploader.tsx      # Drag & drop zone
      PhotoThumbnail.tsx     # Individual photo with caption form
      PhotoList.tsx          # Sortable list of thumbnails

    ContentForm/
      ContentForm.tsx        # Main form container
      UniversalFields.tsx    # Section, headline, body copy, etc.
      SportsFields.tsx       # Record, roster
      EventsFields.tsx       # Theme, date
      ClubsFields.tsx        # Members
      QuotesManager.tsx      # Add/remove quotes
      HighlightsManager.tsx  # Add/remove highlights
      RosterEditor.tsx       # Multi-line or comma-separated roster

    ThemeSelector/
      ThemeSelector.tsx      # Theme mode tabs
      ThemeDropdown.tsx      # Preset selection
      ThemeExtractor.tsx     # Image upload for extraction
      ThemeEditor.tsx        # JSON editor

    Preview/
      PreviewPane.tsx        # Shows layout preview
      LayoutRenderer.tsx     # Renders layout JSON to visual

    Output/
      GenerateButton.tsx     # Main action button
      FormatSelector.tsx     # PDF/PNG toggle
      DownloadProgress.tsx   # Progress indicator

  pages/
    GeneratorPage.tsx        # Main page combining all components

  hooks/
    useApi.ts               # API calls
    usePhotos.ts            # Photo state management

  types/
    index.ts                # TypeScript interfaces
```

---

## Styling

Use Tailwind CSS or similar utility framework. Color scheme:
- Primary: Deep blue (#1e3a5f) - professional yearbook feel
- Accent: Gold/amber (#d4a84b) - traditional yearbook accent
- Background: Light gray (#f5f5f5)
- Cards: White with subtle shadow

---

## Additional Features (Nice to Have)

1. **Save Draft** - Save work in progress to localStorage
2. **Template Gallery** - Show example layouts for inspiration
3. **Batch Generation** - Generate multiple pages in sequence
4. **History** - Show recently generated pages
5. **Collaboration** - Share link for team review (future)

---

## Environment Variables

```env
VITE_API_URL=https://yearbook-ai-generator-production.up.railway.app
```

---

## Getting Started

1. Create the React app with Vite + TypeScript
2. Install dependencies: react-dropzone, react-beautiful-dnd (or dnd-kit), tailwindcss
3. Set up API integration
4. Build photo upload flow first
5. Add content form
6. Add theme selection
7. Implement generation with progress indicator

Focus on making the photo upload and content entry as smooth as possible - yearbook staff will use this repeatedly throughout the year.
