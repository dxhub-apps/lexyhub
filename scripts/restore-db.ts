/**
 * Database Restore Script
 * Restores database from backup files
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BACKUP_DIR = process.env.BACKUP_DIR || "./backups";

interface BackupData {
  version: string;
  timestamp: string;
  database: string;
  tables: Record<
    string,
    {
      rowCount: number;
      data: Array<Record<string, unknown>>;
    }
  >;
}

interface RestoreOptions {
  clearExisting: boolean;
  tablesToRestore?: string[];
  dryRun: boolean;
}

async function confirmRestore(backupFile: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `\n⚠️  WARNING: This will restore data from ${backupFile}\n` +
        `   This may overwrite existing data.\n` +
        `   Are you sure you want to continue? (yes/no): `,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "yes");
      }
    );
  });
}

async function restoreBackup(
  backupFile: string,
  options: RestoreOptions
): Promise<void> {
  console.log("🔄 Starting database restore...");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
      "Missing Supabase credentials. Please set environment variables."
    );
  }

  const backupPath = path.isAbsolute(backupFile)
    ? backupFile
    : path.join(BACKUP_DIR, backupFile);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  // Require confirmation unless it's a dry run
  if (!options.dryRun) {
    const confirmed = await confirmRestore(backupFile);
    if (!confirmed) {
      console.log("❌ Restore cancelled by user");
      return;
    }
  }

  console.log(`   📁 Reading backup: ${backupPath}`);

  const backupContent = fs.readFileSync(backupPath, "utf-8");
  const backup: BackupData = JSON.parse(backupContent);

  console.log(`   📊 Backup version: ${backup.version}`);
  console.log(`   🕐 Backup date: ${backup.timestamp}`);
  console.log(`   📦 Tables in backup: ${Object.keys(backup.tables).length}\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const tablesToRestore = options.tablesToRestore || Object.keys(backup.tables);

  for (const tableName of tablesToRestore) {
    const tableData = backup.tables[tableName];

    if (!tableData) {
      console.warn(`  ⚠️  Table ${tableName} not found in backup`);
      continue;
    }

    console.log(`  📦 Restoring table: ${tableName}`);
    console.log(`     Rows to restore: ${tableData.rowCount}`);

    if (options.dryRun) {
      console.log(`     ✅ [DRY RUN] Would restore ${tableData.rowCount} rows`);
      continue;
    }

    try {
      // Clear existing data if requested
      if (options.clearExisting) {
        console.log(`     🗑️  Clearing existing data...`);
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

        if (deleteError) {
          console.warn(`     ⚠️  Error clearing table:`, deleteError.message);
        }
      }

      // Insert data in batches
      const batchSize = 100;
      const data = tableData.data;
      let insertedCount = 0;

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        const { error: insertError } = await supabase
          .from(tableName)
          .upsert(batch, { onConflict: "id" });

        if (insertError) {
          console.warn(
            `     ⚠️  Error inserting batch ${Math.floor(i / batchSize) + 1}:`,
            insertError.message
          );
        } else {
          insertedCount += batch.length;
        }
      }

      console.log(`     ✅ Restored ${insertedCount}/${tableData.rowCount} rows`);
    } catch (error) {
      console.error(`     ❌ Failed to restore ${tableName}:`, error);
    }
  }

  console.log(`\n✅ Restore completed!`);
}

async function validateBackup(backupFile: string): Promise<void> {
  console.log("🔍 Validating backup file...\n");

  const backupPath = path.isAbsolute(backupFile)
    ? backupFile
    : path.join(BACKUP_DIR, backupFile);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  try {
    const backupContent = fs.readFileSync(backupPath, "utf-8");
    const backup: BackupData = JSON.parse(backupContent);

    console.log(`✅ Backup file is valid JSON`);
    console.log(`   Version: ${backup.version}`);
    console.log(`   Timestamp: ${backup.timestamp}`);
    console.log(`   Database: ${backup.database}`);
    console.log(`   Tables: ${Object.keys(backup.tables).length}\n`);

    for (const [tableName, tableData] of Object.entries(backup.tables)) {
      console.log(`  📦 ${tableName}:`);
      console.log(`     Rows: ${tableData.rowCount}`);
      console.log(`     Data present: ${tableData.data.length > 0 ? "Yes" : "No"}`);
    }

    console.log(`\n✅ Backup validation complete`);
  } catch (error) {
    console.error(`❌ Invalid backup file:`, error);
    throw error;
  }
}

// CLI handling
const command = process.argv[2];
const backupFile = process.argv[3];

switch (command) {
  case "restore":
    if (!backupFile) {
      console.error("❌ Please specify a backup file");
      console.log("Usage: npm run restore:db restore <backup-file>");
      process.exit(1);
    }

    restoreBackup(backupFile, {
      clearExisting: false,
      dryRun: false,
    }).catch((error) => {
      console.error("❌ Restore failed:", error);
      process.exit(1);
    });
    break;

  case "restore-clear":
    if (!backupFile) {
      console.error("❌ Please specify a backup file");
      process.exit(1);
    }

    restoreBackup(backupFile, {
      clearExisting: true,
      dryRun: false,
    }).catch((error) => {
      console.error("❌ Restore failed:", error);
      process.exit(1);
    });
    break;

  case "dry-run":
    if (!backupFile) {
      console.error("❌ Please specify a backup file");
      process.exit(1);
    }

    restoreBackup(backupFile, {
      clearExisting: false,
      dryRun: true,
    }).catch((error) => {
      console.error("❌ Dry run failed:", error);
      process.exit(1);
    });
    break;

  case "validate":
    if (!backupFile) {
      console.error("❌ Please specify a backup file");
      process.exit(1);
    }

    validateBackup(backupFile).catch((error) => {
      console.error("❌ Validation failed:", error);
      process.exit(1);
    });
    break;

  default:
    console.log(`
Database Restore Utility

Usage:
  npm run restore:db restore <file>       Restore from backup (merge with existing)
  npm run restore:db restore-clear <file> Restore from backup (clear existing)
  npm run restore:db dry-run <file>       Test restore without making changes
  npm run restore:db validate <file>      Validate backup file integrity

Environment Variables:
  NEXT_PUBLIC_SUPABASE_URL      Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY     Supabase service role key
  BACKUP_DIR                    Backup directory (default: ./backups)

Examples:
  npm run restore:db validate backup-2025-01-01T12-00-00-000Z.json
  npm run restore:db dry-run backup-2025-01-01T12-00-00-000Z.json
  npm run restore:db restore backup-2025-01-01T12-00-00-000Z.json

⚠️  WARNING: Always validate and test backups before restoring!
    `);
    break;
}
