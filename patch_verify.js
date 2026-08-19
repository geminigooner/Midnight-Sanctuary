import fs from 'fs';

const code = `import firebaseConfig from '../../firebase-applet-config.json';

export async function verifyRequest(req: any): Promise<boolean> {
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
      console.error("verifyAuth: No Bearer token found in headers.");
      return false;
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      console.error("verifyAuth: Token string is empty.");
      return false;
    }

    // Verify token securely using Firebase Identity Toolkit REST API
    const response = await fetch(\`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=\${firebaseConfig.apiKey}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });

    if (!response.ok) {
      console.error("verifyAuth: Token verification failed.", await response.text());
      return false;
    }

    const data = await response.json();
    if (!data.users || data.users.length === 0) {
      console.error("verifyAuth: No user data returned for token.");
      return false;
    }

    const user = data.users[0];
    
    // Check if it's strictly you
    if (user.email === 'ahatley094@gmail.com') {
      return true;
    }

    console.error("verifyAuth: Intruder alert. Blocked email:", user.email);
    return false;
  } catch (error) {
    console.error("Auth verification error:", error);
    return false;
  }
}
`;

fs.writeFileSync('src/backend/verifyAuth.ts', code);
