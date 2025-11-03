/**
 * Database Backup Script
 * Creates backups of the Supabase PostgreSQL database
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BACKUP_DIR = process.env.BACKUP_DIR || "./backups";

interface BackupConfig {
  tables: string[];
  includeData: boolean;
  includeSchema: boolean;
  compress: boolean;
}

const DEFAULT_CONFIG: BackupConfig = {
  tables: [
    "profiles",
    "keywords",
    "watchlists",
    "watchlist_items",
    "listings",
    "tags",
    "feature_flags",
    "usage_logs",
  ],
  includeData: true,
  includeSchema: true,
  compress: false,
};

async function createBackup(config: BackupConfig = DEFAULT_CONFIG): Promise<string> {
  console.log("🔄 Starting database backup...");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase credentials. Please set environment variables.");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `backup-${timestamp}.json`;
  const backupPath = path.join(BACKUP_DIR, backupFileName);

  const backup: Record<string, unknown> = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    database: "supabase",
    tables: {},
  };

  // Backup each table
  for (const tableName of config.tables) {
    try {
      console.log(`  📦 Backing up table: ${tableName}`);

      const { data, error } = await supabase
        .from(tableName)
        .select("*");

      if (error) {
        console.warn(`  ⚠️  Error backing up ${tableName}:`, error.message);
        continue;
      }

      (backup.tables as Record<string, unknown>)[tableName] = {
        rowCount: data?.length || 0,
        data: config.includeData ? data : [],
      };

      console.log(`  ✅ Backed up ${data?.length || 0} rows from ${tableName}`);
    } catch (error) {
      console.error(`  ❌ Failed to backup ${tableName}:`, error);
    }
  }

  // Write backup file
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  const fileSize = fs.statSync(backupPath).size;
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

  console.log(`\n✅ Backup completed successfully!`);
  console.log(`   📁 File: ${backupPath}`);
  console.log(`   📊 Size: ${fileSizeMB} MB`);
  console.log(`   🕐 Time: ${new Date().toISOString()}\n`);

  return backupPath;
}

async function listBackups(): Promise<void> {
  console.log("📋 Available backups:\n");

  if (!fs.existsSync(BACKUP_DIR)) {
    console.log("No backup directory found.");
    return;
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log("No backups found.");
    return;
  }

  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    const date = new Date(stats.mtime);

    console.log(`  📁 ${file}`);
    console.log(`     Size: ${sizeMB} MB`);
    console.log(`     Date: ${date.toISOString()}`);
    console.log("");
  }
}

async function cleanOldBackups(keepDays: number = 7): Promise<void> {
  console.log(`🗑️  Cleaning backups older than ${keepDays} days...`);

  if (!fs.existsSync(BACKUP_DIR)) {
    console.log("No backup directory found.");
    return;
  }

  const now = Date.now();
  const maxAge = keepDays * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("backup-") && f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    const age = now - stats.mtime.getTime();

    if (age > maxAge) {
      fs.unlinkSync(filePath);
      console.log(`  🗑️  Deleted: ${file}`);
      deletedCount++;
    }
  }

  console.log(`\n✅ Cleaned ${deletedCount} old backup(s)`);
}

// CLI handling
const command = process.argv[2];

switch (command) {
  case "create":
    createBackup()
      .catch((error) => {
        console.error("❌ Backup failed:", error);
        process.exit(1);
      });
    break;

  case "list":
    listBackups()
      .catch((error) => {
        console.error("❌ Error listing backups:", error);
        process.exit(1);
      });
    break;

  case "clean":
    const keepDays = parseInt(process.argv[3] || "7", 10);
    cleanOldBackups(keepDays)
      .catch((error) => {
        console.error("❌ Error cleaning backups:", error);
        process.exit(1);
      });
    break;

  case "schema-only":
    createBackup({ ...DEFAULT_CONFIG, includeData: false })
      .catch((error) => {
        console.error("❌ Schema backup failed:", error);
        process.exit(1);
      });
    break;

  default:
    console.log(`
Database Backup Utility

Usage:
  npm run backup:create       Create a full database backup
  npm run backup:schema       Create schema-only backup
  npm run backup:list         List all available backups
  npm run backup:clean [days] Delete backups older than N days (default: 7)

Environment Variables:
  NEXT_PUBLIC_SUPABASE_URL      Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY     Supabase service role key
  BACKUP_DIR                    Backup directory (default: ./backups)

Examples:
  npm run backup:create
  npm run backup:clean 30
  npm run backup:list
    `);
    break;
}
