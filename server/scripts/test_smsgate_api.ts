const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzbXMtZ2F0ZS5hcHAiLCJzdWIiOiJINjRCWDgiLCJleHAiOjE3OTQ1NjkxNzcsImlhdCI6MTc5NDU2ODI3NywianRpIjoiUUlxcGZzSThmRlJoVkduT0M1OHp0IiwidXNlcl9pZCI6Ikg2NEJYOCIsInNjb3BlcyI6WyJkZXZpY2VzOmxpc3QiLCJpbmJveDpsaXN0IiwibWVzc2FnZXM6cmVhZCIsIndlYmhvb2tzOmxpc3QiLCJtZXNzYWdlczpsaXN0IiwibWVzc2FnZXM6c2VuZCIsIndlYmhvb2tzOndyaXRlIl19.GAtP0PP5fjifT6Kahkr2PAcA5ZpFpe3AhKgV4jdAUYI';

async function testApi() {
  console.log('Testing SMSGate API with token...');
  const res = await fetch('https://api.sms-gate.app/3rdparty/v1/devices', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`Status: ${res.status}`);
  const data = await res.json();
  console.log('Devices:', JSON.stringify(data, null, 2));
  process.exit(0);
}

testApi().catch((err) => {
  console.error(err);
  process.exit(1);
});

