import React from 'react';
import { DepositPage } from './DepositPage.tsx';

/**
 * Unified Cashier - Withdraw via Agent
 * Routes to the unified cashier hub with initialTab="withdraw".
 */
export const WithdrawPage: React.FC = () => {
  return <DepositPage initialTab="withdraw" />;
};

export default WithdrawPage;
