async function testAllAdminEndpoints() {
  const baseUrl = 'https://bingo-mini-app-3li9.onrender.com';
  console.log('1. Logging in as admin...');
  const loginRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234' })
  });
  const loginData = await loginRes.json();
  console.log('Login success:', loginData.success, 'Token prefix:', loginData.token?.substring(0, 20));

  const authHeader = { Authorization: `Bearer ${loginData.token}` };

  console.log('\n2. Testing GET /api/admin/users...');
  const usersRes = await fetch(`${baseUrl}/api/admin/users`, { headers: authHeader });
  const usersData = await usersRes.json();
  console.log('Users status:', usersRes.status, 'Total users:', usersData.totalCount, 'Returned:', usersData.users?.length);

  console.log('\n3. Testing GET /api/admin/deposits...');
  const depRes = await fetch(`${baseUrl}/api/admin/deposits`, { headers: authHeader });
  const depData = await depRes.json();
  console.log('Deposits status:', depRes.status, 'Deposits count:', depData.deposits?.length);

  console.log('\n4. Testing GET /api/admin/withdrawals...');
  const wdRes = await fetch(`${baseUrl}/api/admin/withdrawals`, { headers: authHeader });
  const wdData = await wdRes.json();
  console.log('Withdrawals status:', wdRes.status, 'Withdrawals count:', wdData.withdrawals?.length);

  console.log('\n5. Testing GET /api/admin/stats...');
  const statsRes = await fetch(`${baseUrl}/api/admin/stats`, { headers: authHeader });
  const statsData = await statsRes.json();
  console.log('Stats status:', statsRes.status, 'Stats:', statsData.stats);
}

testAllAdminEndpoints().catch(console.error);
