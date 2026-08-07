export type SensitiveDataCategory = "personal" | "financial" | "credential" | "corporate";

export interface SensitiveDataFinding {
  category: SensitiveDataCategory;
  label: string;
  excerpt: string;
}

export function scanSensitiveData(text: string): SensitiveDataFinding[] {
  const findings: SensitiveDataFinding[] = [];
  const seen = new Set<string>();
  const matchedRanges: Array<{ start: number; end: number }> = [];
  const patterns: Array<{
    category: SensitiveDataCategory;
    label: string;
    expression: RegExp;
    validate?: (value: string) => boolean;
  }> = [
    {
      category: "financial",
      label: "IBAN",
      expression: /\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){11,30}\b/gi,
      validate: (value) => {
        const compact = value.replace(/[\s-]/g, "").toUpperCase();
        if (compact.length < 15 || compact.length > 34) {
          return false;
        }
        const rearranged = compact.slice(4) + compact.slice(0, 4);
        let remainder = 0;
        for (const character of rearranged) {
          const numeric = /[A-Z]/.test(character)
            ? String(character.charCodeAt(0) - 55)
            : character;
          for (const digit of numeric) {
            remainder = (remainder * 10 + Number(digit)) % 97;
          }
        }
        return remainder === 1;
      }
    },
    {
      category: "financial",
      label: "Payment card number",
      expression: /\b(?:\d[ -]*?){13,19}\b/g,
      validate: (value) => {
        const digits = value.replace(/\D/g, "");
        if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) {
          return false;
        }
        let sum = 0;
        let doubleDigit = false;
        for (let index = digits.length - 1; index >= 0; index -= 1) {
          let digit = Number(digits[index]);
          if (doubleDigit) {
            digit *= 2;
            if (digit > 9) {
              digit -= 9;
            }
          }
          sum += digit;
          doubleDigit = !doubleDigit;
        }
        return sum % 10 === 0;
      }
    },
    {
      category: "personal",
      label: "Email address",
      expression: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
    },
    {
      category: "personal",
      label: "Phone number",
      expression: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}\b/g,
      validate: (value) => {
        const digits = value.replace(/\D/g, "");
        const groups = value.trim().replace(/^\+/, "").split(/[\s.-]+/);
        return (
          digits.length >= 7 &&
          digits.length <= 15 &&
          !(groups.length >= 3 && groups.every((group) => group.length === 4))
        );
      }
    },
    {
      category: "personal",
      label: "US Social Security number",
      expression: /\b\d{3}-\d{2}-\d{4}\b/g
    },
    {
      category: "personal",
      label: "Italian tax code",
      expression: /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi
    },
    {
      category: "credential",
      label: "Private key",
      expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi
    },
    {
      category: "credential",
      label: "API key or access token",
      expression: /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g
    },
    {
      category: "credential",
      label: "Password or secret",
      expression: /\b(?:password|passwd|pwd|secret|client[_ -]?secret|access[_ -]?token|api[_ -]?key)\s*[:=]\s*[^\s,;]{4,}/gi
    },
    {
      category: "corporate",
      label: "Confidential business information",
      expression: /\b(?:confidential|strictly confidential|internal use only|company confidential|trade secret|do not distribute|NDA protected)\b/gi
    }
  ];

  const mask = (value: string): string => {
    const compact = value.replace(/\s+/g, " ").trim();
    if (compact.length <= 6) {
      return `${compact.slice(0, 1)}***`;
    }
    return `${compact.slice(0, 3)}***${compact.slice(-2)}`;
  };

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.expression)) {
      const value = match[0];
      const start = match.index ?? 0;
      const end = start + value.length;
      if (
        (pattern.validate && !pattern.validate(value)) ||
        matchedRanges.some((range) => start < range.end && end > range.start)
      ) {
        continue;
      }
      const key = `${pattern.label}:${value.toLowerCase()}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      matchedRanges.push({ start, end });
      findings.push({
        category: pattern.category,
        label: pattern.label,
        excerpt: mask(value)
      });
      if (findings.length >= 12) {
        return findings;
      }
    }
  }

  return findings;
}
