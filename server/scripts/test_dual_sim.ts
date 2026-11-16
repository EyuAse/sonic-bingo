async function sendWithSim(simNum: number) {
  const creds = Buffer.from('H64BX8:xz3-xwau94k9pp').toString('base64');
  const authRes = await fetch('https://api.sms-gate.app/3rdparty/v1/auth/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 3600, scopes: ['messages:send', 'messages:read'] })
  });
  const { access_token } = await authRes.json();

  const payload = {
    textMessage: {
      text: `Lomi Bingo Test: Testing outbound SMS via SIM ${simNum}`
    },
    phoneNumbers: ['+251983624574'],
    deviceId: 'eJPLsrjrfZEWAbyV0lsUY',
    simNumber: simNum,
    withDeliveryReport: false
  };

  console.log(`Sending via SIM ${simNum}...`);
  const res = await fetch('https://api.sms-gate.app/3rdparty/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log(`SIM ${simNum} response:`, data);
  return data;
}

async function main() {
  console.log('--- Testing SIM 1 ---');
  await sendWithSim(1);

  // Wait 3 seconds
  await new Promise(r => setTimeout(r, 3000));

  console.log('--- Testing SIM 2 ---');
  await sendWithSim(2);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

