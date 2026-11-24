/**
 * Pure frontend Transaction ID extractor for pasted confirmation SMS messages.
 * Extracts ONLY the Transaction ID from Telebirr (EN/AM), Safaricom M-Pesa (EN/AM),
 * CBE/Bank transfers, or direct standalone IDs — strictly ignoring any URLs/links.
 */

const INVALID_PREFIX_RE = /^(?:ETB|BIRR|USD|KES|GMT|EAT)/i;

function isValidTxToken(token: string | undefined | null, minLength = 6): token is string {
  if (!token) return false;
  const clean = token.trim().toUpperCase();
  if (clean.length < minLength || clean.length > 25) return false;
  if (INVALID_PREFIX_RE.test(clean)) return false;
  // Must contain at least one digit so plain words like "CONFIRMED" or "NUMBER" are never matched
  if (!/\d/.test(clean)) return false;
  // Reject amounts like 1000AM / 1230PM
  if (/^\d{1,4}(?:AM|PM)$/i.test(clean)) return false;
  return true;
}

/**
 * Strips all HTTP/HTTPS and www URLs from a message so links are never captured as IDs.
 */
function stripLinksFromText(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts only the Transaction ID string from a pasted SMS message or direct code.
 * Returns uppercase Transaction ID if recognized, or null if no valid ID exists.
 */
export function extractTransactionIdFromMessage(rawInput: string): string | null {
  if (!rawInput || typeof rawInput !== 'string') return null;

  const text = stripLinksFromText(rawInput);
  if (!text) return null;

  // 1. Direct standalone Transaction ID (no spaces)
  if (!text.includes(' ') && /^[A-Za-z0-9_-]{4,25}$/.test(text)) {
    return isValidTxToken(text, 4) ? text.toUpperCase() : null;
  }

  // 2. Telebirr / Bank English confirmation formats (multi-line normalized)
  const enTxMatch = text.match(
    /(?:your\s+)?(?:by\s+)?transaction\s+(?:number|no\.?|id|code|ref(?:erence)?)\s*(?:is|:)?\s*[:#]?\s*([A-Za-z0-9]{6,25})\b/i
  );
  if (enTxMatch && isValidTxToken(enTxMatch[1])) {
    return enTxMatch[1].toUpperCase();
  }

  // 3. Telebirr Amharic confirmation formats ("የግብይት መለያ ቁጥርዎ ...", "የግብይት መለያ ...", etc.)
  const amTxMatch = text.match(
    /(?:የግብይት\s*(?:መለያ(?:\s*ቁጥር)?|ቁጥር)(?:ዎ|ው|ዎች)?|መለያ\s*ቁጥር(?:ዎ|ው)?)\s*(?:is|:|፡|።|#)?\s*([A-Za-z0-9]{6,25})\b/i
  );
  if (amTxMatch && isValidTxToken(amTxMatch[1])) {
    return amTxMatch[1].toUpperCase();
  }

  // 4. Safaricom M-Pesa confirmation formats (English & Amharic): "<CODE> Confirmed..." or "<CODE> ተረጋግጧል..."
  const mpesaMatch = text.match(/(?:^|\s)([A-Za-z0-9]{8,14})\s+(?:Confirmed|ተረጋግጧል)\b/i);
  if (mpesaMatch && isValidTxToken(mpesaMatch[1]) && /[A-Za-z]/.test(mpesaMatch[1])) {
    return mpesaMatch[1].toUpperCase();
  }

  // 5. Generic labeled transaction/reference identifiers
  const labeledMatch = text.match(
    /(?:tx(?:n)?\s*(?:id|ref|no\.?|number|code)?|ref(?:erence)?\s*(?:id|no\.?|number|code)?|receipt\s*(?:no\.?|number|id))\s*(?:is|:|#|፡)?\s*([A-Za-z0-9]{6,25})\b/i
  );
  if (labeledMatch && isValidTxToken(labeledMatch[1])) {
    return labeledMatch[1].toUpperCase();
  }

  // 6. CBE FT reference code
  const cbeMatch = text.match(/\b(FT[A-Z0-9]{8,16})\b/i);
  if (cbeMatch && isValidTxToken(cbeMatch[1])) {
    return cbeMatch[1].toUpperCase();
  }

  // 7. Resilient mixed alphanumeric token fallback (e.g. DL48RX91AB, DK50QX28QA, UB48XK29PQ)
  const tokenMatches = text.match(/\b([A-Za-z0-9]{8,14})\b/g) || [];
  for (const tok of tokenMatches) {
    // Require at least 2 letters AND 2 digits so phone numbers and dates never match
    const letterCount = (tok.match(/[A-Za-z]/g) || []).length;
    const digitCount = (tok.match(/\d/g) || []).length;
    if (letterCount >= 2 && digitCount >= 2 && isValidTxToken(tok)) {
      return tok.toUpperCase();
    }
  }

  return null;
}
