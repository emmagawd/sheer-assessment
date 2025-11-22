import { MedicineScraper } from './scraper/MedicineScraper';
import { MedicineMap, ScraperStats } from './types';
import logger from './utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * NHS Medicine Data Extraction Tool
 *
 * Built for Sheer Health Technical Assessment
 *
 * Uses Page Object Model pattern for:
 * - Maintainability: Changes to page structure only require updates in page objects
 * - Testability: Page objects can be easily mocked for unit tests
 * - Reusability: Page objects can be reused across different scrapers
 * - Separation of Concerns: Business logic separated from page interactions
 *
 */

async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: unknown) {
    logger.error('Failed to create directory', { dirPath, error });
  }
}

async function saveResults(
  medicines: MedicineMap,
  outputPath: string,
  stats: ScraperStats
): Promise<void> {
  try {
    const dir = path.dirname(outputPath);
    await ensureDirectoryExists(dir);

    // Create the output with __meta section
    const output = {
      ...medicines,
      __meta: {
        scrapedAt: stats.endTime?.toISOString() || new Date().toISOString(),
        totalMedicines: stats.totalMedicines,
        successfulMedicines: stats.successfulScrapes,
        failedMedicines: stats.errors.map((e) => ({
          name: e.medicine,
          url: e.url,
          reason: e.error,
        })),
      },
    };

    // Save the main JSON file with metadata
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    logger.info(`Results saved to ${outputPath}`);

    // Also save a summary file for quick reference
    const summary = {
      totalMedicines: Object.keys(medicines).length,
      extractedAt: new Date().toISOString(),
      medicines: Object.keys(medicines).sort(),
    };

    const summaryPath = path.join(dir, 'medicines-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

    logger.info(`Summary saved to ${summaryPath}`);
  } catch (error: unknown) {
    logger.error('Failed to save results', { error });
    throw error;
  }
}

async function generateReport(
  medicines: MedicineMap,
  stats: ScraperStats,
  maxConcurrency: number
): Promise<void> {
  try {
    const reportPath = './output/extraction-report.md';

    // Defensive calculations
    const total = stats.totalMedicines || Object.keys(medicines).length || 1;
    const durationSeconds = stats.endTime
      ? (stats.endTime.getTime() - stats.startTime.getTime()) / 1000
      : 0;
    const successRate = total > 0 ? ((stats.successfulScrapes / total) * 100).toFixed(2) : '0.00';
    const avgTimePerMed = total > 0 ? (durationSeconds / total).toFixed(2) : '0.00';
    const medicineCount = Object.keys(medicines).length || 1;
    const avgSectionsPerMed = (
      Object.values(medicines).reduce((sum, m) => sum + Object.keys(m.sections).length, 0) /
      medicineCount
    ).toFixed(1);

    const report = `# NHS Medicines Extraction Report

## Summary
- **Total Medicines Found**: ${stats.totalMedicines}
- **Successfully Extracted**: ${stats.successfulScrapes}
- **Failed Extractions**: ${stats.failedScrapes}
- **Success Rate**: ${successRate}%
- **Extraction Time**: ${durationSeconds.toFixed(2)} seconds
- **Generated At**: ${new Date().toISOString()}

## Data Quality Metrics
- **Medicines with Descriptions**: ${Object.values(medicines).filter((m) => m.description).length}
- **Medicines with Brand Names**: ${Object.values(medicines).filter((m) => m.brandNames && m.brandNames.length > 0).length}
- **Medicines with Sections**: ${Object.values(medicines).filter((m) => Object.keys(m.sections).length > 0).length}
- **Medicines with Related Conditions**: ${Object.values(medicines).filter((m) => m.relatedConditions && Array.isArray(m.relatedConditions) && m.relatedConditions.length > 0).length}
- **Average Sections per Medicine**: ${avgSectionsPerMed}

## Failed Extractions
${stats.errors.length > 0 ? stats.errors.map((e) => `- ${e.medicine}: ${e.error}`).join('\n') : 'None'}

## Technical Details
- **Concurrency**: ${stats.successfulScrapes > 0 ? `${maxConcurrency} concurrent pages` : 'N/A'}
- **Average Time per Medicine**: ${avgTimePerMed}s
`;

    await fs.writeFile(reportPath, report, 'utf-8');
    logger.info(`Report generated at ${reportPath}`);
  } catch (error: unknown) {
    logger.error('Failed to generate report', { error });
  }
}

async function main(): Promise<void> {
  logger.info('Starting NHS Medicines Data Extraction for Sheer Health');

  // Configuration - adjust these for testing vs full runs
  const maxConcurrency = 5; // Reduce if needed to avoid overwhelming the NHS servers when we're making multiple requests per medicine to each topic page
  const LIMIT_MEDICINES: number | null = null; // Set to null to scrape all medicines, or a number to limit for testing

  try {
    // Ensure output directory exists
    await ensureDirectoryExists('./output');

    // Initialize scraper with Page Object Model
    const scraper = new MedicineScraper({
      headless: true,
      maxConcurrency: maxConcurrency,
      retries: 3,
      timeout: 60000, // Increased timeout for deeper scraping
    });

    // Execute the scraping
    logger.info('Beginning extraction process...');
    if (LIMIT_MEDICINES) {
      logger.info(`Running in test mode - limiting to ${String(LIMIT_MEDICINES)} medicines`);
    } else {
      logger.info('Running full extraction - all medicines');
    }
    const medicines = await scraper.scrape(LIMIT_MEDICINES);

    // Get statistics
    const stats = scraper.getStats();

    // Validate a sample of results
    scraper.validateSample(medicines);

    // Save results with metadata
    await saveResults(medicines, './output/medicines.json', stats);

    // Generate detailed report
    await generateReport(medicines, stats, maxConcurrency);

    // Log final summary
    const total = stats.totalMedicines || Object.keys(medicines).length || 1;
    const successRate = total > 0 ? ((stats.successfulScrapes / total) * 100).toFixed(2) : '0.00';
    logger.info('Extraction completed successfully!', {
      totalMedicines: Object.keys(medicines).length,
      successRate: `${successRate}%`,
    });

    // Display summary to console
    const duration = stats.endTime
      ? (stats.endTime.getTime() - stats.startTime.getTime()) / 1000
      : 0;
    /* eslint-disable no-console */
    console.log('\nExtraction Summary:');
    console.log(`   Total Medicines: ${Object.keys(medicines).length}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Time Taken: ${duration.toFixed(2)}s`);
    console.log('\nArchitecture: Page Object Model (Index + Detail pages)');
    console.log('   - Page structure isolated from scraping orchestration');
    console.log('   - Easier to adapt if NHS layout changes');
    console.log('\nOutput Files:');
    console.log('   - ./output/medicines.json (Main data file)');
    console.log('   - ./output/medicines-summary.json (Quick reference)');
    console.log('   - ./output/extraction-report.md (Detailed report)\n');
    /* eslint-enable no-console */
  } catch (error: unknown) {
    logger.error('Fatal error in main process', { error });
    process.exit(1);
  }
}

// Run the scraper
main().catch((error: unknown) => {
  logger.error('Unhandled error', { error });
  process.exit(1);
});
