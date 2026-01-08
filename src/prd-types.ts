/**
 * PRD types (shared with MCP server)
 * Simplified version for CLI validation
 */

export type PrdAnswers = {
  product_name: string;
  goal: string[];
  consumers: string[];
  grain: string;
  entities: Array<{ name: string; id: string }>;
  primary_time: { field: string; timezone?: string; meaning?: string };
  dimensions: string[];
  measures: Array<{ name: string; definition?: string; unit?: string }>;
  metrics: Array<{ name: string; definition: string; formula?: string }>;
  sources: Array<{ system: string; table?: string; owner?: string; notes?: string }>;
  freshness_backfill: {
    cadence: string;
    sla?: string;
    backfill_window?: string;
  };
};

export interface ValidationResult {
  ok: boolean;
  missing: string[];
  errors: Array<{ field: string; message: string }>;
}

export function validateAnswers(a: Partial<PrdAnswers>): ValidationResult {
  const missing: string[] = [];
  const errors: Array<{ field: string; message: string }> = [];
  
  const required: (keyof PrdAnswers)[] = [
    "product_name",
    "goal",
    "consumers",
    "grain",
    "entities",
    "primary_time",
    "dimensions",
    "measures",
    "metrics",
    "sources",
    "freshness_backfill",
  ];

  for (const key of required) {
    const value = a[key];
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      missing.push(key);
    }
  }

  // Basic nested validation
  if (a.entities) {
    a.entities.forEach((entity, index) => {
      if (!entity.name || !entity.id) {
        errors.push({
          field: `entities[${index}]`,
          message: `Entity at index ${index} must have both 'name' and 'id' fields`,
        });
      }
    });
  }

  if (a.primary_time && !a.primary_time.field) {
    errors.push({
      field: "primary_time.field",
      message: "Primary time must have a 'field' property",
    });
  }

  if (a.freshness_backfill && !a.freshness_backfill.cadence) {
    errors.push({
      field: "freshness_backfill.cadence",
      message: "Freshness/backfill must have a 'cadence' field",
    });
  }

  return {
    ok: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

