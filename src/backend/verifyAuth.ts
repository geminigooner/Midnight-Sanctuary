import firebaseConfig from '../../firebase-applet-config.json';

export async function verifyRequest(req: any): Promise<boolean> {
  try {
    // Handle both Web Request (Netlify) and Express Request (server.ts)
    let authHeader = '';
    if (typeof req.headers?.get === 'function') {
      authHeader = req.headers.get('Authorization') || '';
    } else if (req.headers?.authorization) {
      authHeader = req.headers.authorization;
    } else if (req.headers?.Authorization) {
      authHeader = req.headers.Authorization;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) return false;

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (!response.ok) {
      return false;
    }

    const payload = await response.json();

    const isEmailValid = payload.email === 'ahatley094@gmail.com';
    const isEmailVerified = payload.email_verified === true || payload.email_verified === "true";
    const isAudValid = payload.aud === firebaseConfig.projectId;

    if (isEmailValid && isEmailVerified && isAudValid) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Auth verification error:", error);
    return false;
  }
}
