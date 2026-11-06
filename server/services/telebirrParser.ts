/**
 * Telebirr SMS Parser Service
 * Accurately extracts Transaction ID, Amount, Sender Phone, and Sender Name
 * from both English and Amharic Ethio Telecom Telebirr SMS confirmations.
 */

export interface ParsedTelebirrSMS {
  success: boolean;
  transactionRef?: string;
  amount?: number;
  senderPhone?: string;
  senderName?: string;
  rawText: string;
}

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+251')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('251')) {
    cleaned = '0' + cleaned.slice(3);
  }
  return cleaned;
}

export function parseTelebirrSMS(smsBody: string): ParsedTelebirrSMS {
  if (!smsBody || typeof smsBody !== 'string') {
    return { success: false, rawText: '' };
  }

  const text = smsBody.trim();

  // Pattern 1: English Telebirr confirmation formats:
  // e.g., "You have received 100.00 ETB from 0912345678 (Abebe Kebede). Your current balance is ... Transaction ID: DA98KL78"
  // or "You have received ETB 100.00 from 251912345678 on 2026-11-06... Transaction No: DA98KL78"
  const enRegex = /received\s+(?:ETB\s+)?([\d,]+(?:\.\d{1,2})?)\s*(?:ETB)?\s+from\s+([0-9+]+)(?:\s*\((.*?)\))?.*?Transaction\s*(?:ID|No|Number)?[:\s]+([A-Za-z0-9]+)/is;
  
  // Pattern 2: Amharic Telebirr confirmation formats:
  // e.g., "ከ 0912345678 (Abebe Kebede) 100.00 ብር ተቀብለዋል። የግብይት መለያ: DA98KL78"
  // or "ከ 0912345678 100 ብር ተቀብለዋል። የግብይት መለያ: DA98KL78"
  const amRegex = /ከ\s*([0-9+]+)(?:\s*\((.*?)\))?\s*([\d,]+(?:\.\d{1,2})?)\s*ብር\s*ተቀብለዋል።.*?የግብይት\s*መለያ[:\s]+([A-Za-z0-9]+)/is;

  // Pattern 3: Alternative Amharic format (amount first):
  // e.g., "100.00 ብር ከ 0912345678 ተቀብለዋል። የግብይት መለያ: DA98KL78"
  const amRegex2 = /([\d,]+(?:\.\d{1,2})?)\s*ብር\s*ከ\s*([0-9+]+)(?:\s*\((.*?)\))?\s*ተቀብለዋል።.*?የግብይት\s*መለያ[:\s]+([A-Za-z0-9]+)/is;

  let match = text.match(enRegex);
  if (match) {
    const rawAmt = match[1].replace(/,/g, '');
    const amt = parseFloat(rawAmt);
    if (!isNaN(amt) && amt > 0) {
      return {
        success: true,
        amount: amt,
        senderPhone: cleanPhoneNumber(match[2]),
        senderName: match[3]?.trim() || undefined,
        transactionRef: match[4]?.trim().toUpperCase(),
        rawText: text
      };
    }
  }

  match = text.match(amRegex);
  if (match) {
    const rawAmt = match[3].replace(/,/g, '');
    const amt = parseFloat(rawAmt);
    if (!isNaN(amt) && amt > 0) {
      return {
        success: true,
        senderPhone: cleanPhoneNumber(match[1]),
        senderName: match[2]?.trim() || undefined,
        amount: amt,
        transactionRef: match[4]?.trim().toUpperCase(),
        rawText: text
      };
    }
  }

  match = text.match(amRegex2);
  if (match) {
    const rawAmt = match[1].replace(/,/g, '');
    const amt = parseFloat(rawAmt);
    if (!isNaN(amt) && amt > 0) {
      return {
        success: true,
        amount: amt,
        senderPhone: cleanPhoneNumber(match[2]),
        senderName: match[3]?.trim() || undefined,
        transactionRef: match[4]?.trim().toUpperCase(),
        rawText: text
      };
    }
  }

  // Fallback: Independent regex search for Transaction ID, Amount, and Phone
  const txMatch = text.match(/(?:Transaction\s*(?:ID|No|Number)?|የግብይት\s*መለያ|Trans\s*ID)[:\s]+([A-Za-z0-9]{6,20})/i);
  const amtMatch = text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|ብር)/i) || text.match(/(?:ETB|ብር)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const phoneMatch = text.match(/(?:from|ከ)\s*([0-9+]{9,14})/i);

  if (txMatch && amtMatch) {
    const rawAmt = amtMatch[1].replace(/,/g, '');
    const amt = parseFloat(rawAmt);
    if (!isNaN(amt) && amt > 0) {
      return {
        success: true,
        transactionRef: txMatch[1].trim().toUpperCase(),
        amount: amt,
        senderPhone: phoneMatch ? cleanPhoneNumber(phoneMatch[1]) : undefined,
        rawText: text
      };
    }
  }

  return { success: false, rawText: text };
}

