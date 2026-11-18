import dotenv from 'dotenv';
dotenv.config();

import { telegramBotService } from '../services/telegramBotService.ts';
import { pool } from '../db.ts';

async function testBotHandlers() {
  console.log('🧪 Testing Telegram Bot Webhook Handlers...\n');

  // Test 1: /rules
  console.log('1. Testing /rules command:');
  const mockRulesUpdate = {
    message: {
      message_id: 99991,
      chat: { id: 999999999, type: 'private' },
      from: { id: 999999999, first_name: 'TestUser', is_bot: false },
      text: '/rules'
    }
  };
  const res1 = await telegramBotService.handleWebhookUpdate(mockRulesUpdate);
  console.log('   /rules handled:', res1);

  // Test 2: /wallet
  console.log('\n2. Testing /wallet command:');
  const mockWalletUpdate = {
    message: {
      message_id: 99992,
      chat: { id: 999999999, type: 'private' },
      from: { id: 999999999, first_name: 'TestUser', is_bot: false },
      text: '/wallet'
    }
  };
  const res2 = await telegramBotService.handleWebhookUpdate(mockWalletUpdate);
  console.log('   /wallet handled:', res2);

  // Test 3: /invite
  console.log('\n3. Testing /invite command:');
  const mockInviteUpdate = {
    message: {
      message_id: 99993,
      chat: { id: 999999999, type: 'private' },
      from: { id: 999999999, first_name: 'TestUser', is_bot: false },
      text: '/invite'
    }
  };
  const res3 = await telegramBotService.handleWebhookUpdate(mockInviteUpdate);
  console.log('   /invite handled:', res3);

  // Test 4: /support
  console.log('\n4. Testing /support command:');
  const mockSupportUpdate = {
    message: {
      message_id: 99994,
      chat: { id: 999999999, type: 'private' },
      from: { id: 999999999, first_name: 'TestUser', is_bot: false },
      text: '/support'
    }
  };
  const res4 = await telegramBotService.handleWebhookUpdate(mockSupportUpdate);
  console.log('   /support handled:', res4);

  // Test 5: /channel
  console.log('\n5. Testing /channel command:');
  const mockChannelUpdate = {
    message: {
      message_id: 99995,
      chat: { id: 999999999, type: 'private' },
      from: { id: 999999999, first_name: 'TestUser', is_bot: false },
      text: '/channel'
    }
  };
  const res5 = await telegramBotService.handleWebhookUpdate(mockChannelUpdate);
  console.log('   /channel handled:', res5);

  // Test 6: Button text "💰 My Wallet & Balance"
  console.log('\n6. Testing reply keyboard button "💰 My Wallet & Balance":');
  const mockBtnUpdate = {
    message: {
      message_id: 99996,
      chat: { id: 999999999, type: 'private' },
      from: { id: 999999999, first_name: 'TestUser', is_bot: false },
      text: '💰 My Wallet & Balance'
    }
  };
  const res6 = await telegramBotService.handleWebhookUpdate(mockBtnUpdate);
  console.log('   Button handled:', res6);

  // Test 7: /start for unverified user (check contact gate)
  console.log('\n7. Testing /start for unverified user:');
  const mockStartUpdate = {
    message: {
      message_id: 99997,
      chat: { id: 888888888, type: 'private' },
      from: { id: 888888888, first_name: 'NewPlayer', is_bot: false },
      text: '/start'
    }
  };
  const res7 = await telegramBotService.handleWebhookUpdate(mockStartUpdate);
  console.log('   /start handled:', res7);

  await pool.end();
  console.log('\n🎉 All 7 webhook test cases handled successfully!');
}

testBotHandlers().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
