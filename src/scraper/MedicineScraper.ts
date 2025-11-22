import { chromium, Browser, Page, BrowserContext } from 'playwright';
import pLimit from 'p-limit';
import { Medicine, ScraperConfig, ScraperStats, MedicineMap } from '../types';
import { MedicinesIndexPage } from '../pages/MedicinesIndexPage';
import { MedicineDetailPage } from '../pages/MedicineDetailPage';
import logger from '../utils/logger';

/**
 * NHS Medicine Scraper with Page Object Model
 *
 * Uses POM pattern for better maintainability,
 * testability, and separation of concerns
 */
export class MedicineScraper {
  private config: ScraperConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private stats: ScraperStats;
  private limit: ReturnType<typeof pLimit>;

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = {
      baseUrl: 'https://www.nhs.uk/medicines/',
      maxConcurrency: 5,
      timeout: 30000,
      retries: 3,
      headless: true,
      outputPath: './output/medicines.json',
      ...config,
    };

    this.stats = {
      totalMedicines: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      startTime: new Date(),
      errors: [],
    };

    this.limit = pLimit(this.config.maxConcurrency);
    logger.info('Medicine scraper initialized', { config: this.config });
  }

  /**
   * Initialize browser and context
   */
  private async initialize(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: this.config.headless,
        timeout: this.config.timeout,
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });

      // Set default timeout for all pages
      this.context.setDefaultTimeout(this.config.timeout);

      logger.info('Browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize browser', { error });
      throw error;
    }
  }

  /**
   * Create a new page with error handling
   */
  private async createPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }
    return await this.context.newPage();
  }

  /**
   * Get list of all medicines using Page Object
   */
  private async getMedicinesList(): Promise<Array<{ name: string; url: string }>> {
    const page = await this.createPage();

    try {
      const indexPage = new MedicinesIndexPage(page);

      // Navigate to the index page
      await indexPage.navigate();

      // Verify page loaded correctly
      const isLoaded = await indexPage.isLoaded();
      if (!isLoaded) {
        throw new Error('Medicines index page failed to load');
      }

      // Extract all medicine links
      const medicines = await indexPage.getAllMedicineLinks();

      this.stats.totalMedicines = medicines.length;
      logger.info(`Found ${medicines.length} medicines to scrape`);

      return medicines;
    } catch (error) {
      logger.error('Failed to get medicines list', { error });
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Scrape individual medicine page using Page Object with retry logic
   */
  private async scrapeMedicinePage(
    name: string,
    url: string,
    retries = this.config.retries
  ): Promise<Medicine | null> {
    const page = await this.createPage();

    try {
      logger.info(`Scraping medicine: ${name}`);

      const detailPage = new MedicineDetailPage(page, url, name);

      // Navigate to the medicine page
      await detailPage.navigate();

      // Verify page loaded
      const isLoaded = await detailPage.isLoaded();
      if (!isLoaded) {
        throw new Error(`Medicine page failed to load: ${name}`);
      }

      // Extract medicine data using page object
      const medicine = await detailPage.extractMedicineData();

      this.stats.successfulScrapes++;
      return medicine;
    } catch (error) {
      if (retries > 0) {
        logger.warn(`Retrying ${name} (${retries} retries left)`);
        // Wait a bit before retrying
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
        return this.scrapeMedicinePage(name, url, retries - 1);
      }

      logger.error(`Failed to scrape ${name}`, { error });
      this.stats.failedScrapes++;
      this.stats.errors.push({
        medicine: name,
        url: url,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });
      return null;
    } finally {
      await page.close();
    }
  }

  /**
   * Main execution method
   */
  public async scrape(limit?: number | null): Promise<MedicineMap> {
    try {
      await this.initialize();

      // Get all medicines using page object
      let medicinesList = await this.getMedicinesList();

      // Apply limit if specified
      if (limit !== null && limit !== undefined && limit > 0) {
        logger.info(`Limiting scrape to first ${limit} medicines for testing`);
        medicinesList = medicinesList.slice(0, limit);
        this.stats.totalMedicines = medicinesList.length;
      }

      // Process medicines with concurrency control
      logger.info(`Starting concurrent scraping with limit of ${this.config.maxConcurrency}`);

      const results = await Promise.all(
        medicinesList.map((med) => this.limit(() => this.scrapeMedicinePage(med.name, med.url)))
      );

      // Build the final map
      const medicinesMap: MedicineMap = {};

      for (const medicine of results) {
        if (medicine) {
          medicinesMap[medicine.name] = medicine;
        }
      }

      this.stats.endTime = new Date();

      // Log summary
      const duration = (this.stats.endTime.getTime() - this.stats.startTime.getTime()) / 1000;
      logger.info('Scraping completed', {
        total: this.stats.totalMedicines,
        successful: this.stats.successfulScrapes,
        failed: this.stats.failedScrapes,
        duration: `${duration.toFixed(2)}s`,
        avgTimePerMedicine: `${(duration / this.stats.totalMedicines).toFixed(2)}s`,
      });

      return medicinesMap;
    } catch (error) {
      logger.error('Fatal error during scraping', { error });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    logger.info('Browser resources cleaned up');
  }

  /**
   * Get scraping statistics
   */
  public getStats(): ScraperStats {
    return { ...this.stats };
  }

  /**
   * Validate a sample of medicines to ensure data quality
   */
  public validateSample(medicinesMap: MedicineMap, sampleSize = 5): void {
    const medicines = Object.values(medicinesMap);
    const sample = medicines.slice(0, Math.min(sampleSize, medicines.length));

    logger.info(`Validating sample of ${sample.length} medicines`);

    for (const medicine of sample) {
      const issues: string[] = [];

      if (!medicine.name) issues.push('Missing name');
      if (!medicine.url) issues.push('Missing URL');
      if (!medicine.scrapedAt) issues.push('Missing timestamp');

      const sectionKeys = Object.keys(medicine.sections);
      if (sectionKeys.length === 0) {
        issues.push('No sections extracted');
      }

      if (issues.length > 0) {
        logger.warn(`Validation issues for ${medicine.name}:`, issues);
      } else {
        logger.info(`${medicine.name} passed validation`);
      }
    }
  }
}
