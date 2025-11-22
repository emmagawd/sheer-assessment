import { MedicineScraper } from '../MedicineScraper';
import { MedicineMap } from '../../types';

describe('MedicineScraper', () => {
  describe('Data Validation', () => {
    it('validates a sample of medicines without throwing', () => {
      const scraper = new MedicineScraper();

      const medicines: MedicineMap = {
        Paracetamol: {
          name: 'Paracetamol',
          url: 'https://www.nhs.uk/medicines/paracetamol/',
          scrapedAt: new Date().toISOString(),
          sections: {},
        },
        Aspirin: {
          name: 'Aspirin',
          url: 'https://www.nhs.uk/medicines/aspirin/',
          scrapedAt: new Date().toISOString(),
          sections: { 'About aspirin': 'Pain relief medication' },
        },
      };

      expect(() => scraper.validateSample(medicines, 1)).not.toThrow();
    });
  });

  describe('Configuration', () => {
    it('initializes with default configuration', () => {
      const scraper = new MedicineScraper();
      const stats = scraper.getStats();

      expect(stats.totalMedicines).toBe(0);
      expect(stats.successfulScrapes).toBe(0);
      expect(stats.failedScrapes).toBe(0);
      expect(stats.errors).toEqual([]);
      expect(stats.startTime).toBeInstanceOf(Date);
    });

    it('accepts custom configuration', () => {
      const config = {
        maxConcurrency: 10,
        headless: false,
        timeout: 60000,
      };

      const scraper = new MedicineScraper(config);
      expect(scraper).toBeDefined();
    });
  });

  describe('Stats Tracking', () => {
    it('returns a copy of stats to prevent external mutation', () => {
      const scraper = new MedicineScraper();
      const stats1 = scraper.getStats();
      const stats2 = scraper.getStats();

      expect(stats1).not.toBe(stats2); // Different objects
      expect(stats1).toEqual(stats2); // Same values
    });
  });
});
