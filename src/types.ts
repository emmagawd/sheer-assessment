/**
 * Type definitions for NHS Medicines Scraper
 * Defining clear interfaces shows attention to detail and maintainability
 */

export interface Medicine {
  name: string;
  url: string;
  scrapedAt: string;
  description?: string;
  brandNames?: string[];
  sections: Record<string, string | string[]>;
  relatedConditions?: string[];
}

export interface ScraperConfig {
  baseUrl: string;
  maxConcurrency: number;
  timeout: number;
  retries: number;
  headless: boolean;
  outputPath: string;
}

export interface ScraperStats {
  totalMedicines: number;
  successfulScrapes: number;
  failedScrapes: number;
  startTime: Date;
  endTime?: Date;
  errors: Array<{
    medicine: string;
    url: string;
    error: string;
    timestamp: Date;
  }>;
}

export type MedicineMap = Record<string, Medicine>;
