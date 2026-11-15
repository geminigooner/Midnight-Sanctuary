import firebaseConfig from '../../firebase-applet-config.json';

export interface VerifiedAuthResult {
  valid: boolean;
  uid?: string;
  email?: string;
  idToken?: string;
}

interface CachedTokenEntry {
  result: VerifiedAuthResult;
  expiresAt: number;
}

/**
 * Bounded LRU Verified Token Cache (W-05 Fix):
 * Avoids hitting Firebase Identity Toolkit `accounts:lookup` on every single
 * `/api/chat`, `/api/embed`, `/api/image`, and `/api/music` request while
 * bounding cache residency to 5 minutes and 100 entries.
 */
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
const TOKEN_CACHE_MAX_ENTRIES = 100;
const verifiedTokenCache = new Map<string, CachedTokenEntry>();

function getAuthorizedOwnerEmails(): Set<string> {
  const raw = process.env.OWNER_EMAIL || 'ahatley094@gmail.com';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getCachedVerification(token: string): VerifiedAuthResult | null {
  const entry = verifiedTokenCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    verifiedTokenCache.delete(token);
    return null;
  }
  // Refresh LRU order
  verifiedTokenCache.delete(token);
  verifiedTokenCache.set(token, entry);
  return entry.result;
}

function setCachedVerification(token: string, result: VerifiedAuthResult): void {
  if (verifiedTokenCache.size >= TOKEN_CACHE_MAX_ENTRIES) {
    const oldestKey = verifiedTokenCache.keys().next().value;
    if (oldestKey) {
      verifiedTokenCache.delete(oldestKey);
    }
  }
  verifiedTokenCache.set(token, {
    result,
    expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
  });
}

export function clearVerifiedTokenCache(): void {
  verifiedTokenCache.clear();
}

export async function verifyRequestWithUser(req: any): Promise<VerifiedAuthResult> {
  try {
    let authHeader = '';
    if (typeof req.headers?.get === 'function') {
      authHeader = req.headers.get('Authorization') || '';
    } else if (req.headers?.authorization) {
      authHeader = req.headers.authorization;
    } else if (req.headers?.Authorization) {
      authHeader = req.headers.Authorization;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('verifyAuth: No Bearer token found in headers.');
      return { valid: false };
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      console.error('verifyAuth: Token string is empty.');
      return { valid: false };
    }

    const cached = getCachedVerification(token);
    if (cached) {
      return cached;
    }

    // Verify token securely using Firebase Identity Toolkit REST API
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );

    if (!response.ok) {
      console.error('verifyAuth: Token verification failed.', await response.text());
      return { valid: false };
    }

    const data = await response.json();
    if (!data.users || data.users.length === 0) {
      console.error('verifyAuth: No user data returned for token.');
      return { valid: false };
    }

    const user = data.users[0];
    const authorizedEmails = getAuthorizedOwnerEmails();

    if (user.email && authorizedEmails.has(String(user.email).toLowerCase())) {
      const verifiedResult: VerifiedAuthResult = {
        valid: true,
        uid: user.localId,
        email: user.email,
        idToken: token,
      };
      setCachedVerification(token, verifiedResult);
      return verifiedResult;
    }

    console.error('verifyAuth: Intruder alert. Blocked email:', user.email);
    return { valid: false };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { valid: false };
  }
}

export async function verifyRequest(req: any): Promise<boolean> {
  const result = await verifyRequestWithUser(req);
  return result.valid;
}
