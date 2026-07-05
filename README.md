# MEO Data Entry - LGU Labason

A professional data management system featuring an Excel-inspired interface, robust offline storage and synchronization, Supabase cloud storage, and a desktop shell with automatic updates.

## Key Features

- **Excel-Style Editor**: Real-time grid editing with standard spreadsheet behavior.
- **Contextual Column Management**: Right-click headers to insert, hide, or delete columns, and customize cell alignments.
- **Formula Engine**: Support for arithmetic and date calculations (e.g., `=SUM`, `=ADD_DAYS`).
- **Offline Storage & Sync Engine**:
  - Powered by **Dexie.js (IndexedDB)** for local state persistence.
  - Transactions queued offline in `sync_queue` and synchronized automatically when connection is restored.
  - Conflict resolution using update timestamps and revision tokens.
  - Local caching of media and document attachments for offline viewing.
- **Desktop Application Shell**:
  - Packaged as a native desktop application using **Electron**.
  - Secure offline assets routing using a custom `app` protocol (`app://local`).
  - Auto-updating via **electron-updater** tied to GitHub Releases.
  - In-app update check and download modal with visual progress bar syncing with dark/light themes.
- **Print-Ready Reports**: Landscape-optimized professional summaries with subtotal logic.
- **File Explorer**: Recursive tree-based organization for projects, folders, and files.

## Tech Stack

- **Frontend**: Next.js (App Router), Tailwind CSS (v4), Dexie.js, Lucide React
- **Desktop Shell**: Electron, electron-builder, electron-updater
- **Backend/Storage**: Supabase (PostgreSQL & Storage Buckets)

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/meo-mcbryle/meo-data-entry.git
   cd meo-data-entry
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables in `.env` or `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### Running the Application

- **Web Development Server**:
  ```bash
  npm run dev
  ```
- **Electron (Desktop) Development Mode**:
  ```bash
  npm run electron:dev
  ```
- **Build and Package the Desktop Installer**:
  ```bash
  npm run electron:build
  ```
  This creates a Windows executable installer (NSIS target) in the `dist` folder.

## License
MIT