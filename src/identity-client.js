// Browser-only auth flow helpers, bundled by esbuild during the Netlify build.
// Netlify Identity is the authority for invitation and password recovery.
import { handleAuthCallback, acceptInvite, updateUser, requestPasswordRecovery } from '@netlify/identity';
window.GSIdentity = { handleAuthCallback, acceptInvite, updateUser, requestPasswordRecovery };
