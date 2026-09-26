import type { Request, Response, NextFunction } from 'express';
import { RequestError } from './bigquery/filters';
import { resolvePrincipal, type IdentityClaims } from './securityPolicy';
import { resolveFirebasePrincipal } from './firebasePreviewAuth';

export type IdentityVerifier = (jwt: string, audience: string) => Promise<IdentityClaims | undefined>;
export type AuthMode = 'iap' | 'firebase';

const verifyIapIdentity: IdentityVerifier = async (jwt, audience) => {
  const { OAuth2Client } = await import('google-auth-library');
  const auth = new OAuth2Client();
  const { pubkeys } = await auth.getIapPublicKeys();
  const ticket = await auth.verifySignedJwtWithCertsAsync(jwt, pubkeys, audience, ['https://cloud.google.com/iap']);
  return ticket.getPayload();
};

/**
 * Production defaults to IAP. Firebase production authentication must be an
 * explicit deployment decision (for example Cloudflare: CX_AUTH_MODE=firebase).
 * Non-production defaults to Firebase so AI Studio Preview can use its signed-in user.
 */
export function configuredAuthMode(env: NodeJS.ProcessEnv = process.env): AuthMode {
  const configured = String(env.CX_AUTH_MODE || '').trim().toLowerCase();
  if (!configured) return env.NODE_ENV === 'production' ? 'iap' : 'firebase';
  if (configured !== 'iap' && configured !== 'firebase') {
    throw new RequestError('CX_AUTH_MODE must be either iap or firebase', 503);
  }
  return configured;
}

/** Verify the explicitly configured identity mode. Never trust unsigned Google identity headers. */
export function authenticate(verifier: IdentityVerifier = verifyIapIdentity) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mode = configuredAuthMode();

      if (mode === 'iap') {
        const audience = process.env.IAP_AUDIENCE;
        if (!audience) throw new RequestError('IAP authentication is not configured. Configure IAP_AUDIENCE and CX_ACCESS_POLICY_JSON.', 503);
        const assertion = req.get('x-goog-iap-jwt-assertion');
        if (!assertion || assertion.length > 16000) throw new RequestError('Sign in through the configured identity gateway', 401);
        let claims: IdentityClaims | undefined;
        try { claims = await verifier(assertion, audience); } catch { throw new RequestError('Invalid or expired identity', 401); }
        res.locals.principal = resolvePrincipal(claims, process.env.CX_ACCESS_POLICY_JSON);
        next();
        return;
      }

      const authorization = req.get('authorization') || '';
      if (!authorization.startsWith('Bearer ')) {
        throw new RequestError('Sign in with Google before accessing this workspace', 401);
      }
      res.locals.principal = await resolveFirebasePrincipal(authorization.slice(7));
      next();
    } catch (error) { next(error); }
  };
}

export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if (res.locals.principal?.role !== 'admin') return next(new RequestError('Administrator access required', 403));
  next();
}
