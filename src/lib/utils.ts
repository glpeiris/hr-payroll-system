import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function downloadCSV(content: string, filename: string) {
  const BOM = "\uFEFF";
  // Sanitize the filename for OS safety
  const sanitizedFilename = filename.replace(/[<>:"/\\|?* ]+/g, "_");
  const finalFilename = sanitizedFilename.toLowerCase().endsWith(".csv") ? sanitizedFilename : `${sanitizedFilename}.csv`;
  
  // High-reliability Base64 encoding for text payloads
  const csvContent = BOM + content;
  const base64 = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(csvContent))) : Buffer.from(csvContent).toString('base64');
  const dataUri = "data:text/csv;base64," + base64;
  
  const link = document.createElement("a");
  link.setAttribute("href", dataUri);
  link.setAttribute("download", finalFilename);
  link.style.display = "none";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadExcel(base64: string, filename: string) {
  // Sanitize the filename for OS safety
  const sanitizedFilename = filename.replace(/[<>:"/\\|?* ]+/g, "_");
  const finalFilename = sanitizedFilename.toLowerCase().endsWith(".xlsx") ? sanitizedFilename : `${sanitizedFilename}.xlsx`;
  
  const dataUri = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + base64;
  
  const link = document.createElement("a");
  link.setAttribute("href", dataUri);
  link.setAttribute("download", finalFilename);
  link.style.display = "none";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
