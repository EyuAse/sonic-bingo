const refreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzbXMtZ2F0ZS5hcHAiLCJzdWIiOiJINjRCWDgiLCJleHAiOjE3OTcxNjAyNzcsImlhdCI6MTc5NDU2ODI3NywianRpIjoia2FmeDRNaDBVZk01ZFIyU0RMN1JrIiwidXNlcl9pZCI6Ikg2NEJYOCIsInNjb3BlcyI6WyJ0b2tlbnM6cmVmcmVzaCJdLCJvcmlnaW5hbF9zY29wZXMiOlsiZGV2aWNlczpsaXN0IiwiaW5ib3g6bGlzdCIsIm1lc3NhZ2VzOnJlYWQiLCJ3ZWJob29rczpsaXN0IiwibWVzc2FnZXM6bGlzdCIsIm1lc3NhZ2VzOnNlbmQiLCJ3ZWJob29rczp3cml0ZSJdfQ.roqrVyg_l-NknfM2OIQPCx8ke7YJE1bQpzvEdGgik_g';

async function testRefresh() {
  console.log('Testing token refresh endpoint...');
  const res = await fetch('https://api.sms-gate.app/3rdparty/v1/auth/token/refresh', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${refreshToken}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`Status: ${res.status}`);
  const text = await res.text();
  console.log('Response:', text);
  process.exit(0);
}

testRefresh().catch(console.error);
