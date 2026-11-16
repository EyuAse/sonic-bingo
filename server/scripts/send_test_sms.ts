import { smsGateService } from '../services/smsGateService';

async function main() {
  const targetPhone = process.argv[2] || '+251983624574';
  const messageText = process.argv[3] || 'Lomi Bingo Test: Hello from TECNO MOBILE agent phone!';
  const deviceId = 'eJPLsrjrfZEWAbyV0lsUY';

  console.log(`📡 Sending test SMS to: ${targetPhone}`);
  console.log(`📱 Via Device: TECNO MOBILE (${deviceId})`);
  console.log(`💬 Message: "${messageText}"`);

  const result = await smsGateService.sendSMS(targetPhone, messageText, deviceId);
  console.log('Result:', result);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

