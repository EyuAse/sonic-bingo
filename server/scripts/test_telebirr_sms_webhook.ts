import { parseTelebirrSMS } from '../services/telebirrParser.ts';
import { query } from '../db.ts';

async function runTests() {
  console.log('🧪 Testing with Real-World User Telebirr SMS Template...\n');

  // Exact real-world SMS from the user's screenshot
  const realSms = `Dear FEVEN
You have received ETB
130.00 from NATINAEL
GETACHO(2519****8124)
on 05/11/2026 19:41:47.
Your transaction number
is DK50QX28QA. Your
current E-Money
Account balance is ETB
221.63.
Thank you for using
telebirr
Ethio telecom`;

  const parsedReal = parseTelebirrSMS(realSms);
  console.log('Parsed Real-World Telebirr SMS Result:', parsedReal);

  if (
    !parsedReal.success ||
    parsedReal.amount !== 130 ||
    parsedReal.transactionRef !== 'DK50QX28QA' ||
    parsedReal.senderLast4 !== '8124' ||
    parsedReal.senderName !== 'NATINAEL GETACHO' ||
    parsedReal.balanceAfter !== 221.63 ||
    parsedReal.recipientName !== 'FEVEN'
  ) {
    throw new Error('❌ Test Failed: Real-world SMS parsing mismatch!');
  }
  console.log('✅ Passed: Real-world Ethio Telecom template parsed with 100% precision!\n');

  // Amharic variant test
  const amSms = `ውድ ፈቨን
130.00 ብር ከ ናትናኤል ጌታቸው (2519****8124) ተቀብለዋል።
የግብይት መለያ ቁጥርዎ DK50QX28QA ነው።
የአሁኑ የሂሳብ ቀሪዎ 221.63 ብር ነው።`;

  const parsedAm = parseTelebirrSMS(amSms);
  console.log('Parsed Amharic Telebirr SMS Result:', parsedAm);

  if (!parsedAm.success || parsedAm.amount !== 130 || parsedAm.transactionRef !== 'DK50QX28QA' || parsedAm.senderLast4 !== '8124') {
    throw new Error('❌ Test Failed: Amharic masked SMS parsing mismatch!');
  }
  console.log('✅ Passed: Amharic masked template parsed with 100% precision!\n');

  console.log('🎉 ALL REAL-WORLD TELEBIRR PARSER TESTS PASSED!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
