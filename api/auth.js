/**
 * WHAT: Initiates OAuth flow to Salesforce
 * HOW:  /api/auth?type=production&state=RANDOM
 * WHY:  Generates PKCE parameters, redirects to Salesforce login
 */

import crypto from 'crypto';

export default async function handler(req, res) {
  const { type, state } = req.query;
  
  // Determine login URL
  const loginUrl = type === 'sandbox' 
    ? 'https://test.salesforce.com'
    : 'https://login.salesforce.com';
  
  // Generate PKCE code_verifier
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  
  // Generate code_challenge from code_verifier
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  // Store code_verifier in state parameter (we'll need it in callback)
  // Format: originalState|codeVerifier
  const stateWithVerifier = `${state || 'default'}|${codeVerifier}`;
  
  // Build OAuth URL
 const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SALESFORCE_CLIENT_ID,
    redirect_uri: 'https://fieldforge-oauth-broker.vercel.app/api/callback', // NEW - HARDCODED
    scope: 'full api refresh_token',
    state: stateWithVerifier,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'login'
});
  
  const authUrl = `${loginUrl}/services/oauth2/authorize?${params.toString()}`;
  
  // Redirect to Salesforce login
  res.redirect(authUrl);
}
