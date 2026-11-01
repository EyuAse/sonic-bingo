/**
 * AfroMessage Real SMS Gateway Adapter for Ethiopia
 * Connected with live AfroMessage API Token & Direct Ethiopian Carrier Routing
 */

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  provider: 'afromessage' | 'simulator';
  error?: string;
  deliveredViaSms: boolean;
  unverifiedContact?: boolean;
}

// User-provided AfroMessage API Key
export const AFROMESSAGE_API_KEY =
  'eyJhbGciOiJIUzI1NiJ9.eyJpZGVudGlmaWVyIjoibDZzY0JTQWp1cHQ5VzNyZmxiR292bnh4STU2aWZiZGQiLCJleHAiOjE5NDYwNjExOTMsImlhdCI6MTc4ODI5NDc5MywianRpIjoiYmM3M2MxOTItMmZiMi00NGJjLTk4NjQtNzBmZGJjODg1ODdiIn0.rTmbJ57r4RRrSwT9RqI6VJKB603Zp29ua_h-8EW5VKc';

export class SmsGatewayService {
  private static instance: SmsGatewayService;

  private constructor() {}

  public static getInstance(): SmsGatewayService {
    if (!SmsGatewayService.instance) {
      SmsGatewayService.instance = new SmsGatewayService();
    }
    return SmsGatewayService.instance;
  }

  /**
   * Dispatch Real OTP SMS via AfroMessage Live API
   */
  public async sendOtpSms(
    canonicalPhone: string,
    otpCode: string,
    lang: 'en' | 'am' = 'am'
  ): Promise<SmsSendResult> {
    const messageText =
      lang === 'am'
        ? `የሶኒክ ቢንጎ ማረጋገጫ ኮድዎ ${otpCode} ነው። ይህን ኮድ ለማንም አያጋሩ። (Sonic Bingo OTP)`
        : `Your Sonic Bingo verification code is ${otpCode}. Valid for 5 minutes. Do not share.`;

    const cleanPhone = canonicalPhone.replace('+', '');

    // In dev environment with Vite proxy, use /api/afromessage to bypass browser CORS
    const endpoint =
      typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? '/api/afromessage/send'
        : 'https://api.afromessage.com/api/send';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AFROMESSAGE_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          to: cleanPhone,
          message: messageText
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Check if AfroMessage acknowledged success
        if (data.acknowledge === 'success') {
          console.log('✅ [AfroMessage LIVE] Real SMS delivered to SIM:', cleanPhone, data);
          return {
            success: true,
            messageId: data.response?.message_id || data.response?.messageId || 'afro-live-sms',
            provider: 'afromessage',
            deliveredViaSms: true
          };
        } else if (data.response?.errors && data.response.errors.length > 0) {
          const errMsg = data.response.errors.join(' ');
          const isUnverified = errMsg.includes('unverified contact number');
          console.warn('⚠️ [AfroMessage Notice]:', errMsg);
          return {
            success: false,
            provider: 'afromessage',
            error: isUnverified
              ? 'unverified_contact'
              : errMsg,
            deliveredViaSms: false,
            unverifiedContact: isUnverified
          };
        }
      }

      const errText = await response.text();
      console.warn('⚠️ AfroMessage response error:', response.status, errText);
      return {
        success: false,
        provider: 'afromessage',
        error: `HTTP ${response.status}: ${errText.slice(0, 100)}`,
        deliveredViaSms: false
      };
    } catch (error: any) {
      console.warn('⚠️ AfroMessage network request failed:', error?.message || error);
      return {
        success: false,
        provider: 'afromessage',
        error: error?.message || 'Network error connecting to AfroMessage API.',
        deliveredViaSms: false
      };
    }
  }
}

export const smsGateway = SmsGatewayService.getInstance();
