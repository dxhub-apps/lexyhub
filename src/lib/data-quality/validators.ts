/**
 * Data Quality Validators
 * Provides utilities for validating data quality and integrity
 */

import { log } from "../logger";

export interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}

export interface DataQualityCheck {
  name: string;
  description: string;
  severity: "error" | "warning";
  check: () => Promise<ValidationResult>;
}

/**
 * Data completeness validator
 */
export class CompletenessValidator {
  /**
   * Check if required fields are present
   */
  static checkRequiredFields<T extends Record<string, unknown>>(
    data: T,
    requiredFields: (keyof T)[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const field of requiredFields) {
      if (data[field] === null || data[field] === undefined || data[field] === "") {
        errors.push(`Missing required field: ${String(field)}`);
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: { checkedFields: requiredFields.length },
    };
  }

  /**
   * Check percentage of non-null values in a dataset
   */
  static checkCompleteness<T extends Record<string, unknown>>(
    data: T[],
    field: keyof T,
    threshold: number = 0.95
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const nonNullCount = data.filter(
      (item) => item[field] !== null && item[field] !== undefined && item[field] !== ""
    ).length;

    const completeness = data.length > 0 ? nonNullCount / data.length : 0;

    if (completeness < threshold) {
      errors.push(
        `Field ${String(field)} completeness ${(completeness * 100).toFixed(1)}% is below threshold ${(threshold * 100).toFixed(1)}%`
      );
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        field: String(field),
        completeness: completeness,
        nonNullCount,
        totalCount: data.length,
      },
    };
  }
}

/**
 * Data freshness validator
 */
export class FreshnessValidator {
  /**
   * Check if data was updated recently
   */
  static checkFreshness(
    lastUpdated: Date,
    maxAgeMs: number
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const now = new Date();
    const age = now.getTime() - lastUpdated.getTime();

    if (age > maxAgeMs) {
      errors.push(
        `Data is stale. Last updated ${Math.floor(age / 1000 / 60)} minutes ago, max age is ${Math.floor(maxAgeMs / 1000 / 60)} minutes`
      );
    } else if (age > maxAgeMs * 0.8) {
      warnings.push(
        `Data is approaching stale threshold. Last updated ${Math.floor(age / 1000 / 60)} minutes ago`
      );
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        lastUpdated: lastUpdated.toISOString(),
        ageMs: age,
        maxAgeMs,
      },
    };
  }

  /**
   * Check if data has timestamps in expected range
   */
  static checkTimestampRange(
    timestamps: Date[],
    minDate: Date,
    maxDate: Date
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const outOfRange = timestamps.filter(
      (ts) => ts < minDate || ts > maxDate
    );

    if (outOfRange.length > 0) {
      errors.push(
        `Found ${outOfRange.length} timestamps outside expected range`
      );
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        totalTimestamps: timestamps.length,
        outOfRangeCount: outOfRange.length,
        minDate: minDate.toISOString(),
        maxDate: maxDate.toISOString(),
      },
    };
  }
}

/**
 * Data consistency validator
 */
export class ConsistencyValidator {
  /**
   * Check for duplicate records
   */
  static checkDuplicates<T>(
    data: T[],
    getKey: (item: T) => string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const item of data) {
      const key = getKey(item);
      if (seen.has(key)) {
        duplicates.add(key);
      }
      seen.add(key);
    }

    if (duplicates.size > 0) {
      warnings.push(`Found ${duplicates.size} duplicate records`);
    }

    return {
      passed: duplicates.size === 0,
      errors,
      warnings,
      metadata: {
        totalRecords: data.length,
        uniqueRecords: seen.size,
        duplicateKeys: duplicates.size,
      },
    };
  }

  /**
   * Check referential integrity
   */
  static checkReferentialIntegrity<T>(
    childRecords: T[],
    parentIds: Set<string>,
    getForeignKey: (item: T) => string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const orphaned = childRecords.filter(
      (item) => !parentIds.has(getForeignKey(item))
    );

    if (orphaned.length > 0) {
      errors.push(
        `Found ${orphaned.length} orphaned records with invalid foreign keys`
      );
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        childRecords: childRecords.length,
        parentIds: parentIds.size,
        orphanedRecords: orphaned.length,
      },
    };
  }

  /**
   * Check value consistency across records
   */
  static checkValueConsistency<T extends Record<string, unknown>>(
    data: T[],
    field: keyof T,
    expectedValues: Set<unknown>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const invalidRecords = data.filter(
      (item) => !expectedValues.has(item[field])
    );

    if (invalidRecords.length > 0) {
      errors.push(
        `Found ${invalidRecords.length} records with unexpected values for ${String(field)}`
      );
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        totalRecords: data.length,
        invalidRecords: invalidRecords.length,
        expectedValues: Array.from(expectedValues),
      },
    };
  }
}

/**
 * Data accuracy validator
 */
export class AccuracyValidator {
  /**
   * Check if numeric values are within expected range
   */
  static checkNumericRange<T extends Record<string, unknown>>(
    data: T[],
    field: keyof T,
    min: number,
    max: number
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const outOfRange = data.filter((item) => {
      const value = Number(item[field]);
      return isNaN(value) || value < min || value > max;
    });

    if (outOfRange.length > 0) {
      errors.push(
        `Found ${outOfRange.length} records with values outside range [${min}, ${max}] for ${String(field)}`
      );
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        totalRecords: data.length,
        outOfRangeCount: outOfRange.length,
        minValue: min,
        maxValue: max,
      },
    };
  }

  /**
   * Check data format consistency
   */
  static checkFormat<T extends Record<string, unknown>>(
    data: T[],
    field: keyof T,
    pattern: RegExp
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const invalid = data.filter((item) => {
      const value = String(item[field]);
      return !pattern.test(value);
    });

    if (invalid.length > 0) {
      errors.push(
        `Found ${invalid.length} records with invalid format for ${String(field)}`
      );
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        totalRecords: data.length,
        invalidCount: invalid.length,
        pattern: pattern.source,
      },
    };
  }

  /**
   * Check statistical outliers
   */
  static checkOutliers<T extends Record<string, unknown>>(
    data: T[],
    field: keyof T,
    standardDeviations: number = 3
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const values = data
      .map((item) => Number(item[field]))
      .filter((v) => !isNaN(v));

    if (values.length === 0) {
      return {
        passed: true,
        errors: [],
        warnings: ["No numeric values found"],
      };
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const outliers = data.filter((item) => {
      const value = Number(item[field]);
      return Math.abs(value - mean) > standardDeviations * stdDev;
    });

    if (outliers.length > 0) {
      warnings.push(
        `Found ${outliers.length} statistical outliers in ${String(field)}`
      );
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        mean,
        stdDev,
        outlierCount: outliers.length,
        threshold: standardDeviations,
      },
    };
  }
}

/**
 * Run a suite of data quality checks
 */
export async function runDataQualityChecks(
  checks: DataQualityCheck[]
): Promise<{
  passed: boolean;
  results: Map<string, ValidationResult>;
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    totalErrors: number;
    totalWarnings: number;
  };
}> {
  const results = new Map<string, ValidationResult>();
  let totalErrors = 0;
  let totalWarnings = 0;
  let passedChecks = 0;

  for (const check of checks) {
    try {
      const result = await check.check();
      results.set(check.name, result);

      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;

      if (result.passed) {
        passedChecks++;
      } else if (check.severity === "error") {
        log.error(
          `Data quality check failed: ${check.name}`,
          {
            check: check.name,
            errors: result.errors,
          }
        );
      } else {
        log.warn(
          `Data quality warning: ${check.name}`,
          {
            check: check.name,
            warnings: result.warnings,
          }
        );
      }
    } catch (error) {
      log.error(
        `Error running data quality check: ${check.name}`,
        {
          check: check.name,
          error,
        }
      );

      results.set(check.name, {
        passed: false,
        errors: [`Check failed: ${error}`],
        warnings: [],
      });
      totalErrors++;
    }
  }

  const passed = totalErrors === 0;

  return {
    passed,
    results,
    summary: {
      totalChecks: checks.length,
      passedChecks,
      failedChecks: checks.length - passedChecks,
      totalErrors,
      totalWarnings,
    },
  };
}
