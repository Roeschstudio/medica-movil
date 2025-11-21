import { PaymentProviderType } from "../types";

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  conditions?: FeatureFlagCondition[];
  metadata?: Record<string, any>;
}

export interface FeatureFlagCondition {
  type: "user_id" | "email" | "country" | "user_agent" | "custom";
  operator:
    | "equals"
    | "contains"
    | "starts_with"
    | "ends_with"
    | "in"
    | "not_in";
  value: string | string[];
}

export interface FeatureFlagContext {
  userId?: string;
  email?: string;
  country?: string;
  userAgent?: string;
  custom?: Record<string, any>;
}

export class FeatureFlags {
  private static flags: Map<string, FeatureFlag> = new Map();
  private static initialized = false;

  /**
   * Initialize feature flags with default payment provider flags
   */
  static initialize(): void {
    if (this.initialized) return;

    // Payment provider feature flags
    this.setFlag("payment_provider_paypal", {
      name: "payment_provider_paypal",
      enabled: true,
      rolloutPercentage: 100,
      metadata: {
        description: "Enable PayPal payment provider",
        provider: "paypal",
      },
    });

    this.setFlag("payment_provider_mercadopago", {
      name: "payment_provider_mercadopago",
      enabled: true,
      rolloutPercentage: 100,
      metadata: {
        description: "Enable MercadoPago payment provider",
        provider: "mercadopago",
      },
    });

    this.setFlag("payment_provider_stripe", {
      name: "payment_provider_stripe",
      enabled: true,
      rolloutPercentage: 100,
      metadata: {
        description: "Enable Stripe payment provider",
        provider: "stripe",
      },
    });

    // A/B testing flags
    this.setFlag("payment_method_selector_v2", {
      name: "payment_method_selector_v2",
      enabled: false,
      rolloutPercentage: 0,
      metadata: {
        description: "New payment method selector UI",
        experiment: "payment_ui_v2",
      },
    });

    this.setFlag("payment_retry_logic", {
      name: "payment_retry_logic",
      enabled: true,
      rolloutPercentage: 50,
      metadata: {
        description: "Enhanced payment retry logic",
      },
    });

    this.setFlag("payment_monitoring_enhanced", {
      name: "payment_monitoring_enhanced",
      enabled: true,
      rolloutPercentage: 100,
      metadata: {
        description: "Enhanced payment monitoring and logging",
      },
    });

    // Provider-specific feature flags
    this.setFlag("mercadopago_oxxo_payments", {
      name: "mercadopago_oxxo_payments",
      enabled: true,
      rolloutPercentage: 100,
      conditions: [
        {
          type: "country",
          operator: "equals",
          value: "MX",
        },
      ],
      metadata: {
        description: "Enable OXXO payments through MercadoPago",
        provider: "mercadopago",
      },
    });

    this.setFlag("paypal_express_checkout", {
      name: "paypal_express_checkout",
      enabled: false,
      rolloutPercentage: 25,
      metadata: {
        description: "PayPal Express Checkout integration",
        provider: "paypal",
      },
    });

    this.initialized = true;
  }

  /**
   * Check if a feature flag is enabled for a given context
   */
  static isEnabled(flagName: string, context?: FeatureFlagContext): boolean {
    this.initialize();

    const flag = this.flags.get(flagName);
    if (!flag) {
      console.warn(`Feature flag '${flagName}' not found`);
      return false;
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return false;
    }

    // Check conditions
    if (flag.conditions && !this.evaluateConditions(flag.conditions, context)) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const hash = this.hashContext(flagName, context);
      const percentage = hash % 100;
      return percentage < flag.rolloutPercentage;
    }

    return true;
  }

  /**
   * Check if a payment provider is enabled
   */
  static isPaymentProviderEnabled(
    provider: PaymentProviderType,
    context?: FeatureFlagContext
  ): boolean {
    return this.isEnabled(`payment_provider_${provider}`, context);
  }

  /**
   * Get all enabled payment providers for a context
   */
  static getEnabledPaymentProviders(
    context?: FeatureFlagContext
  ): PaymentProviderType[] {
    const providers: PaymentProviderType[] = [
      "stripe",
      "paypal",
      "mercadopago",
    ];
    return providers.filter((provider) =>
      this.isPaymentProviderEnabled(provider, context)
    );
  }

  /**
   * Set or update a feature flag
   */
  static setFlag(name: string, flag: FeatureFlag): void {
    this.flags.set(name, { ...flag, name });
  }

  /**
   * Get a feature flag
   */
  static getFlag(name: string): FeatureFlag | undefined {
    return this.flags.get(name);
  }

  /**
   * Get all feature flags
   */
  static getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Update flag rollout percentage
   */
  static updateRolloutPercentage(
    flagName: string,
    percentage: number
  ): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    if (percentage < 0 || percentage > 100) {
      throw new Error("Rollout percentage must be between 0 and 100");
    }

    flag.rolloutPercentage = percentage;
    return true;
  }

  /**
   * Enable or disable a feature flag
   */
  static toggleFlag(flagName: string, enabled: boolean): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    flag.enabled = enabled;
    return true;
  }

  /**
   * A/B testing: get variant for a user
   */
  static getVariant(
    experimentName: string,
    context?: FeatureFlagContext
  ): "A" | "B" {
    const hash = this.hashContext(experimentName, context);
    return hash % 2 === 0 ? "A" : "B";
  }

  /**
   * Get feature flag status for monitoring
   */
  static getFeatureFlagStatus(): {
    total: number;
    enabled: number;
    disabled: number;
    byProvider: Record<string, { enabled: boolean; rollout: number }>;
  } {
    const flags = this.getAllFlags();
    const status = {
      total: flags.length,
      enabled: flags.filter((f) => f.enabled).length,
      disabled: flags.filter((f) => !f.enabled).length,
      byProvider: {} as Record<string, { enabled: boolean; rollout: number }>,
    };

    // Get provider-specific flags
    const providerFlags = flags.filter((f) =>
      f.name.startsWith("payment_provider_")
    );
    for (const flag of providerFlags) {
      const provider = flag.metadata?.provider;
      if (provider) {
        status.byProvider[provider] = {
          enabled: flag.enabled,
          rollout: flag.rolloutPercentage,
        };
      }
    }

    return status;
  }

  /**
   * Gradual rollout: increase rollout percentage gradually
   */
  static async gradualRollout(
    flagName: string,
    targetPercentage: number,
    incrementPercentage: number = 10,
    intervalMs: number = 60000 // 1 minute
  ): Promise<void> {
    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Feature flag '${flagName}' not found`);
    }

    if (targetPercentage < flag.rolloutPercentage) {
      throw new Error(
        "Target percentage must be greater than current rollout percentage"
      );
    }

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const currentPercentage = flag.rolloutPercentage;
        const nextPercentage = Math.min(
          currentPercentage + incrementPercentage,
          targetPercentage
        );

        flag.rolloutPercentage = nextPercentage;
        console.log(
          `Feature flag '${flagName}' rolled out to ${nextPercentage}%`
        );

        if (nextPercentage >= targetPercentage) {
          clearInterval(interval);
          resolve();
        }
      }, intervalMs);
    });
  }

  /**
   * Emergency rollback: disable a feature flag immediately
   */
  static emergencyRollback(flagName: string, reason?: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    flag.enabled = false;
    flag.rolloutPercentage = 0;

    console.warn(
      `Emergency rollback for feature flag '${flagName}': ${
        reason || "No reason provided"
      }`
    );

    // Log rollback event
    this.logFeatureFlagEvent("rollback", flagName, { reason });

    return true;
  }

  /**
   * Provider availability monitoring
   */
  static monitorProviderAvailability(): {
    stripe: boolean;
    paypal: boolean;
    mercadopago: boolean;
  } {
    return {
      stripe: this.isEnabled("payment_provider_stripe"),
      paypal: this.isEnabled("payment_provider_paypal"),
      mercadopago: this.isEnabled("payment_provider_mercadopago"),
    };
  }

  /**
   * Create rollback procedure for payment provider issues
   */
  static createProviderRollbackProcedure(provider: PaymentProviderType) {
    return {
      disable: () => this.toggleFlag(`payment_provider_${provider}`, false),
      enable: () => this.toggleFlag(`payment_provider_${provider}`, true),
      gradualEnable: (targetPercentage: number) =>
        this.gradualRollout(`payment_provider_${provider}`, targetPercentage),
      emergencyDisable: (reason: string) =>
        this.emergencyRollback(`payment_provider_${provider}`, reason),
    };
  }

  private static evaluateConditions(
    conditions: FeatureFlagCondition[],
    context?: FeatureFlagContext
  ): boolean {
    if (!context) return false;

    return conditions.every((condition) => {
      const contextValue = this.getContextValue(condition.type, context);
      if (contextValue === undefined) return false;

      return this.evaluateCondition(condition, contextValue);
    });
  }

  private static getContextValue(
    type: string,
    context: FeatureFlagContext
  ): any {
    switch (type) {
      case "user_id":
        return context.userId;
      case "email":
        return context.email;
      case "country":
        return context.country;
      case "user_agent":
        return context.userAgent;
      case "custom":
        return context.custom;
      default:
        return undefined;
    }
  }

  private static evaluateCondition(
    condition: FeatureFlagCondition,
    value: any
  ): boolean {
    const { operator, value: conditionValue } = condition;

    switch (operator) {
      case "equals":
        return value === conditionValue;
      case "contains":
        return (
          typeof value === "string" && value.includes(conditionValue as string)
        );
      case "starts_with":
        return (
          typeof value === "string" &&
          value.startsWith(conditionValue as string)
        );
      case "ends_with":
        return (
          typeof value === "string" && value.endsWith(conditionValue as string)
        );
      case "in":
        return Array.isArray(conditionValue) && conditionValue.includes(value);
      case "not_in":
        return Array.isArray(conditionValue) && !conditionValue.includes(value);
      default:
        return false;
    }
  }

  private static hashContext(
    key: string,
    context?: FeatureFlagContext
  ): number {
    const contextString = JSON.stringify({
      key,
      userId: context?.userId || "anonymous",
      email: context?.email || "",
    });

    let hash = 0;
    for (let i = 0; i < contextString.length; i++) {
      const char = contextString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash);
  }

  private static logFeatureFlagEvent(
    event: "enable" | "disable" | "rollout" | "rollback",
    flagName: string,
    metadata?: Record<string, any>
  ): void {
    console.log(`Feature flag event: ${event} - ${flagName}`, metadata);

    // In a real implementation, you might want to send this to a logging service
    // or store it in a database for audit purposes
  }
}
