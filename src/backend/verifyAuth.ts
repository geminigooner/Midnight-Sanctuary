import firebaseConfig from '../../firebase-applet-config.json';

export interface VerifiedAuthResult {
  valid: boolean;
  uid?: string;
  email?: string;
  idToken?: string;
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

    // Check if it's strictly you
    if (user.email === 'ahatley094@gmail.com') {
      return {
        valid: true,
        uid: user.localId,
        email: user.email,
        idToken: token,
      };
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
