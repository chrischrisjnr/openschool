/** Demo mode shows one-click demo logins and seeded data. Set DEMO_MODE=false in production. */
export function demoModeEnabled(): boolean {
  return process.env.DEMO_MODE !== "false";
}
