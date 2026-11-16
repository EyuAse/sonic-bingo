async function main() {
  const creds = Buffer.from('H64BX8:xz3-xwau94k9pp').toString('base64');
  const authRes = await fetch('https://api.sms-gate.app/3rdparty/v1/auth/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 3600, scopes: ['messages:read'] })
  });
  const data: any = await authRes.json();
  const token = data.access_token || data.token;

  const msgRes = await fetch('https://api.sms-gate.app/3rdparty/v1/messages/LE8iK5GMAlG9tGKlN5BQt', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const msgData: any = await msgRes.json();
  console.log('SAMSUNG MSG STATUS:', JSON.stringify(msgData, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
