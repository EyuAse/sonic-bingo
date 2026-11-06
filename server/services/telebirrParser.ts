/**
 * Telebirr SMS Parser Service
 * Accurately extracts Transaction ID, Amount, Sender Phone, Sender Name,
 * and Account Balance from all Ethio Telecom Telebirr SMS confirmations
 * (P2P transfers, Bank-to-Telebirr transfers, and Merchant payments).
 */

export interface ParsedTelebirrSMS {
  success: boolean;
  isOutgoing?: boolean;
  transactionRef?: string;
  amount?: number;
  senderPhone?: string;     // e.g. '2519****8124' or '0912345678'
  senderLast4?: string;     // e.g. '8124' (critical for matching masked SMS)
  senderName?: string;      // e.g. 'NATINAEL GETACHO' or 'Commercial Bank of Ethiopia'
  recipientName?: string;   // e.g. 'FEVEN'
  balanceAfter?: number;    // e.g. 221.63
  rawText: string;
}

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+251')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('251') && !cleaned.includes('*')) {
    cleaned = '0' + cleaned.slice(3);
  }
  return cleaned;
}

export function extractLast4Digits(phone: string): string | undefined {
  if (!phone) return undefined;
  const match = phone.match(/(\d{4})\)?$/);
  return match ? match[1] : undefined;
}

export function parseTelebirrSMS(smsBody: string): ParsedTelebirrSMS {
  if (!smsBody || typeof smsBody !== 'string') {
    return { success: false, rawText: '' };
  }

  const text = smsBody.trim();

  // 🛡️ SECURITY GUARD 1: Strictly Reject Outgoing / Debit Transfers
  // When money is transferred OUT, Ethio Telecom sends "You have transferred" or "አስተላልፈዋል".
  // These are outgoing payments or withdrawals and must NEVER be credited as deposits!
  const isOutgoing = /You\s+have\s+transferred/i.test(text) ||
                     /አስተላልፈዋል/i.test(text) ||
                     /transferred\s+(?:ETB|ብር)/i.test(text) ||
                     /sent\s+(?:ETB|ብር)/i.test(text);

  if (isOutgoing) {
    return { success: false, isOutgoing: true, rawText: text };
  }

  // Pattern 1: Official Ethio Telecom Telebirr P2P Received Template (English)
  // "Dear FEVEN
  //  You have received ETB 130.00 from NATINAEL GETACHO(2519****8124)...
  //  Your transaction number is DK50QX28QA."
  const officialEnRegex = /(?:Dear\s+([A-Za-z\s]+?)\s+)?You\s+have\s+received\s+(?:ETB\s*)?([\d,]+(?:\.\d{1,2})?)\s*(?:ETB)?\s+from\s+([A-Za-z\s]+?)\s*\(\s*([0-9*+]+)\s*\).*?transaction\s*(?:number|id|no)?\s*(?:is|:)[:\s]*([A-Za-z0-9]+)/is;

  const matchOfficial = text.match(officialEnRegex);
  if (matchOfficial) {
    const rawAmt = matchOfficial[2].replace(/,/g, '');
    const amt = parseFloat(rawAmt);
    const phone = matchOfficial[4].trim();
    const txRef = matchOfficial[5].trim().toUpperCase();

    const balMatch = text.match(/(?:balance\s*is\s*(?:ETB\s*)?)([\d,]+(?:\.\d{1,2})?)/i);
    const balAfter = balMatch ? parseFloat(balMatch[1].replace(/,/g, '')) : undefined;

    if (!isNaN(amt) && amt > 0 && txRef) {
      return {
        success: true,
        recipientName: matchOfficial[1]?.trim() || undefined,
        amount: amt,
        senderName: matchOfficial[3]?.trim().replace(/\s+/g, ' ') || undefined,
        senderPhone: cleanPhoneNumber(phone),
        senderLast4: extractLast4Digits(phone),
        transactionRef: txRef,
        balanceAfter: balAfter,
        rawText: text
      };
    }
  }

  // Pattern 2: Bank-to-Telebirr Transfer Template
  // "Dear FEVEN, You have received  ETB 2,000.00 by transaction number DK64RQO4IA on 2026-11-06 11:19:47 from Commercial Bank of Ethiopia..."
  const bankTransferRegex = /(?:Dear\s+([A-Za-z\s]+?)[,\s]+)?You\s+have\s+received\s+(?:ETB\s*)?([\d,]+(?:\.\d{1,2})?)\s*(?:ETB)?\s+by\s+transaction\s*(?:number|id|no)?\s*([A-Za-z0-9]+).*?from\s+([A-Za-z\s]+?)(?:\s+to|\.|$)/is;

  const matchBank = text.match(bankTransferRegex);
  if (matchBank) {
    const rawAmt = matchBank[2].replace(/,/g, '');
    const amt = parseFloat(rawAmt);
    const txRef = matchBank[3].trim().toUpperCase();
    const sender = matchBank[4]?.trim();

    const balMatch = text.match(/(?:balance\s*is\s*(?:ETB\s*)?)([\d,]+(?:\.\d{1,2})?)/i);
    const balAfter = balMatch ? parseFloat(balMatch[1].replace(/,/g, '')) : undefined;

    if (!isNaN(amt) && amt > 0 && txRef) {
      return {
        success: true,
        recipientName: matchBank[1]?.trim() || undefined,
        amount: amt,
        senderName: sender || 'Bank Transfer',
        transactionRef: txRef,
        balanceAfter: balAfter,
        rawText: text
      };
    }
  }

  // Pattern 3: Standard English Format with phone directly after 'from'
  const enRegex = /received\s+(?:ETB\s+)?([\d,]+(?:\.\d{1,2})?)\s*(?:ETB)?\s+from\s+([0-9*+]+)(?:\s*\((.*?)\))?.*?Transaction\s*(?:ID|No|Number)?\s*(?:is|:)[:\s]*([A-Za-z0-9]+)/is;
  const matchEn = text.match(enRegex);
  if (matchEn) {
    const rawAmt = matchEn[1].replace(/,/g, '');
    const amt = parseFloat(rawAmt);
    const phone = matchEn[2].trim();
    if (!isNaN(amt) && amt > 0) {
      return {
        success: true,
        amount: amt,
        senderPhone: cleanPhoneNumber(phone),
        senderLast4: extractLast4Digits(phone),
        senderName: matchEn[3]?.trim() || undefined,
        transactionRef: matchEn[4]?.trim().toUpperCase(),
        rawText: text
      };
    }
  }

  // Pattern 4: Official Amharic Telebirr Format
  const amRegex = /(?:ከ\s*([0-9*+]+)(?:\s*\((.*?)\))?\s*([\d,]+(?:\.\d{1,2})?)\s*ብር|([\d,]+(?:\.\d{1,2})?)\s*ብር\s*ከ\s*([^\(]+?)\s*\(\s*([0-9*+]+)\s*\))\s*ተቀብለዋል።.*?የግብይት\s*መለያ\s*(?:ቁጥር(?:ዎ)?)?[:\s]+([A-Za-z0-9]+)/is;
  const matchAm = text.match(amRegex);
  if (matchAm) {
    let amt: number;
    let phone: string;
    let senderName: string | undefined;

    if (matchAm[1]) {
      phone = matchAm[1].trim();
      senderName = matchAm[2]?.trim();
      amt = parseFloat(matchAm[3].replace(/,/g, ''));
    } else {
      amt = parseFloat(matchAm[4].replace(/,/g, ''));
      senderName = matchAm[5]?.trim();
      phone = matchAm[6].trim();
    }

    const txRef = matchAm[7]?.trim().toUpperCase();

    if (!isNaN(amt) && amt > 0 && txRef) {
      return {
        success: true,
        amount: amt,
        senderPhone: cleanPhoneNumber(phone),
        senderLast4: extractLast4Digits(phone),
        senderName: senderName || undefined,
        transactionRef: txRef,
        rawText: text
      };
    }
  }

  // Pattern 5: Broad Resilient Fallback (Find TxID, Amount, and Phone separately)
  const txMatch = text.match(/(?:transaction\s*(?:number|id|no)?\s*(?:is|:)[:\s]*|የግብይት\s*መለያ(?:\s*ቁጥር)?[:\s]+)([A-Za-z0-9]{8,16})/i);
  const amtMatch = text.match(/(?:received|ተቀብለዋል).*?(?:ETB|ብር)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|ብር)?/is) ||
                   text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|ብር)/i);
  const phoneMatch = text.match(/\(\s*([0-9*+]{9,16})\s*\)/) || text.match(/(?:from|ከ)\s*([0-9*+]{9,16})/i);

  if (txMatch && amtMatch) {
    const rawAmt = amtMatch[1].replace(/,/g, '');
    const amt = parseFloat(rawAmt);
    const phone = phoneMatch ? phoneMatch[1].trim() : undefined;

    if (!isNaN(amt) && amt > 0) {
      return {
        success: true,
        transactionRef: txMatch[1].trim().toUpperCase(),
        amount: amt,
        senderPhone: phone ? cleanPhoneNumber(phone) : undefined,
        senderLast4: phone ? extractLast4Digits(phone) : undefined,
        rawText: text
      };
    }
  }

  return { success: false, rawText: text };
}
