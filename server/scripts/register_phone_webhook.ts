async function registerWebhook() {
  const phoneUrl = 'http://192.168.137.131:8080/webhooks';
  const auth = Buffer.from('sms:fcoEtlki').toString('base64');

  const payload = {
    id: 'telebirr-sms-listener',
    url: 'https://sonic-bingo-enod.onrender.com/api/webhooks/telebirr-sms?secret=telebirr_secret_sonic_2026',
    event: 'sms:received'
  };

  console.log('Sending payload to phone:', payload);

  const res = await fetch(phoneUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log(`Phone response (${res.status}):`, text);

  // Verify list
  const listRes = await fetch(phoneUrl, {
    headers: { 'Authorization': `Basic ${auth}` }
  });
  const listJson = await listRes.json();
  console.log('Current registered webhooks on phone:', listJson);
}

registerWebhook().catch(console.error);
