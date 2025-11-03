/**
 * Advanced Feature Flag Targeting
 * Enables targeting flags to specific users, segments, or conditions
 */

import { log } from "../logger";

export interface UserContext {
  userId: string;
  email?: string;
  plan?: string;
  beta?: boolean;
  createdAt?: Date;
  attributes?: Record<string, unknown>;
}

export interface TargetingRule {
  type: "user" | "email" | "plan" | "percentage" | "attribute";
  operator: "equals" | "contains" | "in" | "greaterThan" | "lessThan" | "matches";
  value: unknown;
}

export interface FeatureFlagConfig {
  key: string;
  enabled: boolean;
  description?: string;
  targeting?: TargetingRule[];
  rolloutPercentage?: number; // 0-100
  scheduledEnableAt?: Date;
  scheduledDisableAt?: Date;
}

class FeatureFlagTargeting {
  private configs: Map<string, FeatureFlagConfig> = new Map();

  /**
   * Register a feature flag configuration
   */
  register(config: FeatureFlagConfig): void {
    this.configs.set(config.key, config);
    log.debug(`Feature flag registered: ${config.key}`, { flagKey: config.key });
  }

  /**
   * Check if a feature is enabled for a user
   */
  isEnabled(flagKey: string, userContext: UserContext): boolean {
    const config = this.configs.get(flagKey);

    if (!config) {
      log.warn(`Feature flag not found: ${flagKey}`, { flagKey });
      return false;
    }

    // Check if globally disabled
    if (!config.enabled) {
      return false;
    }

    // Check scheduling
    const now = new Date();
    if (config.scheduledEnableAt && now < config.scheduledEnableAt) {
      return false;
    }
    if (config.scheduledDisableAt && now > config.scheduledDisableAt) {
      return false;
    }

    // Check targeting rules
    if (config.targeting && config.targeting.length > 0) {
      const matchesRules = this.evaluateTargetingRules(
        config.targeting,
        userContext
      );
      if (!matchesRules) {
        return false;
      }
    }

    // Check rollout percentage
    if (config.rolloutPercentage !== undefined) {
      const enabled = this.isInRollout(
        flagKey,
        userContext.userId,
        config.rolloutPercentage
      );
      if (!enabled) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate targeting rules
   */
  private evaluateTargetingRules(
    rules: TargetingRule[],
    userContext: UserContext
  ): boolean {
    // All rules must match (AND logic)
    return rules.every((rule) => this.evaluateRule(rule, userContext));
  }

  /**
   * Evaluate a single targeting rule
   */
  private evaluateRule(rule: TargetingRule, userContext: UserContext): boolean {
    switch (rule.type) {
      case "user":
        return this.evaluateUserRule(rule, userContext.userId);
      case "email":
        return this.evaluateEmailRule(rule, userContext.email);
      case "plan":
        return this.evaluatePlanRule(rule, userContext.plan);
      case "percentage":
        return this.evaluatePercentageRule(rule, userContext.userId);
      case "attribute":
        return this.evaluateAttributeRule(rule, userContext.attributes);
      default:
        return false;
    }
  }

  /**
   * Evaluate user ID rule
   */
  private evaluateUserRule(rule: TargetingRule, userId: string): boolean {
    switch (rule.operator) {
      case "equals":
        return userId === rule.value;
      case "in":
        return Array.isArray(rule.value) && rule.value.includes(userId);
      default:
        return false;
    }
  }

  /**
   * Evaluate email rule
   */
  private evaluateEmailRule(rule: TargetingRule, email?: string): boolean {
    if (!email) return false;

    switch (rule.operator) {
      case "equals":
        return email === rule.value;
      case "contains":
        return email.includes(String(rule.value));
      case "in":
        return Array.isArray(rule.value) && rule.value.includes(email);
      case "matches":
        return new RegExp(String(rule.value)).test(email);
      default:
        return false;
    }
  }

  /**
   * Evaluate plan rule
   */
  private evaluatePlanRule(rule: TargetingRule, plan?: string): boolean {
    if (!plan) return false;

    switch (rule.operator) {
      case "equals":
        return plan === rule.value;
      case "in":
        return Array.isArray(rule.value) && rule.value.includes(plan);
      default:
        return false;
    }
  }

  /**
   * Evaluate percentage rule
   */
  private evaluatePercentageRule(rule: TargetingRule, userId: string): boolean {
    const percentage = Number(rule.value);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      return false;
    }
    return this.isInRollout("percentage-rule", userId, percentage);
  }

  /**
   * Evaluate attribute rule
   */
  private evaluateAttributeRule(
    rule: TargetingRule,
    attributes?: Record<string, unknown>
  ): boolean {
    if (!attributes || !rule.value) return false;

    // Expect rule.value to be { key: string, value: unknown }
    const { key, value } = rule.value as { key: string; value: unknown };
    const attributeValue = attributes[key];

    switch (rule.operator) {
      case "equals":
        return attributeValue === value;
      case "contains":
        return String(attributeValue).includes(String(value));
      case "greaterThan":
        return Number(attributeValue) > Number(value);
      case "lessThan":
        return Number(attributeValue) < Number(value);
      default:
        return false;
    }
  }

  /**
   * Determine if user is in rollout percentage
   * Uses consistent hashing for stable assignments
   */
  private isInRollout(
    flagKey: string,
    userId: string,
    percentage: number
  ): boolean {
    // Hash the user ID with flag key for consistent assignment
    const hash = this.hashString(`${flagKey}:${userId}`);
    const bucket = hash % 100;
    return bucket < percentage;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get all registered flags
   */
  getAllFlags(): FeatureFlagConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get flag configuration
   */
  getConfig(flagKey: string): FeatureFlagConfig | undefined {
    return this.configs.get(flagKey);
  }

  /**
   * Update flag configuration
   */
  updateConfig(flagKey: string, updates: Partial<FeatureFlagConfig>): void {
    const existing = this.configs.get(flagKey);
    if (existing) {
      this.configs.set(flagKey, { ...existing, ...updates });
      log.info(`Feature flag updated: ${flagKey}`, { flagKey, updates });
    }
  }

  /**
   * Delete flag configuration
   */
  deleteConfig(flagKey: string): void {
    this.configs.delete(flagKey);
    log.info(`Feature flag deleted: ${flagKey}`, { flagKey });
  }
}

// Singleton instance
export const featureFlagTargeting = new FeatureFlagTargeting();

// Helper functions for common targeting scenarios
export const TargetingHelpers = {
  /**
   * Target specific users by ID
   */
  targetUsers(userIds: string[]): TargetingRule {
    return {
      type: "user",
      operator: "in",
      value: userIds,
    };
  },

  /**
   * Target users by email domain
   */
  targetEmailDomain(domain: string): TargetingRule {
    return {
      type: "email",
      operator: "contains",
      value: `@${domain}`,
    };
  },

  /**
   * Target specific plans
   */
  targetPlans(plans: string[]): TargetingRule {
    return {
      type: "plan",
      operator: "in",
      value: plans,
    };
  },

  /**
   * Target percentage of users
   */
  targetPercentage(percentage: number): TargetingRule {
    return {
      type: "percentage",
      operator: "equals",
      value: percentage,
    };
  },

  /**
   * Target users with specific attribute
   */
  targetAttribute(
    key: string,
    operator: TargetingRule["operator"],
    value: unknown
  ): TargetingRule {
    return {
      type: "attribute",
      operator,
      value: { key, value },
    };
  },
};

// Example configurations
export function registerDefaultFlags(): void {
  featureFlagTargeting.register({
    key: "beta_features",
    enabled: true,
    description: "Enable beta features for testing",
    targeting: [
      TargetingHelpers.targetUsers([
        "beta-tester-1",
        "beta-tester-2",
      ]),
    ],
  });

  featureFlagTargeting.register({
    key: "new_ui",
    enabled: true,
    description: "Gradual rollout of new UI",
    rolloutPercentage: 10, // 10% of users
  });

  featureFlagTargeting.register({
    key: "premium_features",
    enabled: true,
    description: "Premium plan features",
    targeting: [
      TargetingHelpers.targetPlans(["premium", "enterprise"]),
    ],
  });

  featureFlagTargeting.register({
    key: "experimental_ai",
    enabled: true,
    description: "Experimental AI features",
    targeting: [
      TargetingHelpers.targetEmailDomain("company.com"),
    ],
    rolloutPercentage: 50,
  });
}

// Initialize default flags
registerDefaultFlags();

export { featureFlagTargeting as targeting };
