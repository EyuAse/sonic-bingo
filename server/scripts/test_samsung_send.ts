async function main() {
  const creds = Buffer.from('H64BX8:xz3-xwau94k9pp').toString('base64');
  const authRes = await fetch('https://api.sms-gate.app/3rdparty/v1/auth/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 3600, scopes: ['messages:send', 'messages:read'] })
  });
  const authData: any = await authRes.json();
  const token = authData.access_token || authData.token;

  console.log('📡 Sending test SMS via Samsung M32 (ESaA5CZGgXG4dSwaEueMN)...');
  const sendRes = await fetch('https://api.sms-gate.app/3rdparty/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      textMessage: {
        text: 'Lomi Bingo Test: Outbound SMS from Samsung M32 agent!'
      },
      phoneNumbers: ['+251983624574'],
      deviceId: 'ESaA5CZGgXG4dSwaEueMN',
      withDeliveryReport: false
    })
  });

  const sendData: any = await sendRes.json();
  console.log('📤 Dispatch response:', sendData);

  if (!sendData.id) {
    console.error('Failed to dispatch message');
    process.exit(1);
  }

  // Poll state for up to 8 seconds
  console.log('⏳ Waiting for Samsung device to process message...');
  for (let i = 0; i < 4; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const checkRes = await fetch(`https://api.sms-gate.app/3rdparty/v1/messages/${sendData.id}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const checkData: any = await checkRes.json();
    console.log(`[Attempt ${i + 1}] State: ${checkData.state}`);
    if (checkData.state !== 'Pending') {
      console.log('FINAL MESSAGE STATUS:', JSON.stringify(checkData, null, 2));
      process.exit(0);
    }
  }

  console.log('Message is still Pending (Samsung phone may be sleeping or connecting).');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

