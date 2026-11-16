import { smsGateService } from '../services/smsGateService.ts';

async function run() {
  console.log('Testing smsGateService.getConnectedDevices()...');
  const devices = await smsGateService.getConnectedDevices();
  console.log('ACTIVE CONNECTED AGENT DEVICES:');
  console.log(JSON.stringify(devices, null, 2));
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

