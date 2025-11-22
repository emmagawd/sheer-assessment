import { Page } from 'playwright';
import { BasePage } from './BasePage';
import { Medicine } from '../types';
import logger from '../utils/logger';

/**
 * Page Object for Individual Medicine Detail Pages
 * Encapsulates all interactions with medicine detail pages
 */
export class MedicineDetailPage extends BasePage {
  private medicineName: string;

  // Selectors organized by section
  private readonly selectors = {
    // Main content
    pageHeading: 'h1',
    description: '.nhsuk-lede-text', // Main description paragraph

    // Hub-style navigation links (topics about this medicine)
    hubKeyLinks: '.nhsuk-hub-key-links a, .beta-hub-key-links a',

    // Related conditions/resources
    relatedLinks: '.beta-hub-related-links a',

    // Review information
  };

  constructor(page: Page, url: string, medicineName: string) {
    super(page, url);
    this.medicineName = medicineName;
  }

  async extractMedicineData(): Promise<Medicine> {
    logger.info(`Extracting data for medicine: ${this.medicineName}`);

    const medicine: Medicine = {
      name: this.medicineName,
      url: this.url,
      scrapedAt: new Date().toISOString(),
      sections: {},
    };

    // Extract description
    const description = await this.extractDescription();
    if (description) medicine.description = description;

    // Extract brand names from title (simple version)
    const brandNames = this.extractBrandNames(this.medicineName);
    if (brandNames.length > 0) medicine.brandNames = brandNames;

    // Extract hub key links with URLs
    const topicLinks = await this.extractHubLinksWithUrls();

    // Navigate to each topic page and extract its content
    const priorityTopics = ['about', 'who can', 'how and when', 'side effects'];
    for (const topic of topicLinks) {
      // Check if this is a priority topic
      const isPriority = priorityTopics.some((priority) =>
        topic.text.toLowerCase().includes(priority)
      );

      if (isPriority) {
        try {
          logger.info(`Extracting content from topic: ${topic.text}`);
          const content = await this.extractTopicContent(topic.url);
          if (content) {
            // Use the topic text as the section key
            medicine.sections[topic.text] = content;
          }
        } catch (error) {
          logger.warn(`Failed to extract content from ${topic.text}`, { error });
        }
      }
    }

    // Extract related conditions
    const relatedConditions = await this.extractRelatedLinks();
    if (relatedConditions.length > 0) {
      medicine.relatedConditions = relatedConditions;
    }

    logger.debug(`Extracted data for ${this.medicineName}`, {
      sectionsExtracted: Object.keys(medicine.sections).length,
    });

    return medicine;
  }

  private async extractDescription(): Promise<string | null> {
    return await this.getTextContent(this.selectors.description);
  }

  private async extractHubLinksWithUrls(): Promise<Array<{ text: string; url: string }>> {
    try {
      const links = await this.page.$$eval(this.selectors.hubKeyLinks, (anchors) =>
        anchors
          .map((a) => ({
            text: (a as HTMLAnchorElement).textContent?.trim() || '',
            url: (a as HTMLAnchorElement).href,
          }))
          .filter((link) => link.text && link.url)
      );
      return links;
    } catch (error) {
      logger.debug('No hub links found', { error });
      return [];
    }
  }

  private async extractTopicContent(topicUrl: string): Promise<string[]> {
    // Create a new page for navigating to the topic
    const newPage = await this.page.context().newPage();

    try {
      // Navigate to the topic page
      await newPage.goto(topicUrl, { waitUntil: 'domcontentloaded' });

      // Wait for content to load
      await newPage.waitForSelector('.nhsuk-main-wrapper', { timeout: 5000 });

      // Extract all main content from the topic page
      const content = await newPage.$$eval(
        '.nhsuk-main-wrapper p, .nhsuk-main-wrapper li, .nhsuk-main-wrapper h2, .nhsuk-main-wrapper h3',
        (elements) => {
          const extractedContent: string[] = [];

          elements.forEach((el) => {
            const text = el.textContent?.trim();
            if (text) {
              // For headers, add them with a marker
              if (el.tagName === 'H2' || el.tagName === 'H3') {
                extractedContent.push(`### ${text}`);
              } else {
                extractedContent.push(text);
              }
            }
          });

          return extractedContent;
        }
      );

      // Filter content: stop when we hit navigation sections
      const filteredContent: string[] = [];

      for (const text of content) {
        // Stop collecting content once we hit the "More in" navigation
        if (text.includes('### More in') || text.includes('More in')) {
          break;
        }

        // Skip review dates that appear before "More in"
        if (text.startsWith('Page last reviewed:') || text.startsWith('Next review due:')) {
          continue;
        }

        // Only add non-empty content
        if (text.length > 0) {
          filteredContent.push(text);
        }
      }

      return filteredContent;
    } catch (error) {
      logger.error(`Failed to extract content from ${topicUrl}`, { error });
      return [];
    } finally {
      await newPage.close();
    }
  }

  private async extractRelatedLinks(): Promise<string[]> {
    try {
      const links = await this.page.$$eval(this.selectors.relatedLinks, (anchors) =>
        anchors.map((a) => (a as HTMLAnchorElement).textContent?.trim() || '').filter(Boolean)
      );
      return links;
    } catch (error) {
      logger.debug('No related links found', { error });
      return [];
    }
  }

  async isLoaded(): Promise<boolean> {
    try {
      await this.page.waitForSelector(this.selectors.pageHeading, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract brand names from medicine title (simple version)
   * Looks for text in parentheses which often contains brand names
   */
  private extractBrandNames(title: string): string[] {
    const brandNames: string[] = [];

    // Simple pattern: text in parentheses in the title
    const parenMatch = title.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const brand = parenMatch[1].trim();
      if (brand && !brand.toLowerCase().includes('generic')) {
        brandNames.push(brand);
      }
    }

    return brandNames;
  }
}
