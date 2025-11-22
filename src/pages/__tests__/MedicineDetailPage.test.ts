import { Page } from 'playwright';
import { MedicineDetailPage } from '../MedicineDetailPage';

describe('MedicineDetailPage', () => {
  let mockPage: Partial<Page>;
  let detailPage: MedicineDetailPage;

  beforeEach(() => {
    mockPage = {
      goto: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      textContent: jest.fn().mockResolvedValue(null),
      $$eval: jest.fn().mockResolvedValue([]), // no hub links, no related links
    };

    detailPage = new MedicineDetailPage(
      mockPage as Page,
      'https://www.nhs.uk/medicines/paracetamol/',
      'Paracetamol'
    );
  });

  describe('Page Navigation', () => {
    it('navigates to the medicine URL', async () => {
      await detailPage.navigate();

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://www.nhs.uk/medicines/paracetamol/',
        expect.objectContaining({
          waitUntil: 'networkidle',
        })
      );
    });
  });

  describe('Data Extraction', () => {
    it('extracts basic medicine data with description', async () => {
      // Mock waitForSelector calls (from getTextContent)
      (mockPage.waitForSelector as jest.Mock).mockResolvedValue(undefined);

      // Mock textContent calls in order:
      // 1. Description selector
      (mockPage.textContent as jest.Mock).mockResolvedValueOnce('Common painkiller');
      // 2. Review date selector (returns null)
      (mockPage.textContent as jest.Mock).mockResolvedValueOnce(null);

      const medicine = await detailPage.extractMedicineData();

      expect(medicine.name).toBe('Paracetamol');
      expect(medicine.url).toBe('https://www.nhs.uk/medicines/paracetamol/');
      expect(medicine.description).toBe('Common painkiller');
      expect(typeof medicine.scrapedAt).toBe('string');
      expect(medicine.sections).toEqual({}); // no hub links -> no sections
    });
  });

  describe('Page State', () => {
    it('returns true when the page heading is found', async () => {
      (mockPage.waitForSelector as jest.Mock).mockResolvedValue(undefined);

      const isLoaded = await detailPage.isLoaded();

      expect(isLoaded).toBe(true);
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('h1', { timeout: 5000 });
    });

    it('returns false when heading cannot be found', async () => {
      (mockPage.waitForSelector as jest.Mock).mockRejectedValue(new Error('Timeout'));

      const isLoaded = await detailPage.isLoaded();

      expect(isLoaded).toBe(false);
    });
  });
});
