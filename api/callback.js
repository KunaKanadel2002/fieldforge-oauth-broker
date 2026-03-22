/**
 * WHAT: OAuth callback — exchanges code for tokens
 * HOW:  Salesforce redirects here with ?code=XXX&state=YYY
 * WHY:  Exchange code for tokens, render HTML that posts tokens to parent window
 */

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;
  
  // Handle OAuth errors
  if (error) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>FieldForge OAuth - Error</title>
        <style>
          body { font-family: system-ui; padding: 40px; text-align: center; background: #0a0e1a; color: white; }
          .error { color: #ef4444; background: rgba(239,68,68,0.1); padding: 20px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h2>❌ Authorization Failed</h2>
          <p>${error_description || error}</p>
        </div>
        <script>
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({
              type: 'FIELDFORGE_OAUTH_ERROR',
              error: '${error_description || error}'
            }, '*');
          }
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
      </html>
    `);
  }
  
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  
  try {
    // Extract originalState and codeVerifier from state parameter
    const [originalState, codeVerifier] = (state || '|').split('|');
    
    // Determine token endpoint (production vs sandbox)
    const loginUrl = originalState.includes('sandbox')
      ? 'https://test.salesforce.com'
      : 'https://login.salesforce.com';
    
    // Exchange code for tokens
    const tokenResponse = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    client_id: process.env.SALESFORCE_CLIENT_ID,
    client_secret: process.env.SALESFORCE_CLIENT_SECRET,
    redirect_uri: 'https://fieldforge-oauth-broker.vercel.app/api/callback', // NEW - HARDCODED
    code_verifier: codeVerifier
})
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }
    
    const tokens = await tokenResponse.json();
    
    // Fetch org identity
    const identityResponse = await fetch(tokens.id, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });
    
    const identity = await identityResponse.json();
    
    // Build org data object
    const orgData = {
      orgId: identity.organization_id,
      orgName: identity.display_name,
      username: identity.username,
      instanceUrl: tokens.instance_url,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      orgType: loginUrl.includes('test.salesforce.com') ? 'Sandbox' : 'Production'
    };
    
    // Render success page that posts tokens to parent window
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>FieldForge OAuth - Success</title>
        <style>
          body { 
            font-family: system-ui; 
            padding: 40px; 
            text-align: center; 
            background: linear-gradient(135deg, #0a0e1a 0%, #1e293b 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 40px;
            backdrop-filter: blur(10px);
          }
          .success { color: #10b981; font-size: 48px; margin-bottom: 16px; }
          h2 { margin: 0 0 8px 0; }
          p { color: rgba(255,255,255,0.7); margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="success">✅</div>
          <h2>Connected Successfully!</h2>
          <p>Org: ${orgData.orgName}</p>
          <p>This window will close automatically...</p>
        </div>
        <script>
          const orgData = ${JSON.stringify(orgData)};
          
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({
              type: 'FIELDFORGE_OAUTH_SUCCESS',
              org: orgData
            }, '*');
            
            setTimeout(() => window.close(), 1500);
          } else {
            document.querySelector('.card p:last-child').textContent = 
              'Please close this window and return to FieldForge.';
          }
        </script>
      </body>
      </html>
    `);
    
  } catch (error) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body>
        <h2>Token Exchange Failed</h2>
        <p>${error.message}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'FIELDFORGE_OAUTH_ERROR',
              error: '${error.message}'
            }, '*');
          }
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
      </html>
    `);
  }
}
