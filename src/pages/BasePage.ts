import { Page } from 'playwright';
import logger from '../utils/logger';

/**
 * Base Page Object
 * Provides common functionality for all page objects
 */
export abstract class BasePage {
  protected page: Page;
  protected url: string;

  constructor(page: Page, url: string) {
    this.page = page;
    this.url = url;
  }

  async navigate(options = {}): Promise<void> {
    logger.info(`Navigating to ${this.url}`);
    await this.page.goto(this.url, {
      waitUntil: 'networkidle',
      ...options,
    });
  }

  async getTextContent(selector: string): Promise<string | null> {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      return await this.page.textContent(selector);
    } catch (error) {
      logger.debug(`Element not found: ${selector}`);
      return null;
    }
  }
}
