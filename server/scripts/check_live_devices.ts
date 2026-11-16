async function main() {
  try {
    const creds = Buffer.from('H64BX8:xz3-xwau94k9pp').toString('base64');
    const authRes = await fetch('https://api.sms-gate.app/3rdparty/v1/auth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ttl: 3600,
        scopes: ['devices:list', 'messages:send', 'messages:read']
      })
    });

    console.log('Auth status:', authRes.status);
    const authData: any = await authRes.json();
    const token = authData.access_token || authData.token;
    if (!token) {
      console.log('Auth error:', authData);
      process.exit(1);
    }

    const devRes = await fetch('https://api.sms-gate.app/3rdparty/v1/devices', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Devices status:', devRes.status);
    const devices = await devRes.json();
    console.log('LIVE CONNECTED DEVICES:', JSON.stringify(devices, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
