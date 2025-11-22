import { Page } from 'playwright';
import { BasePage } from './BasePage';
import logger from '../utils/logger';

/**
 * Page Object for NHS Medicines Index Page
 * Handles interaction with the main medicines listing page
 */
export class MedicinesIndexPage extends BasePage {
  // Selectors - Updated for current NHS site structure (as of 2024)
  private readonly selectors = {
    medicineLink: 'a[href^="/medicines/"]',
    pageHeading: 'h1',
  };

  constructor(page: Page) {
    super(page, 'https://www.nhs.uk/medicines/');
  }

  async getAllMedicineLinks(): Promise<Array<{ name: string; url: string }>> {
    logger.info('Extracting all medicine links from index page');

    // Wait for the page to load properly
    await this.page.waitForSelector(this.selectors.medicineLink, { timeout: 10000 });

    // Extract all medicine links from the page
    const medicines = await this.page.$$eval(this.selectors.medicineLink, (anchors) =>
      anchors
        .map((anchor) => ({
          name: anchor.textContent?.trim() || '',
          url: (anchor as HTMLAnchorElement).href,
        }))
        .filter(
          (link) =>
            link.name &&
            link.url &&
            !link.url.endsWith('/medicines/') && // Exclude main page link
            !link.url.includes('#') // Exclude anchor links (A, B, C, etc.)
        )
    );

    logger.info(`Found ${medicines.length} medicines on index page`);
    return medicines;
  }

  async isLoaded(): Promise<boolean> {
    try {
      // Check if medicine links are present - most reliable indicator
      await this.page.waitForSelector(this.selectors.medicineLink, { timeout: 10000 });
      logger.debug('Medicine links found - page loaded successfully');
      return true;
    } catch (error) {
      logger.error('Page load check failed', { error });
      return false;
    }
  }
}
