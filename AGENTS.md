UPPERCASE for constants and pure functions.

type EVERYTHING. avoid `any` or `unknown` at all costs. use `// @ts-expect-error if needed explanation`.

DO NOT cast types. never use `as Type`, `as any`, if you encounter type errors fix them properly by: regenerating supabase types, using type guards or narrowing instead of casting.

prefer `if-else if` chains instead of multiple `if` when conditions are mutually exclusive.

prefer `for-of` loops over `.map()`, `.filter()`, `.reduce()` when there are many conditions or complex logic, only use them for REALLY simple transformations.

prefer object bracket notation over dot notation on JSON objects or external data.

prefer named functions over arrow/lambda, unless the body needs `this`.

DO NOT EVER use IIFE in jsx. instead compute variables in the component body before return.

let typescript infer the return type of functions.

do not create unnecessary abstraction layers, if a function is only used once, just inline it.