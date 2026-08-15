import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
  // Y1.5 recurrence guard: a Prisma Decimal field ('*Price'/'*Snapshot'/
  // 'unitCost') arrives as a *string* in production (Postgres) even though
  // it types as `number` in src/types/index.ts, so `x + wireValue.dayPrice`
  // string-concatenates instead of adding — the exact bug Y1 fixed. This
  // only fires on a member expression used directly as an operand of `+`;
  // route/library code that first runs the field through toNumber()/
  // toNumberOrNull() (from src/lib/serialize.ts) is unaffected, since the
  // coerced value is then a plain identifier, not a member expression.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/lib/serialize.ts", "src/lib/serialize.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "BinaryExpression[operator='+'] > MemberExpression.left[property.name=/(Price|Snapshot|Cost)$/]",
          message:
            "Do not '+' a money field straight off a wire/Prisma object — convert with toNumber()/toNumberOrNull() from '@/lib/serialize' first (see the money rule in CLAUDE.md).",
        },
        {
          selector:
            "BinaryExpression[operator='+'] > MemberExpression.right[property.name=/(Price|Snapshot|Cost)$/]",
          message:
            "Do not '+' a money field straight off a wire/Prisma object — convert with toNumber()/toNumberOrNull() from '@/lib/serialize' first (see the money rule in CLAUDE.md).",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
