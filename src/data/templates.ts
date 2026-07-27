export interface FaceTemplate {
  id: string;
  name: string;
  description: string;
  dataUrl: string;
  category: string;
}

export const FACE_TEMPLATES: FaceTemplate[] = [
  {
    id: "template-1",
    name: "Minimal Clock",
    description: "Simple analog clock face",
    category: "Time",
    dataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 480'%3E%3Ccircle cx='240' cy='240' r='230' fill='%231e293b'/%3E%3Ccircle cx='240' cy='240' r='200' fill='none' stroke='%233b82f6' stroke-width='4'/%3E%3Cline x1='240' y1='240' x2='240' y2='80' stroke='%23ffffff' stroke-width='4'/%3E%3Cline x1='240' y1='240' x2='340' y2='240' stroke='%23ffffff' stroke-width='3'/%3E%3Ccircle cx='240' cy='240' r='10' fill='%23ef4444'/%3E%3C/svg%3E",
  },
  {
    id: "template-2", 
    name: "Digital Display",
    description: "Modern digital time display",
    category: "Time",
    dataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 480'%3E%3Crect x='40' y='140' width='400' height='200' rx='20' fill='%230f172a'/%3E%3Ctext x='240' y='260' font-family='monospace' font-size='80' fill='%2322d3ee' text-anchor='middle'%3E12:00%3C/text%3E%3C/svg%3E",
  },
  {
    id: "template-3",
    name: "Weather Icon",
    description: "Current weather conditions",
    category: "Weather",
    dataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 480'%3E%3Ccircle cx='240' cy='200' r='80' fill='%23fbbf24'/%3E%3Cpath d='M160 280 Q120 320 160 360 Q200 400 280 360 Q320 320 280 280 Z' fill='%2394a3b8'/%3E%3C/svg%3E",
  },
  {
    id: "template-4",
    name: "Battery Level",
    description: "Device battery indicator",
    category: "System",
    dataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 480'%3E%3Crect x='100' y='180' width='280' height='120' rx='10' fill='none' stroke='%23ffffff' stroke-width='8'/%3E%3Crect x='380' y='210' width='40' height='60' rx='5' fill='%23ffffff'/%3E%3Crect x='120' y='200' width='200' height='80' fill='%2322c55e'/%3E%3C/svg%3E",
  },
  {
    id: "template-5",
    name: "Music Player",
    description: "Now playing indicator",
    category: "Media",
    dataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 480'%3E%3Ccircle cx='240' cy='240' r='150' fill='%237c3aed'/%3E%3Ccircle cx='240' cy='240' r='50' fill='%23ffffff'/%3E%3Crect x='140' y='220' width='40' height='40' fill='%23ffffff'/%3E%3Crect x='300' y='220' width='40' height='40' fill='%23ffffff'/%3E%3C/svg%3E",
  },
  {
    id: "template-6",
    name: "Fitness Ring",
    description: "Activity progress ring",
    category: "Health",
    dataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 480'%3E%3Ccircle cx='240' cy='240' r='180' fill='none' stroke='%231e293b' stroke-width='20'/%3E%3Ccircle cx='240' cy='240' r='180' fill='none' stroke='%23ef4444' stroke-width='20' stroke-dasharray='565' stroke-dashoffset='141' transform='rotate(-90 240 240)'/%3E%3Ctext x='240' y='260' font-family='sans-serif' font-size='60' fill='%23ffffff' text-anchor='middle'%3E75%25%3C/text%3E%3C/svg%3E",
  },
];
