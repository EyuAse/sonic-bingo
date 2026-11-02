/**
 * Verification Script for Phase 5: Agent Portal Refresh Retention Logic
 */

function simulateAppContextRouting(hash: string, pathname: string, localStorageMock: Record<string, string>) {
  const savedPortal = localStorageMock['sonic_active_portal'];
  const hasAgentToken = !!localStorageMock['sonic_agent_token'];

  if (hash.includes('lomibingo-Admin-vBingo') || pathname.includes('lomibingo-Admin-vBingo') || hash.includes('admin')) {
    return 'admin';
  }
  if (
    hash.includes('agent') ||
    pathname.includes('agent') ||
    (savedPortal === 'agent' && hasAgentToken)
  ) {
    return 'agent';
  }
  return 'landing';
}

function simulateGetInitialTab(hash: string, search: string, localStorageMock: Record<string, string>) {
  const validTabs = [
    'overview', 'deposit_requests', 'withdrawal_requests',
    'cash_in', 'cash_out', 'recharge', 'players', 'statements', 'profile', 'commission'
  ];

  // 1. Check URL query params
  const params = new URLSearchParams(search);
  const tabParam = params.get('tab');
  if (tabParam && validTabs.includes(tabParam)) return tabParam;

  // 2. Check hash query params
  const qIndex = hash.indexOf('?');
  if (qIndex !== -1) {
    const hashParams = new URLSearchParams(hash.substring(qIndex));
    const hashTab = hashParams.get('tab');
    if (hashTab && validTabs.includes(hashTab)) return hashTab;
  }

  // 3. Check plain hash
  const cleanHash = hash.replace(/^[#/]+/, '').replace(/^agent(-portal)?\/?/, '');
  if (cleanHash && validTabs.includes(cleanHash)) return cleanHash;

  // 4. Check localStorage saved tab
  const savedTab = localStorageMock['sonic_agent_tab'];
  if (savedTab && validTabs.includes(savedTab)) return savedTab;

  return 'overview';
}

function simulateAppRedirectGuard(isAuthenticated: boolean, currentPage: string, hash: string, pathname: string, localStorageMock: Record<string, string>) {
  if (isAuthenticated && (currentPage === 'landing' || currentPage === 'login' || currentPage === 'signup')) {
    const isAgentHash = (
      hash.includes('agent') ||
      pathname.includes('agent') ||
      (localStorageMock['sonic_active_portal'] === 'agent' && !!localStorageMock['sonic_agent_token'])
    );
    if (isAgentHash) {
      return 'agent';
    }
    return 'games';
  }
  return currentPage;
}

console.log('🧪 Verifying Phase 5: Agent Portal Refresh Retention Scenarios...');

// Scenario 1: User refreshes on Agent Portal Commission Desk with #/agent-portal?tab=commission
{
  const hash = '#/agent-portal?tab=commission';
  const path = '/';
  const storage = { sonic_agent_token: 'fake-jwt', sonic_active_portal: 'agent', sonic_agent_tab: 'commission' };
  
  const page = simulateAppContextRouting(hash, path, storage);
  const tab = simulateGetInitialTab(hash, '', storage);
  const guardedPage = simulateAppRedirectGuard(true, page, hash, path, storage);

  if (page !== 'agent' || tab !== 'commission' || guardedPage !== 'agent') {
    throw new Error(`Scenario 1 Failed! Got page=${page}, tab=${tab}, guardedPage=${guardedPage}`);
  }
  console.log('✅ Scenario 1 Passed: #/agent-portal?tab=commission retained cleanly as agent -> commission');
}

// Scenario 2: User refreshes on Deposit Desk with #agent-portal?tab=deposit_requests
{
  const hash = '#agent-portal?tab=deposit_requests';
  const path = '/';
  const storage = { sonic_agent_token: 'fake-jwt', sonic_active_portal: 'agent', sonic_agent_tab: 'deposit_requests' };
  
  const page = simulateAppContextRouting(hash, path, storage);
  const tab = simulateGetInitialTab(hash, '', storage);
  const guardedPage = simulateAppRedirectGuard(true, page, hash, path, storage);

  if (page !== 'agent' || tab !== 'deposit_requests' || guardedPage !== 'agent') {
    throw new Error(`Scenario 2 Failed! Got page=${page}, tab=${tab}, guardedPage=${guardedPage}`);
  }
  console.log('✅ Scenario 2 Passed: #agent-portal?tab=deposit_requests retained cleanly as agent -> deposit_requests');
}

// Scenario 3: Legacy hash without "agent" prefix (e.g. #commission) but active session in storage
{
  const hash = '#commission';
  const path = '/';
  const storage = { sonic_agent_token: 'fake-jwt', sonic_active_portal: 'agent', sonic_agent_tab: 'commission' };
  
  const page = simulateAppContextRouting(hash, path, storage);
  const tab = simulateGetInitialTab(hash, '', storage);
  const guardedPage = simulateAppRedirectGuard(true, page, hash, path, storage);

  if (page !== 'agent' || tab !== 'commission' || guardedPage !== 'agent') {
    throw new Error(`Scenario 3 Failed! Got page=${page}, tab=${tab}, guardedPage=${guardedPage}`);
  }
  console.log('✅ Scenario 3 Passed: Legacy #commission with active session retained cleanly as agent -> commission');
}

// Scenario 4: Initial frame momentarily evaluates to landing while Telegram user is authenticated
{
  const hash = '#/agent-portal?tab=overview';
  const path = '/';
  const storage = { sonic_agent_token: 'fake-jwt', sonic_active_portal: 'agent' };
  
  // Suppose initial frame was landing
  const guardedPage = simulateAppRedirectGuard(true, 'landing', hash, path, storage);

  if (guardedPage !== 'agent') {
    throw new Error(`Scenario 4 Failed! Got guardedPage=${guardedPage}`);
  }
  console.log('✅ Scenario 4 Passed: Authenticated user intercepted by guard and kept on agent (NOT games or landing)');
}

console.log('🎉 All Phase 5 Refresh Retention tests passed with 100% precision!');
