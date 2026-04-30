import fs from "node:fs";

export function validateJsonOutput(output, schemaPath) {
  let value;
  let schema;
  try {
    value = JSON.parse(output);
  } catch (error) {
    return { valid: false, errors: [`output is not valid JSON: ${error.message}`], value: null };
  }
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  } catch (error) {
    return { valid: false, errors: [`schema could not be read: ${error.message}`], value };
  }
  const errors = validateAgainstSchema(value, schema, "$");
  return { valid: errors.length === 0, errors, value };
}

function validateAgainstSchema(value, schema, path) {
  const errors = [];
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${path} expected ${schema.type}`);
    return errors;
  }
  if (schema.type === "object" && value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required ?? []) {
      if (!(key in value)) {
        errors.push(`${path}.${key} is required`);
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          errors.push(`${path}.${key} is not allowed`);
        }
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in value) {
        errors.push(...validateAgainstSchema(value[key], childSchema, `${path}.${key}`));
      }
    }
  }
  return errors;
}

function matchesType(value, type) {
  switch (type) {
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return true;
  }
}
