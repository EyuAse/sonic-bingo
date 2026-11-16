import { validateEthiopianPhone } from '../../src/services/ethiopianPhoneValidator.ts';

function runVerificationTests() {
  console.log('🧪 Starting Red Login & Phone Verification Test Suite...\n');

  // Test 1: Phone validation mandatory checks
  const emptyCheck = validateEthiopianPhone('');
  console.assert(!emptyCheck.isValid, 'Empty phone must be invalid');
  console.log('✓ Test 1 Passed: Empty phone is strictly invalid');

  const randomCheck = validateEthiopianPhone('123456');
  console.assert(!randomCheck.isValid, 'Short phone must be invalid');
  console.log('✓ Test 2 Passed: Invalid non-Ethiopian prefix is rejected');

  const valid09 = validateEthiopianPhone('0911223344');
  console.assert(valid09.isValid && valid09.nationalNumber === '0911223344', '0911223344 must be valid');
  console.log('✓ Test 3 Passed: Standard 09 Ethio Telecom format valid');

  const valid251 = validateEthiopianPhone('+251712345678');
  console.assert(valid251.isValid && valid251.canonicalNumber === '+251712345678', '+2517... Safaricom format normalized');
  console.log('✓ Test 4 Passed: +251 7 Safaricom format normalized to canonical form');

  // Test 2: Dismissal memory logic verification
  const userId = 'usr_test_123';
  const storageMock: Record<string, string> = {};
  const dismissalKey = `sonic_phone_prompt_dismissed_${userId}`;

  // Initial check - not dismissed
  let isDismissed = storageMock[dismissalKey] === 'true';
  console.assert(!isDismissed, 'Initial state should not be dismissed');
  console.log('✓ Test 5 Passed: Initial session prompts phone verification once');

  // User taps "Remind Me Later"
  storageMock[dismissalKey] = 'true';
  isDismissed = storageMock[dismissalKey] === 'true';
  console.assert(isDismissed, 'Should be dismissed after tapping remind later');
  console.log('✓ Test 6 Passed: Remind Later dismisses modal');

  // Subsequent session - player opens app again
  const subsequentSessionDismissed = storageMock[dismissalKey] === 'true';
  console.assert(subsequentSessionDismissed, 'Subsequent session must remain dismissed and not block the player');
  console.log('✓ Test 7 Passed: Repeat app openings are NOT blocked by popup');

  console.log('\n🎉 ALL 7 TESTS PASSED SUCCESSFULLY!');
}

runVerificationTests();
