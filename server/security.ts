import type { Request, Response, NextFunction } from 'express';
import { RequestError } from './bigquery/filters';
import { resolvePrincipal, type IdentityClaims } from './securityPolicy';
import { resolveFirebasePreviewPrincipal } from './firebasePreviewAuth';
export type IdentityVerifier = (jwt: string, audience: string) => Promise<IdentityClaims | undefined>;
const verifyIapIdentity: IdentityVerifier = async (jwt, audience) => {
  const { OAuth2Client } = await import('google-auth-library');
  const auth = new OAuth2Client();
  const { pubkeys } = await auth.getIapPublicKeys();
  const ticket = await auth.verifySignedJwtWithCertsAsync(jwt, pubkeys, audience, ['https://cloud.google.com/iap']);
  return ticket.getPayload();
};
/** Verify signed IAP identity. Never trust unsigned X-Goog-Authenticated-User headers. */
export function authenticate(verifier: IdentityVerifier = verifyIapIdentity) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assertion = req.get('x-goog-iap-jwt-assertion');
      const audience = process.env.IAP_AUDIENCE;
      if (assertion) {
        if (!audience) throw new RequestError('IAP authentication is not configured. Configure IAP_AUDIENCE and CX_ACCESS_POLICY_JSON.', 503);
        if (assertion.length > 16000) throw new RequestError('Invalid identity assertion', 401);
        let claims: IdentityClaims | undefined;
        try { claims = await verifier(assertion, audience); } catch { throw new RequestError('Invalid or expired identity', 401); }
        res.locals.principal = resolvePrincipal(claims, process.env.CX_ACCESS_POLICY_JSON);
        next();
        return;
      }

      // AI Studio Preview has Firebase Authentication but no IAP proxy. Accept a
      // Firebase bearer identity only outside production; Firestore security rules
      // validate the token against the caller's own active access profile.
      const allowFirebasePreview = process.env.NODE_ENV !== 'production' && process.env.CX_ALLOW_FIREBASE_PREVIEW_AUTH !== 'false';
      const authorization = req.get('authorization') || '';
      if (allowFirebasePreview && authorization.startsWith('Bearer ')) {
        res.locals.principal = await resolveFirebasePreviewPrincipal(authorization.slice(7));
        next();
        return;
      }

      if (!audience) throw new RequestError('Authentication is not configured. Configure IAP_AUDIENCE for production or sign in through Firebase in Preview.', 503);
      throw new RequestError('Sign in through the configured identity gateway', 401);
    } catch (error) { next(error); }
  };
}
export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if (res.locals.principal?.role !== 'admin') return next(new RequestError('Administrator access required', 403));
  next();
}
