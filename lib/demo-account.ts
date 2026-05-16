/** Compte démo (review App Store, tests). Configurer via variables d'environnement. */

export function isDemoLoginEnabled(): boolean {
  return (
    process.env.DEMO_LOGIN_ENABLED === 'true' ||
    process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED === 'true'
  );
}

export function isDemoLoginButtonVisible(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED === 'true';
}

export function getDemoCredentials() {
  return {
    email: (process.env.DEMO_EMAIL || 'demo@legrinpo.com').trim(),
    password: (process.env.DEMO_PASSWORD || 'DemoLegrinpo2026!').trim(),
    username: (process.env.DEMO_USERNAME || 'DemoReview').trim(),
  };
}
