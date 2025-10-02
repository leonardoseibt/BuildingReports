/**
 * OBSOLETE SCRIPT - DO NOT USE
 * 
 * This script was used to migrate JSONB reportData to relational structure.
 * The report_data column has been removed from the database (migration 20250828_drop_report_data_column.sql).
 * All reports now use the relational structure exclusively.
 * 
 * Keeping this file for historical reference only.
 */

/*
import { db } from '../server/db';
import { reports, reportRequirements, reportCriteria, reportAnalyses, reportAnalysisLevels } from '../shared/schema';

async function migrateReportStructure() {
  try {
    console.log('Starting report structure migration...');
    
    // Fetch all reports with JSONB data
    const allReports = await db.select().from(reports);
    console.log(`Found ${allReports.length} reports to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const report of allReports) {
      try {
        const reportData = report.reportData as any;
        
        // Skip if no reportData or invalid structure
        if (!reportData || typeof reportData !== 'object') {
          console.log(`Skipping report ${report.id}: no valid reportData`);
          skipped++;
          continue;
        }
        
        // Extract structure from JSONB
        const selectedRequirements = reportData.selectedRequirements || [];
        const selectedCriteria = reportData.selectedCriteria || [];
        const selectedAnalyses = reportData.selectedAnalyses || [];
        
        // Skip if no selections
        if (selectedRequirements.length === 0 && selectedCriteria.length === 0 && selectedAnalyses.length === 0) {
          console.log(`Skipping report ${report.id}: no selections found`);
          skipped++;
          continue;
        }
        
        await db.transaction(async (tx) => {
          // Insert requirements
          if (selectedRequirements.length > 0) {
            await tx.insert(reportRequirements).values(
              selectedRequirements.map((reqId: number, index: number) => ({
                reportId: report.id,
                requirementId: reqId,
                position: index,
              }))
            ).onConflictDoNothing();
          }
          
          // Insert criteria
          if (selectedCriteria.length > 0) {
            await tx.insert(reportCriteria).values(
              selectedCriteria.map((critId: number, index: number) => ({
                reportId: report.id,
                criterionId: critId,
                position: index,
              }))
            ).onConflictDoNothing();
          }
          
          // Insert analyses with levels
          if (selectedAnalyses.length > 0) {
            for (let index = 0; index < selectedAnalyses.length; index++) {
              const analysis = selectedAnalyses[index];
              const analysisId = typeof analysis === 'number' ? analysis : analysis.id;
              
              // Insert analysis
              const [reportAnalysis] = await tx.insert(reportAnalyses).values({
                reportId: report.id,
                analysisId: analysisId,
                position: index,
              }).returning().onConflictDoNothing();
              
              // Insert levels if they exist
              if (reportAnalysis && typeof analysis === 'object' && analysis.selectedLevels) {
                const levels = analysis.selectedLevels;
                if (levels.length > 0) {
                  await tx.insert(reportAnalysisLevels).values(
                    levels.map((level: string) => ({
                      reportAnalysisId: reportAnalysis.id,
                      level,
                    }))
                  ).onConflictDoNothing();
                }
              }
            }
          }
        });
        
        console.log(`✓ Migrated report ${report.id}`);
        migrated++;
      } catch (error) {
        console.error(`✗ Error migrating report ${report.id}:`, error);
        errors++;
      }
    }
    
    console.log('\nMigration complete!');
    console.log(`- Migrated: ${migrated}`);
    console.log(`- Skipped: ${skipped}`);
    console.log(`- Errors: ${errors}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run migration
migrateReportStructure();
*/
