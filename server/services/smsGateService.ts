/**
 * SMSGate Cloud API Service
 * Manages device health monitoring, outbound SMS notifications,
 * and automated JWT token rotation for the Lomi/Sonic Bingo platform.
 */

interface DeviceInfo {
  id: string;
  name: string;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
  isOnline: boolean;
  simCards?: Array<{
    slotIndex: number;
    simNumber: number;
    carrierName: string;
  }>;
}

class SMSGateService {
  private baseUrl = 'https://api.sms-gate.app/3rdparty/v1';
  private accessToken: string = process.env.SMSGATE_ACCESS_TOKEN || '';
  private refreshToken: string = process.env.SMSGATE_REFRESH_TOKEN || '';
  private username: string = process.env.SMSGATE_USERNAME || 'H64BX8';
  private password: string = process.env.SMSGATE_PASSWORD || 'xz3-xwau94k9pp';
  private tokenExpiresAt: number = 0;

  /**
   * Ensures an active, valid Bearer token via automated token rotation or Basic Auth
   */
  private async ensureToken(): Promise<string> {
    const now = Date.now();
    // Re-use active token if valid for at least another 60 seconds
    if (this.accessToken && this.tokenExpiresAt > now + 60000) {
      return this.accessToken;
    }

    // Attempt 1: Refresh token rotation
    if (this.refreshToken) {
      try {
        console.log('🔄 [SMSGate] Rotating API token via Refresh Token...');
        const res = await fetch(`${this.baseUrl}/auth/token/refresh`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.refreshToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          this.accessToken = data.access_token || data.token;
          if (data.refresh_token) {
            this.refreshToken = data.refresh_token;
          }
          this.tokenExpiresAt = data.expires_at ? new Date(data.expires_at).getTime() : now + 14 * 60 * 1000;
          console.log('✅ [SMSGate] Access token successfully renewed via refresh token!');
          return this.accessToken;
        }
      } catch (err) {
        console.warn('⚠️ [SMSGate] Refresh token failed, falling back to credentials auth...');
      }
    }

    // Attempt 2: Basic Auth credential exchange (self-healing)
    try {
      console.log('🔑 [SMSGate] Generating fresh Bearer token via Basic Auth...');
      const creds = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      const authRes = await fetch(`${this.baseUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${creds}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ttl: 86400, // 24 hours
          scopes: ['devices:list', 'messages:send', 'messages:read', 'webhooks:list']
        })
      });

      if (!authRes.ok) {
        throw new Error(`Basic auth failed with status ${authRes.status}`);
      }

      const authData = await authRes.json();
      this.accessToken = authData.access_token || authData.token;
      if (authData.refresh_token) {
        this.refreshToken = authData.refresh_token;
      }
      this.tokenExpiresAt = authData.expires_at ? new Date(authData.expires_at).getTime() : now + 23 * 3600 * 1000;
      console.log('✅ [SMSGate] New Bearer token successfully generated via Basic Auth!');
      return this.accessToken;
    } catch (err) {
      console.error('❌ [SMSGate] Error obtaining token via Basic Auth:', err);
      throw err;
    }
  }

  /**
   * Fetch all connected Agent Android devices and their online status
   */
  async getConnectedDevices(): Promise<DeviceInfo[]> {
    try {
      const token = await this.ensureToken();
      const res = await fetch(`${this.baseUrl}/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        console.warn(`[SMSGate] Failed to fetch devices: HTTP ${res.status}`);
        return [];
      }

      const devices = await res.json();
      const now = Date.now();

      return devices.map((d: any) => {
        const lastSeenMs = d.lastSeen ? new Date(d.lastSeen).getTime() : 0;
        // Consider device online if seen in the last 5 minutes
        const isOnline = (now - lastSeenMs) < 5 * 60 * 1000;
        return {
          id: d.id,
          name: d.name,
          lastSeen: d.lastSeen,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          isOnline,
          simCards: d.simCards
        };
      });
    } catch (err) {
      console.error('❌ [SMSGate] Error fetching devices:', err);
      return [];
    }
  }

  /**
   * Send an outbound SMS notification to a player's phone
   * (e.g. Deposit Confirmation, Winner Notification, or OTP)
   */
  async sendSMS(phoneNumber: string, message: string, deviceId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.ensureToken();

      // Ensure Ethiopian format e.g. +2519...
      let cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
      if (cleanPhone.startsWith('09') || cleanPhone.startsWith('07')) {
        cleanPhone = '+251' + cleanPhone.slice(1);
      } else if (cleanPhone.startsWith('251')) {
        cleanPhone = '+' + cleanPhone;
      }

      const payload: any = {
        textMessage: {
          text: message
        },
        phoneNumbers: [cleanPhone]
      };

      if (deviceId) {
        payload.deviceId = deviceId;
      }

      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[SMSGate] Failed to send SMS: HTTP ${res.status} - ${errText}`);
        return { success: false, error: errText };
      }

      const data = await res.json();
      console.log(`📤 [SMSGate] SMS dispatched to ${cleanPhone}:`, data);
      return { success: true };
    } catch (err: any) {
      console.error('❌ [SMSGate] Send SMS error:', err);
      return { success: false, error: err.message };
    }
  }
}

export const smsGateService = new SMSGateService();

