# MEO Data Entry - LGU Labason

A professional data management system featuring an Excel-inspired interface, Supabase Storage integration for media attachments, and a specialized printable report engine.

## Key Features
- **Excel-Style Editor**: Real-time grid editing with standard spreadsheet behavior.
- **Contextual Column Management**: Right-click headers to insert, hide, or delete columns and set alignments.
- **Formula Engine**: Support for arithmetic and date calculations (e.g., `=SUM`, `=ADD_DAYS`).
- **Supabase Storage**: Secure cloud storage for images and document attachments.
- **Print-Ready Reports**: Landscape-optimized professional summaries with subtotal logic.
- **File Explorer**: Recursive tree-based organization for project nodes.

## Tech Stack
- **Frontend**: Next.js (App Router), Tailwind CSS, Lucide React
- **Backend/Storage**: Supabase (Postgres & Storage Buckets)
- **Deployment**: Vercel

## Getting Started
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Setup your `.env` file with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Start the development server: `npm run dev`.

## License
MIT