import { Moon, Sun } from 'lucide-react';

export const GRID_THEME = {
  // Main Layout Containers
  main: "flex h-screen bg-background text-foreground transform-gpu",
  rail: "w-12 bg-card flex flex-col items-center py-4 gap-4 z-[60] border-r border-border",
  drawer: "bg-card flex flex-col shadow-sm transition-[width,padding,opacity,transform] duration-300 ease-in-out overflow-hidden whitespace-nowrap border-r border-border transform-gpu will-change-[width,padding,opacity,transform]",
  editorContainer: "flex flex-col flex-1 min-h-0 overflow-hidden",
  
  // Grid Editor Components
  editor: "flex flex-col h-full overflow-hidden bg-card",
  toolbar: "flex items-center justify-between py-1.5 px-2 bg-background border-b border-border gap-2 overflow-x-auto no-scrollbar whitespace-nowrap",
  formulaBar: "flex items-start gap-2 py-1 px-1.5 bg-card border-b border-border shadow-inner z-20",
  statusBar: "h-7 bg-background border-t border-border flex items-center justify-between px-3 text-[10px] font-bold text-muted uppercase tracking-wider shrink-0 select-none",
  navContainer: "flex bg-muted/10 p-0.5 rounded-md border border-border",
  
  // Table Specific Styles
  tableHeader: "bg-muted/10 shadow-[0_1px_0_var(--color-border)]",
  tableHeaderRow: "bg-muted/20 select-none h-5",
  tableIndexCell: "border-r border-b border-border",
  tableCell: "p-0 border-r border-b border-border bg-card group/cell relative align-middle",
  tableBodyRow: "hover:bg-muted/5 group relative",

  // Inputs and Interactive
  tableInput: "grid-input w-full px-2 py-0.5 text-sm text-foreground bg-transparent border-0 outline-none dark:bg-card whitespace-pre-wrap break-words",
};

export const FONT_FAMILIES = [
  { id: 'sans', label: 'Inter (Default)', value: 'var(--font-geist-sans), ui-sans-serif, system-ui' },
  { id: 'roboto', label: 'Roboto', value: '"Roboto", sans-serif' },
  { id: 'opensans', label: 'Open Sans', value: '"Open Sans", sans-serif' },
  { id: 'serif', label: 'System Serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { id: 'mono', label: 'System Mono', value: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  { id: 'montserrat', label: 'Montserrat', value: '"Montserrat", sans-serif' },
];

export const DATE_FORMATS = [
  { id: 'long', label: 'Monday, May 5, 2026' },
  { id: 'medium', label: 'May 5, 2026' },
  { id: 'short', label: '05/05/2026' },
  { id: 'iso', label: '2026-05-05' },
];

export const NUMBER_FORMATS = [
  { id: 'decimal', label: 'Decimal (1,234.56)' },
  { id: 'currency', label: 'Currency (₱1,234.56)' },
  { id: 'percent', label: 'Percent (12.34%)' },
  { id: 'integer', label: 'Integer (1,235)' },
];

export const LOCATIONS = [
  "Antonino, Labason, Zamboanga del Norte", "Balas, Labason, Zamboanga del Norte",
  "Bobongan, Labason, Zamboanga del Norte", "Dansalan, Labason, Zamboanga del Norte",
  "Gabu, Labason, Zamboanga del Norte", "Gil Sanchez, Labason, Zamboanga del Norte",
  "Imelda, Labason, Zamboanga del Norte", "Immaculada, Labason, Zamboanga del Norte",
  "Kipit, Labason, Zamboanga del Norte", "La Union, Labason, Zamboanga del Norte",
  "Lapatan, Labason, Zamboanga del Norte", "Lawagan, Labason, Zamboanga del Norte",
  "Lawigan, Labason, Zamboanga del Norte", "Lopoc, Labason, Zamboanga del Norte",
  "Malintuboan, Labason, Zamboanga del Norte", "New Salvacion, Labason, Zamboanga del Norte",
  "Osukan, Labason, Zamboanga del Norte", "Poblacion, Labason, Zamboanga del Norte",
  "Patawag, Labason, Zamboanga del Norte", "San Isidro, Labason, Zamboanga del Norte",
  "Ubay, Labason, Zamboanga del Norte"
];

export const ALLOCATIONS = ["20%", "DepEd", "DA"];
