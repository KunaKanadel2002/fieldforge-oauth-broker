/**
 * WHAT: Refreshes an expired access token using refresh token
 * HOW:  POST /api/refresh with { refreshToken, instanceUrl }
 * WHY:  Called by FieldForge LWC when access token expires
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { refreshToken, instanceUrl } = req.body;
  
  if (!refreshToken || !instanceUrl) {
    return res.status(400).json({ error: 'Missing refreshToken or instanceUrl' });
  }
  
  try {
    // Extract base login URL from instanceUrl
    const loginUrl = instanceUrl.includes('sandbox') || instanceUrl.includes('test')
      ? 'https://test.salesforce.com'
      : 'https://login.salesforce.com';
    
    const tokenResponse = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.SALESFORCE_CLIENT_ID,
        client_secret: process.env.SALESFORCE_CLIENT_SECRET
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token refresh failed: ${errorText}`);
    }
    
    const tokens = await tokenResponse.json();
    
    res.status(200).json({
      accessToken: tokens.access_token,
      instanceUrl: tokens.instance_url
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Token refresh failed', 
      details: error.message 
    });
  }
}