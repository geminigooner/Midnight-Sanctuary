import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'const [authLoading, setAuthLoading] = useState(true);',
  'const [authLoading, setAuthLoading] = useState(true);\n  const [authError, setAuthError] = useState<string | null>(null);'
);

code = code.replace(
  /const handleSignIn = async \(\) => \{\n    try \{\n      await signInWithPopup\(auth, googleProvider\);\n    \} catch \(error\) \{\n      console\.error\('Error signing in:', error\);\n    \}\n  \};/g,
  `const handleSignIn = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Error signing in:', error);
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError("This domain isn't authorized in Firebase yet. I'll need you to add it to the allowlist.");
      } else {
        setAuthError(error.message || "Failed to sign in. The popup might have been blocked.");
      }
    }
  };`
);

const errorDisplay = `{authError && <div className="text-red-400 text-sm mb-4 max-w-sm">{authError}</div>}`;
code = code.replace(
  '<p className="text-mauve mb-8">Please sign in to access your sanctuary.</p>',
  `<p className="text-mauve mb-8">Please sign in to access your sanctuary.</p>\n          ${errorDisplay}`
);

fs.writeFileSync('src/App.tsx', code);
