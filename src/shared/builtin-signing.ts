// Pinned Ed25519 public keys for built-in plugin update verification.
// Built-in updates MUST be signed by one of these keys (2-slot rotation
// array; see docs/superpowers/specs/2026-07-11-plugin-distribution-design.md).
// NEVER runtime-configurable.
export const BUILTIN_SIGNING_PUBKEYS: ReadonlyArray<string> = [
  `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAbS8nPYBhcFxK+HHlrXkn6cIiXbqFAlAw/yf1Mj5PXas=
-----END PUBLIC KEY-----
`,
]
