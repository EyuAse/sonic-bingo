import dotenv from 'dotenv';
dotenv.config();

import assert from 'assert';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import authRoutes from '../routes/auth.js';

interface MockResponse {
  statusCode: number;
  data: any;
}

function invokeAuthEndpoint(method: string, url: string, body: any): Promise<MockResponse> {
  return new Promise((resolve, reject) => {
    const req: any = {
      method,
      url,
      originalUrl: url,
      body,
      headers: { 'content-type': 'application/json' },
      get: (h: string) => ''
    };

    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ statusCode: this.statusCode, data: payload });
        return this;
      },
      send(payload: any) {
        resolve({ statusCode: this.statusCode, data: payload });
        return this;
      }
    };

    authRoutes(req, res, (err?: any) => {
      if (err) reject(err);
      else resolve({ statusCode: 404, data: { error: 'Not found' } });
    });
  });
}

async function testAdminPasswordMigration() {
  console.log('====================================================');
  console.log('🧪 TESTING PHASE 2: ADMIN PASSWORD MIGRATION');
  console.log('====================================================');

  try {
    // 1. Check .env and environment variable
    const activeAdminPin = process.env.ADMIN_PIN || process.env.ADMIN_PASSWORD;
    console.log(`1️⃣ Checking Environment Variable: ADMIN_PIN=${activeAdminPin}`);
    assert.strictEqual(activeAdminPin, 'sonic@2026!', 'process.env.ADMIN_PIN must be sonic@2026!');
    console.log('   ✓ process.env.ADMIN_PIN matches sonic@2026!');

    // 2. Test rejection of old PIN '1234' on /admin-login
    console.log('\n2️⃣ Testing rejection of obsolete PIN "1234" on /admin-login...');
    const oldPinRes = await invokeAuthEndpoint('POST', '/admin-login', { pin: '1234' });
    assert.strictEqual(oldPinRes.statusCode, 401, 'Old PIN 1234 must be rejected with HTTP 401');
    assert.strictEqual(oldPinRes.data.success, false, 'Old PIN 1234 must return success: false');
    console.log('   ✓ Obsolete PIN "1234" successfully rejected (401 Unauthorized)');

    // 3. Test rejection of arbitrary password
    console.log('\n3️⃣ Testing rejection of incorrect password "wrongpass123"...');
    const wrongRes = await invokeAuthEndpoint('POST', '/admin-login', { pin: 'wrongpass123' });
    assert.strictEqual(wrongRes.statusCode, 401, 'Arbitrary password must be rejected');
    console.log('   ✓ Arbitrary password rejected (401 Unauthorized)');

    // 4. Test authentication with 'sonic@2026!'
    console.log('\n4️⃣ Testing authentication with new password "sonic@2026!" on /admin-login...');
    const newPinRes = await invokeAuthEndpoint('POST', '/admin-login', { pin: 'sonic@2026!' });
    assert.strictEqual(newPinRes.statusCode, 200, 'New password sonic@2026! must succeed with HTTP 200');
    assert.strictEqual(newPinRes.data.success, true, 'New password sonic@2026! must return success: true');
    assert.ok(newPinRes.data.token, 'Must return a valid JWT token');
    assert.strictEqual(newPinRes.data.user.role, 'admin', 'User role must be admin');
    console.log(`   ✓ New password "sonic@2026!" authenticated successfully! Token: ${newPinRes.data.token.slice(0, 25)}...`);

    // 5. Test password property alias { password: 'sonic@2026!' }
    console.log('\n5️⃣ Testing authentication with { password: "sonic@2026!" }...');
    const passPropRes = await invokeAuthEndpoint('POST', '/admin-login', { password: 'sonic@2026!' });
    assert.strictEqual(passPropRes.statusCode, 200, 'password field alias must succeed with HTTP 200');
    assert.strictEqual(passPropRes.data.success, true);
    console.log('   ✓ Password property alias authenticated successfully!');

    // 6. Verify Neon DB self-healing hash synchronization
    console.log('\n6️⃣ Verifying database hash sync for admin user in Neon DB...');
    const dbAdmin = await query(`SELECT id, phone, role, pin_hash FROM users WHERE role = 'admin' LIMIT 1`);
    if (dbAdmin.rows.length > 0) {
      const isDbHashSynced = await bcrypt.compare('sonic@2026!', dbAdmin.rows[0].pin_hash);
      assert.strictEqual(isDbHashSynced, true, 'Admin pin_hash in Neon DB must match bcrypt hash of sonic@2026!');
      console.log(`   ✓ Neon DB admin account (ID: ${dbAdmin.rows[0].id}) pin_hash correctly synchronized!`);
    } else {
      console.log('   ℹ️ No admin user row in DB yet (will be auto-created on live boot).');
    }

    console.log('\n====================================================');
    console.log('🎉 ALL PHASE 2 ADMIN PASSWORD CHECKS PASSED PERFECTLY!');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Phase 2 Test Failed:', err);
    process.exit(1);
  }
}

testAdminPasswordMigration();
