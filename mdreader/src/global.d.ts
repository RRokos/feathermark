export {};

declare global {
  interface Window {
    loadFile?: (filePath: string, anchor?: string | null) => Promise<void>;
  }
}