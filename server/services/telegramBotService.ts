import { query } from '../db.ts';

export interface BotConfig {
  token: string;
  webAppUrl: string;
  channelId?: string;
  autoPostMegaWins?: boolean;
  megaWinThreshold?: number;
}

export interface BroadcastOptions {
  title: string;
  messageText: string;
  photoUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  targetType: 'all_users' | 'channel' | 'group' | 'test';
  targetId?: string;
  crossPostChannel?: boolean;
  pinMessage?: boolean;
}

export class TelegramBotService {
  private static instance: TelegramBotService;
  private cachedConfig: BotConfig | null = null;
  private lastConfigFetch: number = 0;

  private constructor() { }

  public static getInstance(): TelegramBotService {
    if (!TelegramBotService.instance) {
      TelegramBotService.instance = new TelegramBotService();
    }
    return TelegramBotService.instance;
  }

  /**
   * Normalizes channel handles or full URLs (e.g. 'https://t.me/lomibingo_official' -> '@lomibingo_official')
   */
  public normalizeChannelIdentifier(input?: string): string {
    if (!input) return '';
    let cleaned = input.trim();
    // Strip URL prefixes like https://t.me/ or t.me/ or telegram.me/
    cleaned = cleaned.replace(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\//i, '');
    // Take the path segment before any ? or /
    cleaned = cleaned.split('/')[0].split('?')[0].trim();
    // If it's already a channel numeric ID like -100xxxxxxxx, keep it
    if (/^-100\d+$/.test(cleaned) || /^-\d+$/.test(cleaned)) {
      return cleaned;
    }
    // Remove leading @ if present
    cleaned = cleaned.replace(/^@+/, '');
    if (!cleaned) return '';
    return `@${cleaned}`;
  }

  /**
   * Resets and heals the PostgreSQL sequence for telegram_broadcasts table
   * Prevents 'duplicate key value violates unique constraint "telegram_broadcasts_pkey"' errors.
   */
  public async healBroadcastSequence(): Promise<void> {
    try {
      await query(`
        SELECT setval(
          'telegram_broadcasts_id_seq', 
          GREATEST((SELECT COALESCE(MAX(id), 1) FROM telegram_broadcasts), 1), 
          true
        )
      `);
    } catch (e: any) {
      console.warn('⚠️ [TelegramBotService] Failed to auto-heal broadcast sequence:', e.message);
    }
  }

  /**
   * Authoritative Config Resolution:
   * Prioritizes dynamic settings saved in DB (admin_settings),
   * falling back to environment variables in .env
   */
  public async getConfig(): Promise<BotConfig> {
    const now = Date.now();
    if (this.cachedConfig && now - this.lastConfigFetch < 30000) {
      return this.cachedConfig;
    }

    let token = process.env.TELEGRAM_BOT_TOKEN || '';
    let webAppUrl = process.env.TELEGRAM_WEBAPP_URL || '';
    let channelId = process.env.TELEGRAM_CHANNEL_ID || '';
    let autoPostMegaWins = true;
    let megaWinThreshold = 300;

    try {
      const res = await query('SELECT key, value FROM admin_settings WHERE key LIKE $1', ['telegram_%']);
      for (const row of res.rows) {
        if (row.key === 'telegram_bot_token' && row.value) token = row.value;
        if (row.key === 'telegram_webapp_url' && row.value) webAppUrl = row.value;
        if (row.key === 'telegram_channel_id' && row.value) channelId = row.value;
        if (row.key === 'telegram_auto_post_wins') autoPostMegaWins = row.value === 'true';
        if (row.key === 'telegram_mega_win_threshold') megaWinThreshold = parseFloat(row.value) || 300;
      }
    } catch (e) {
      // Table might still be initializing, use env vars
    }

    // In development mode, prioritize local .env credentials if provided
    if (process.env.NODE_ENV === 'development') {
      if (process.env.TELEGRAM_BOT_TOKEN) token = process.env.TELEGRAM_BOT_TOKEN;
      if (process.env.TELEGRAM_WEBAPP_URL) webAppUrl = process.env.TELEGRAM_WEBAPP_URL;
    }

    const normalizedChannel = this.normalizeChannelIdentifier(channelId || '@lomibingo_official');

    this.cachedConfig = {
      token: token.trim(),
      webAppUrl: webAppUrl.trim(),
      channelId: normalizedChannel,
      autoPostMegaWins,
      megaWinThreshold
    };
    this.lastConfigFetch = now;
    return this.cachedConfig;
  }

  public clearConfigCache() {
    this.cachedConfig = null;
    this.lastConfigFetch = 0;
  }

  /**
   * Call Telegram Bot API method
   */
  private async callApi(method: string, payload: any, customToken?: string): Promise<{ ok: boolean; result?: any; description?: string; error_code?: number }> {
    const cfg = await this.getConfig();
    const token = customToken || cfg.token;
    if (!token) {
      return { ok: false, description: 'Telegram Bot Token is not configured. Please set it in Admin Desk or .env' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { ok: false, description: err.message || 'Network error calling Telegram API' };
    }
  }

  /**
   * Validate bot credentials and return bot info
   */
  public async getMe(customToken?: string) {
    return this.callApi('getMe', {}, customToken);
  }

  /**
   * Helper to ensure clean base Web App URLs for Telegram Mini App
   */
  public getVersionedWebAppUrl(baseUrl: string, param?: string): string {
    if (!baseUrl) return '';
    const cleanUrl = baseUrl.replace(/([?&])v=[^&]*(&|$)/g, '$1').replace(/[?&]$/, '');
    if (param) {
      const sep = cleanUrl.includes('?') ? '&' : '?';
      return `${cleanUrl}${sep}startapp=${encodeURIComponent(param)}`;
    }
    return cleanUrl;
  }

  /**
   * Configure persistent Menu Button in Telegram Chat.
   * - buttonType: 'commands' (default) displays the persistent blue [ ☰ Menu ] button beside the input box (no need to type /)
   * - buttonType: 'web_app' displays a direct Mini App button
   */
  public async setChatMenuButton(
    arg1?: 'commands' | 'web_app' | string,
    webAppUrl?: string
  ): Promise<{ success: boolean; message: string }> {
    let buttonType: 'commands' | 'web_app' = 'commands';
    let targetUrl = webAppUrl;

    if (typeof arg1 === 'string') {
      if (arg1 === 'commands' || arg1 === 'web_app') {
        buttonType = arg1;
      } else if (arg1.startsWith('http')) {
        buttonType = 'web_app';
        targetUrl = arg1;
      }
    }

    let menuButtonPayload: any;

    if (buttonType === 'commands') {
      menuButtonPayload = {
        type: 'commands'
      };
    } else {
      const cfg = await this.getConfig();
      const rawUrl = targetUrl || cfg.webAppUrl;

      if (!rawUrl) {
        return { success: false, message: 'Web App URL is required to set web_app menu button' };
      }

      const url = this.getVersionedWebAppUrl(rawUrl);
      menuButtonPayload = {
        type: 'web_app',
        text: '🎮 Play Bingo',
        web_app: {
          url
        }
      };
    }

    const res = await this.callApi('setChatMenuButton', {
      menu_button: menuButtonPayload
    });

    if (res.ok) {
      return {
        success: true,
        message: buttonType === 'commands'
          ? 'Persistent blue [ ☰ Menu ] button configured successfully on Telegram!'
          : 'Persistent Mini App Menu Button configured successfully on Telegram!'
      };
    }
    return { success: false, message: res.description || 'Failed to set chat menu button' };
  }

  /**
   * Set Bot Description (shown on empty chat before clicking Start)
   */
  public async setMyDescription(description: string): Promise<{ success: boolean; message: string }> {
    const res = await this.callApi('setMyDescription', { description });
    if (res.ok) {
      return { success: true, message: 'Bot description updated successfully on Telegram!' };
    }
    return { success: false, message: res.description || 'Failed to update bot description' };
  }

  /**
   * Set Bot Short Description (shown on bot profile & when sharing)
   */
  public async setMyShortDescription(shortDescription: string): Promise<{ success: boolean; message: string }> {
    const res = await this.callApi('setMyShortDescription', { short_description: shortDescription });
    if (res.ok) {
      return { success: true, message: 'Bot short description updated successfully on Telegram!' };
    }
    return { success: false, message: res.description || 'Failed to update bot short description' };
  }

  /**
   * Get current Bot Description from Telegram
   */
  public async getMyDescription(): Promise<{ ok: boolean; description?: string; error?: string }> {
    const res = await this.callApi('getMyDescription', {});
    if (res.ok) {
      return { ok: true, description: res.result?.description || '' };
    }
    return { ok: false, error: res.description };
  }

  /**
   * Register Webhook with Telegram API
   */
  public async setWebhook(customWebhookUrl?: string): Promise<{ success: boolean; message: string }> {
    const defaultBackendOrigin = process.env.TELEGRAM_WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL || 'https://sonic-bingo-enod.onrender.com';
    let rawUrl = customWebhookUrl || (defaultBackendOrigin ? `${defaultBackendOrigin}/api/telegram-webhook` : (cfg.webAppUrl ? `${cfg.webAppUrl}/api/telegram-webhook` : ''));
    if (!rawUrl) {
      return { success: false, message: 'Webhook URL is required (configure TELEGRAM_WEBAPP_URL in Admin Desk or .env)' };
    }
    rawUrl = rawUrl.replace(/\/+$/, '');
    if (!rawUrl.endsWith('/api/telegram-webhook') && !rawUrl.endsWith('/api/telegram/webhook') && !rawUrl.endsWith('/telegram-webhook')) {
      rawUrl = `${rawUrl}/api/telegram-webhook`;
    }

    const res = await this.callApi('setWebhook', {
      url: rawUrl,
      drop_pending_updates: false,
      allowed_updates: ['message', 'my_chat_member']
    });

    if (res.ok) {
      return { success: true, message: `Telegram Webhook registered successfully to ${rawUrl}!` };
    }
    return { success: false, message: res.description || 'Failed to register webhook' };
  }

  /**
   * Get Webhook Info from Telegram API
   */
  public async getWebhookInfo(): Promise<{ ok: boolean; result?: any; error?: string }> {
    const res = await this.callApi('getWebhookInfo', {});
    if (res.ok) {
      return { ok: true, result: res.result };
    }
    return { ok: false, error: res.description };
  }

  /**
   * Register official Bot Commands list (visible in Telegram's [/] menu)
   */
  public async setMyCommands(customCommands?: Array<{ command: string; description: string }>): Promise<{ success: boolean; message: string }> {
    const commands = customCommands || [
      { command: 'play', description: '🎮 Launch Lomi Bingo Mini App' },
      { command: 'start', description: '🍋 Welcome & 10 ETB Bonus Gift' },
      { command: 'promo', description: '📢 View Active Promotions & Offers' },
      { command: 'bonus', description: '🎁 Claim 10 ETB Welcome Bonus' },
      { command: 'help', description: '📖 How to Play & Win' }
    ];

    const res = await this.callApi('setMyCommands', { commands });
    if (res.ok) {
      return { success: true, message: 'Bot commands registered successfully in Telegram [/] menu!' };
    }
    return { success: false, message: res.description || 'Failed to set bot commands' };
  }

  /**
   * Get current Bot Commands registered in Telegram
   */
  public async getMyCommands(): Promise<{ ok: boolean; commands?: any[]; error?: string }> {
    const res = await this.callApi('getMyCommands', {});
    if (res.ok) {
      return { ok: true, commands: res.result || [] };
    }
    return { ok: false, error: res.description };
  }

  /**
   * Send text message with HTML parsing and optional inline buttons
   */
  public async sendMessage(chatId: string | number, text: string, options: {
    inlineKeyboard?: any[][];
    pin?: boolean;
    disablePreview?: boolean;
  } = {}) {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: options.disablePreview ?? false
    };

    if (options.inlineKeyboard && options.inlineKeyboard.length > 0) {
      payload.reply_markup = { inline_keyboard: options.inlineKeyboard };
    }

    const res = await this.callApi('sendMessage', payload);
    if (res.ok && options.pin && res.result?.message_id) {
      await this.callApi('pinChatMessage', {
        chat_id: chatId,
        message_id: res.result.message_id,
        disable_notification: false
      });
    }
    return res;
  }

  /**
   * Send photo with caption and optional inline buttons
   */
  public async sendPhoto(chatId: string | number, photoUrl: string, caption: string, options: {
    inlineKeyboard?: any[][];
    pin?: boolean;
  } = {}) {
    const payload: any = {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML'
    };

    if (options.inlineKeyboard && options.inlineKeyboard.length > 0) {
      payload.reply_markup = { inline_keyboard: options.inlineKeyboard };
    }

    const res = await this.callApi('sendPhoto', payload);
    if (res.ok && options.pin && res.result?.message_id) {
      await this.callApi('pinChatMessage', {
        chat_id: chatId,
        message_id: res.result.message_id,
        disable_notification: false
      });
    }
    return res;
  }

  /**
   * Delete a single message by ID in a chat or channel
   */
  public async deleteMessage(chatId: string | number, messageId: number): Promise<{ ok: boolean; description?: string }> {
    return await this.callApi('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  }

  /**
   * Delete multiple messages in a chat or channel (up to 100 per call)
   */
  public async deleteMessages(chatId: string | number, messageIds: number[]): Promise<{ ok: boolean; description?: string }> {
    return await this.callApi('deleteMessages', {
      chat_id: chatId,
      message_ids: messageIds
    });
  }

  /**
   * Purge legacy posts from a Telegram Channel so players cannot click stale buttons.
   * Sends a probe to discover the current latest message ID, then deletes past messages.
   */
  public async purgeChannelPosts(targetChat?: string, maxScan: number = 100): Promise<{
    success: boolean;
    channel: string;
    deletedCount: number;
    scannedCount: number;
    message: string;
  }> {
    const cfg = await this.getConfig();
    const channel = (targetChat || cfg.channelId || '@lomibingo_official').trim();

    if (!channel) {
      return { success: false, channel: '', deletedCount: 0, scannedCount: 0, message: 'No target channel specified' };
    }

    // Step 1: Send a lightweight probe message to find the latest message_id
    const probeRes = await this.sendMessage(channel, '🧹 <i>Cleaning older promotional announcements...</i>');
    if (!probeRes.ok || !probeRes.result?.message_id) {
      return {
        success: false,
        channel,
        deletedCount: 0,
        scannedCount: 0,
        message: `Failed to access channel ${channel}: ${probeRes.description || 'Ensure bot is channel Administrator with Delete Messages permission.'}`
      };
    }

    const latestId = probeRes.result.message_id;
    // Delete the probe immediately
    await this.deleteMessage(channel, latestId);

    let deletedCount = 0;
    let scannedCount = 0;

    // Scan backwards from latestId - 1
    const startId = latestId - 1;
    const endId = Math.max(1, latestId - maxScan);

    console.log(`🧹 [TelegramBot] Purging channel posts in ${channel} from ID ${startId} down to ${endId}...`);

    for (let id = startId; id >= endId; id--) {
      scannedCount++;
      const delRes = await this.deleteMessage(channel, id);
      if (delRes.ok) {
        deletedCount++;
        console.log(`  ✓ Deleted message #${id} in ${channel}`);
      }
      // Avoid Telegram flood limits (small pause every 10 calls)
      if (scannedCount % 10 === 0) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return {
      success: true,
      channel,
      deletedCount,
      scannedCount,
      message: `Successfully purged ${deletedCount} older messages from ${channel}.`
    };
  }

  /**
   * Check if bot can post to a channel and return its permissions
   */
  public async verifyChannelStatus(channelInput?: string): Promise<{
    ok: boolean;
    channel: string;
    title?: string;
    canPost: boolean;
    isAdministrator: boolean;
    description: string;
  }> {
    const cfg = await this.getConfig();
    const channel = this.normalizeChannelIdentifier(channelInput || cfg.channelId || '@lomibingo_official');
    if (!channel) {
      return { ok: false, channel: '', canPost: false, isAdministrator: false, description: 'No channel configured' };
    }

    const meRes = await this.getMe();
    if (!meRes.ok || !meRes.result?.id) {
      return { ok: false, channel, canPost: false, isAdministrator: false, description: 'Telegram Bot Token is invalid or disconnected' };
    }

    const botId = meRes.result.id;
    const botUser = meRes.result.username || 'bot';

    // 1. Get Chat details
    const chatRes = await this.callApi('getChat', { chat_id: channel });
    if (!chatRes.ok) {
      return {
        ok: false,
        channel,
        canPost: false,
        isAdministrator: false,
        description: `Channel ${channel} was not found. Please verify the username or link.`
      };
    }

    // 2. Check if bot is administrator
    const memberRes = await this.callApi('getChatMember', { chat_id: channel, user_id: botId });
    if (!memberRes.ok) {
      return {
        ok: false,
        channel,
        title: chatRes.result?.title,
        canPost: false,
        isAdministrator: false,
        description: `@${botUser} is not an administrator of ${channel}. Please add @${botUser} to Channel Administrators with 'Post Messages' enabled.`
      };
    }

    const member = memberRes.result;
    const isAdm = member.status === 'administrator' || member.status === 'creator';
    const canPost = isAdm && (member.status === 'creator' || member.can_post_messages === true);

    return {
      ok: canPost,
      channel,
      title: chatRes.result?.title,
      isAdministrator: isAdm,
      canPost,
      description: canPost
        ? `Bot @${botUser} is an active Administrator in ${chatRes.result?.title || channel} with 'Post Messages' enabled.`
        : `@${botUser} is an admin in ${channel} but lacks 'Post Messages' permission.`
    };
  }

  /**
   * Execute Broadcast Campaign:
   * Supports Channel / Group posting, direct 1-on-1 player broadcasts, or test messages.
   */
  public async broadcast(opts: BroadcastOptions): Promise<{
    success: boolean;
    campaignId?: number;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    message: string;
    channelResult?: any;
  }> {
    const cfg = await this.getConfig();
    if (!cfg.token) {
      return { success: false, totalRecipients: 0, sentCount: 0, failedCount: 0, message: 'Telegram Bot Token is not configured' };
    }

    const meRes = await this.getMe();
    const botUser = meRes.result?.username || 'LomiBingobot';

    // Build inline keyboard if button details provided
    const inlineKeyboard: any[][] = [];
    if (opts.buttonText) {
      const btnUrl = opts.buttonUrl || cfg.webAppUrl;
      if (btnUrl) {
        if (opts.targetType === 'channel' || opts.targetType === 'group') {
          // In Telegram channels/groups, Telegram requires a Direct Mini App link (https://t.me/<bot>/<app>)
          // so Telegram natively opens the in-app Mini App modal instead of prompting an external browser link.
          let channelBtnUrl = (opts.buttonUrl || '').trim();
          if (!channelBtnUrl || channelBtnUrl.includes('onrender.com') || channelBtnUrl.includes('workers.dev') || channelBtnUrl.includes('pages.dev') || channelBtnUrl === cfg.webAppUrl) {
            channelBtnUrl = `https://t.me/${botUser}/play`;
          }
          inlineKeyboard.push([
            { text: opts.buttonText, url: channelBtnUrl }
          ]);
        } else {
          // In direct 1-on-1 chats between user and bot, web_app is fully supported
          const isPlayAction = opts.buttonText.toLowerCase().includes('play') || opts.buttonText.toLowerCase().includes('bingo') || opts.buttonText.toLowerCase().includes('game') || opts.buttonText.toLowerCase().includes('bonus');
          if (isPlayAction) {
            // Telegram Bot API Rule: web_app.url MUST be an HTTPS web page (e.g. cfg.webAppUrl), NEVER a t.me link!
            let startParam: string | undefined;
            if (btnUrl.includes('startapp=')) {
              const match = btnUrl.match(/startapp=([^&]+)/);
              if (match) startParam = decodeURIComponent(match[1]);
            }
            const targetWebUrl = (!btnUrl || btnUrl.includes('t.me')) ? (cfg.webAppUrl || 'https://sonic-bingo-enod.onrender.com') : btnUrl;
            const versionedUrl = this.getVersionedWebAppUrl(targetWebUrl, startParam);
            inlineKeyboard.push([
              { text: opts.buttonText, web_app: { url: versionedUrl } }
            ]);
          } else {
            const isWeb = btnUrl.startsWith('http') && !btnUrl.includes('t.me');
            if (isWeb) {
              const targetUrl = this.getVersionedWebAppUrl(btnUrl);
              inlineKeyboard.push([
                { text: opts.buttonText, web_app: { url: targetUrl } }
              ]);
            } else {
              inlineKeyboard.push([
                { text: opts.buttonText, url: btnUrl }
              ]);
            }
          }
        }
      }
    }

    // 1. Single Channel or Group Broadcast
    if (opts.targetType === 'channel' || opts.targetType === 'group') {
      const rawTarget = opts.targetId || cfg.channelId || '@lomibingo_official';
      const targetChat = this.normalizeChannelIdentifier(rawTarget);
      if (!targetChat) {
        return { success: false, totalRecipients: 0, sentCount: 0, failedCount: 0, message: 'Target channel or group username/ID is missing' };
      }

      // Guardrail 1: Block positive numeric user IDs (Telegram channels always use @username or negative IDs starting with -100)
      if (/^\d+$/.test(targetChat)) {
        return {
          success: false,
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 1,
          message: `Cannot post to '${targetChat}'. That is an individual Telegram user ID, not a Channel. Telegram Channel usernames start with '@' (e.g. @lomibingo_official) or channel chat IDs start with -100 (e.g. -100xxxxxxx).`
        };
      }

      // Check if user accidentally entered the bot's own username as the channel
      if (targetChat.toLowerCase() === `@${botUser.toLowerCase()}` || targetChat.toLowerCase() === botUser.toLowerCase()) {
        return {
          success: false,
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 1,
          message: `Cannot post to @${botUser}. In Telegram, a bot is an interactive chat, not a channel with a public feed. To post an announcement, add @${botUser} as an Administrator to your Telegram Channel (e.g. @YourChannel), or select 'All Players (Direct)' to message registered users.`
        };
      }

      let res;
      if (opts.photoUrl) {
        res = await this.sendPhoto(targetChat, opts.photoUrl, opts.messageText, {
          inlineKeyboard,
          pin: opts.pinMessage
        });
      } else {
        res = await this.sendMessage(targetChat, opts.messageText, {
          inlineKeyboard,
          pin: opts.pinMessage
        });
      }

      const sent = res.ok ? 1 : 0;
      const failed = res.ok ? 0 : 1;

      // Friendly diagnostic description for common Telegram API issues
      let friendlyError = res.description;
      if (!res.ok) {
        const desc = (res.description || '').toLowerCase();
        if (desc.includes('chat not found')) {
          friendlyError = `Channel '${targetChat}' not found. Please verify the channel @username exists, and make sure @${botUser} has been added as an Administrator to that channel with 'Post Messages' permission.`;
        } else if (desc.includes('not a member') || desc.includes('not an administrator') || desc.includes('need administrator rights')) {
          friendlyError = `@${botUser} is not an Administrator of ${targetChat}. Open Channel Info -> Administrators -> Add Admin -> search @${botUser} and enable 'Post Messages'.`;
        } else if (desc.includes("can't send messages to the bot")) {
          friendlyError = `A bot cannot post messages to itself. Please specify a Telegram Channel (e.g. @YourChannel) where @${botUser} is an Administrator, or select 'All Players (Direct)'.`;
        } else if (desc.includes('bot was blocked by the user') || desc.includes("can't initiate conversation")) {
          friendlyError = `Failed to post to '${targetChat}': The target identifier belongs to an individual user who blocked the bot. Telegram Channels start with @ (e.g. @lomibingo_official) or -100.`;
        }
      }

      // Save record in database with automatic sequence self-healing
      let insertRes;
      try {
        insertRes = await query(
          `INSERT INTO telegram_broadcasts 
           (title, message_text, photo_url, button_text, button_url, target_type, target_id, pin_message, total_recipients, sent_count, failed_count, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [
            opts.title,
            opts.messageText,
            opts.photoUrl || null,
            opts.buttonText || null,
            opts.buttonUrl || null,
            opts.targetType,
            targetChat,
            opts.pinMessage || false,
            1,
            sent,
            failed,
            res.ok ? 'completed' : 'failed'
          ]
        );
      } catch (err: any) {
        if (err.message && err.message.includes('telegram_broadcasts_pkey')) {
          console.warn('⚠️ [telegram_broadcasts_pkey sequence desync detected]. Auto-repairing sequence and retrying...');
          await this.healBroadcastSequence();
          insertRes = await query(
            `INSERT INTO telegram_broadcasts 
             (title, message_text, photo_url, button_text, button_url, target_type, target_id, pin_message, total_recipients, sent_count, failed_count, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id`,
            [
              opts.title,
              opts.messageText,
              opts.photoUrl || null,
              opts.buttonText || null,
              opts.buttonUrl || null,
              opts.targetType,
              targetChat,
              opts.pinMessage || false,
              1,
              sent,
              failed,
              res.ok ? 'completed' : 'failed'
            ]
          );
        } else {
          throw err;
        }
      }

      return {
        success: res.ok,
        campaignId: insertRes.rows[0]?.id,
        totalRecipients: 1,
        sentCount: sent,
        failedCount: failed,
        message: res.ok ? `Successfully published announcement to ${targetChat}!` : (friendlyError || 'Failed to post to Telegram')
      };
    }

    // 2. Direct Test Message to Admin
    if (opts.targetType === 'test') {
      const testChatId = opts.targetId;
      if (!testChatId) {
        return { success: false, totalRecipients: 0, sentCount: 0, failedCount: 0, message: 'Please enter your Telegram User ID for the test message' };
      }

      let res;
      if (opts.photoUrl) {
        res = await this.sendPhoto(testChatId, opts.photoUrl, opts.messageText, { inlineKeyboard });
      } else {
        res = await this.sendMessage(testChatId, opts.messageText, { inlineKeyboard });
      }

      let testErrorMessage = res.description || 'Test send failed';
      if (!res.ok) {
        const desc = (res.description || '').toLowerCase();
        if (desc.includes('bot was blocked by the user')) {
          testErrorMessage = `Telegram user ${testChatId} has blocked or stopped @${botUser}. Please open @${botUser} on Telegram, tap Start or Unblock, and try again.`;
        } else if (desc.includes("can't initiate conversation") || desc.includes('chat not found')) {
          testErrorMessage = `Bot cannot initiate chat with user ${testChatId}. Please open @${botUser} on Telegram, send /start, and try again.`;
        }
      }

      return {
        success: res.ok,
        totalRecipients: 1,
        sentCount: res.ok ? 1 : 0,
        failedCount: res.ok ? 0 : 1,
        message: res.ok ? 'Test ad preview delivered successfully to your Telegram!' : testErrorMessage
      };
    }

    // 3. Mass Broadcast to all active bot players (all registered players with Telegram IDs)
    const usersRes = await query(
      `SELECT DISTINCT telegram_id 
       FROM users 
       WHERE telegram_id IS NOT NULL 
         AND telegram_id > 0
         AND (bot_blocked IS NULL OR bot_blocked = FALSE)
       ORDER BY telegram_id ASC`
    );

    const recipients = usersRes.rows.map((r: any) => r.telegram_id);
    const totalRecipients = recipients.length;

    if (totalRecipients === 0) {
      return { success: false, totalRecipients: 0, sentCount: 0, failedCount: 0, message: 'No registered players with Telegram IDs found' };
    }

    // Persist as active in-bot promotion for /promo
    try {
      let activeBtnUrl = (opts.buttonUrl || '').trim();
      if (!activeBtnUrl || activeBtnUrl.includes('onrender.com')) {
        activeBtnUrl = cfg.webAppUrl || `https://t.me/${botUser}/play`;
      }
      await query(
        `INSERT INTO admin_settings (key, value, updated_at)
         VALUES 
           ('telegram_active_promo_title', $1, NOW()),
           ('telegram_active_promo_text', $2, NOW()),
           ('telegram_active_promo_photo', $3, NOW()),
           ('telegram_active_promo_button_text', $4, NOW()),
           ('telegram_active_promo_button_url', $5, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [opts.title, opts.messageText, opts.photoUrl || '', opts.buttonText || '', activeBtnUrl]
      );
    } catch (e) {
      console.warn('Could not save active promo settings:', e);
    }

    // Insert broadcast entry in 'sending' state with sequence self-healing
    let insertRes;
    try {
      insertRes = await query(
        `INSERT INTO telegram_broadcasts 
         (title, message_text, photo_url, button_text, button_url, target_type, target_id, pin_message, total_recipients, sent_count, failed_count, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'sending')
         RETURNING id`,
        [
          opts.title,
          opts.messageText,
          opts.photoUrl || null,
          opts.buttonText || null,
          opts.buttonUrl || null,
          opts.targetType,
          'all_users',
          false,
          totalRecipients,
          0,
          0
        ]
      );
    } catch (err: any) {
      if (err.message && err.message.includes('telegram_broadcasts_pkey')) {
        console.warn('⚠️ [telegram_broadcasts_pkey sequence desync detected]. Auto-repairing sequence and retrying...');
        await this.healBroadcastSequence();
        insertRes = await query(
          `INSERT INTO telegram_broadcasts 
           (title, message_text, photo_url, button_text, button_url, target_type, target_id, pin_message, total_recipients, sent_count, failed_count, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'sending')
           RETURNING id`,
          [
            opts.title,
            opts.messageText,
            opts.photoUrl || null,
            opts.buttonText || null,
            opts.buttonUrl || null,
            opts.targetType,
            'all_users',
            false,
            totalRecipients,
            0,
            0
          ]
        );
      } else {
        throw err;
      }
    }
    const campaignId = insertRes.rows[0]?.id;

    // Asynchronous batch dispatch (Telegram 30 msgs/sec rate-limit friendly)
    (async () => {
      let sentCount = 0;
      let failedCount = 0;
      const batchSize = 25;

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (chatId: number) => {
            try {
              let res;
              if (opts.photoUrl) {
                res = await this.sendPhoto(chatId, opts.photoUrl, opts.messageText, { inlineKeyboard });
              } else {
                res = await this.sendMessage(chatId, opts.messageText, { inlineKeyboard });
              }

              if (res.ok) {
                sentCount++;
                query('UPDATE users SET bot_started = TRUE, bot_blocked = FALSE WHERE telegram_id = $1', [chatId]).catch(() => { });
              } else {
                failedCount++;
                const desc = (res.description || '').toLowerCase();
                // If user blocked bot, deactivated account, or cannot initiate conversation, mark bot_blocked = TRUE so future broadcasts skip them
                if (desc.includes('bot was blocked by the user') || desc.includes('user is deactivated') || desc.includes("can't initiate")) {
                  query('UPDATE users SET bot_blocked = TRUE, bot_started = FALSE WHERE telegram_id = $1', [chatId]).catch(() => { });
                }
              }
            } catch {
              failedCount++;
            }
          })
        );

        // Sleep 1 second between batches to avoid Telegram rate limits
        if (i + batchSize < recipients.length) {
          await new Promise(r => setTimeout(r, 1050));
        }
      }

      await query(
        `UPDATE telegram_broadcasts 
         SET sent_count = $1, failed_count = $2, status = 'completed'
         WHERE id = $3`,
        [sentCount, failedCount, campaignId]
      );
      console.log(`📢 [Telegram Broadcast Completed] ID: ${campaignId}, Sent: ${sentCount}, Failed: ${failedCount}`);
    })().catch(err => {
      console.error('❌ [Broadcast Queue Error]:', err);
    });

    // Execute concurrent channel cross-post if requested
    let channelCrossPostResult: any = null;
    if (opts.crossPostChannel) {
      const channelChat = this.normalizeChannelIdentifier(cfg.channelId || '@lomibingo_official');
      try {
        let chanRes;
        const channelKeyboard: any[][] = [];
        if (opts.buttonText) {
          let channelBtnUrl = (opts.buttonUrl || '').trim();
          if (!channelBtnUrl || channelBtnUrl.includes('onrender.com') || channelBtnUrl.includes('workers.dev') || channelBtnUrl.includes('pages.dev') || channelBtnUrl === cfg.webAppUrl) {
            channelBtnUrl = `https://t.me/${botUser}/play`;
          }
          channelKeyboard.push([{ text: opts.buttonText, url: channelBtnUrl }]);
        }

        if (opts.photoUrl) {
          chanRes = await this.sendPhoto(channelChat, opts.photoUrl, opts.messageText, {
            inlineKeyboard: channelKeyboard,
            pin: opts.pinMessage
          });
        } else {
          chanRes = await this.sendMessage(channelChat, opts.messageText, {
            inlineKeyboard: channelKeyboard,
            pin: opts.pinMessage
          });
        }

        channelCrossPostResult = {
          success: chanRes.ok,
          channel: channelChat,
          messageId: chanRes.result?.message_id,
          error: chanRes.ok ? undefined : chanRes.description
        };
      } catch (err: any) {
        channelCrossPostResult = {
          success: false,
          channel: channelChat,
          error: err.message
        };
      }
    }

    const chanNotice = channelCrossPostResult
      ? (channelCrossPostResult.success
          ? ` and announcement published to ${channelCrossPostResult.channel}!`
          : ` (Channel cross-post note: ${channelCrossPostResult.error})`)
      : '';

    return {
      success: true,
      campaignId,
      totalRecipients,
      sentCount: 0,
      failedCount: 0,
      channelResult: channelCrossPostResult,
      message: `Broadcast started to ${totalRecipients} players${chanNotice}`
    };
  }

  /**
   * Automated Big Jackpot / Mega Winner Channel Announcement
   */
  public async announceBigWinner(winnerName: string, amount: number, roomName: string, cartelaId: number) {
    const cfg = await this.getConfig();
    if (!cfg.autoPostMegaWins || !cfg.channelId || !cfg.token) {
      return;
    }

    if (amount < (cfg.megaWinThreshold || 300)) {
      return;
    }

    const text =
      `🏆 <b>MEGA WINNER IN LOMI BINGO!</b> 🍋🎉

💰 <b>Player:</b> ${winnerName}
💵 <b>Winning Amount:</b> <b>+${amount.toFixed(2)} ETB!</b>
🏟️ <b>Room:</b> ${roomName}
🎟️ <b>Winning Cartela:</b> #${cartelaId}

⚡ <i>The next round is starting now! Tap below to join and claim your win!</i>`;

    const meRes = await this.getMe();
    const botUser = meRes.result?.username || 'LomiBingobot';
    const channelPlayUrl = `https://t.me/${botUser}/play`;

    const inlineKeyboard = [
      [{ text: '🎯 Play Bingo Now & Win!', url: channelPlayUrl }]
    ];

    try {
      await this.sendMessage(cfg.channelId, text, {
        inlineKeyboard,
        disablePreview: true
      });
      console.log(`📢 [Telegram Channel Winner Posted] ${winnerName} won ${amount} ETB`);
    } catch (e) {
      console.warn('Failed to announce winner on Telegram channel:', e);
    }
  }

  /**
   * Inbound Telegram Webhook update handler (/start, /play, /help)
   */
  public async handleWebhookUpdate(update: any): Promise<boolean> {
    if (!update) return false;

    // Auto-detect when bot is added as Administrator to a Channel or Supergroup
    if (update.my_chat_member?.chat) {
      const chat = update.my_chat_member.chat;
      const chatType = chat.type;
      const newStatus = update.my_chat_member.new_chat_member?.status;

      // 1. ONLY legitimate Channels or Supergroups can update the global telegram_channel_id
      if ((chatType === 'channel' || chatType === 'supergroup') &&
        (newStatus === 'administrator' || newStatus === 'creator')) {
        const targetIdentifier = chat.username ? `@${chat.username}` : String(chat.id);
        console.log(`📢 [Telegram Bot added to Channel/Group]:`, chat.title, targetIdentifier);
        try {
          await query(
            `INSERT INTO admin_settings (key, value, updated_at)
             VALUES ('telegram_channel_id', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [targetIdentifier]
          );
          this.clearConfigCache();
        } catch (e) {
          console.warn('Failed to auto-save channel id from my_chat_member:', e);
        }
        return true;
      }

      // 2. Private 1-on-1 User chats: Track user block / unblock lifecycle
      if (chatType === 'private' && chat.id) {
        try {
          if (newStatus === 'kicked') {
            await query('UPDATE users SET bot_blocked = TRUE, bot_started = FALSE WHERE telegram_id = $1', [chat.id]);
            console.log(`👤 [Telegram User blocked/stopped bot]: ${chat.id} marked as bot_blocked=TRUE`);
          } else if (newStatus === 'member') {
            await query('UPDATE users SET bot_blocked = FALSE, bot_started = TRUE WHERE telegram_id = $1', [chat.id]);
            console.log(`👤 [Telegram User started/unblocked bot]: ${chat.id} marked as bot_started=TRUE`);
          }
        } catch (e) {
          console.warn('Failed to update player bot_started status from my_chat_member:', e);
        }
        return true;
      }

      return true;
    }

    if (!update.message) return false;
    const msg = update.message;
    const chatId = msg.chat?.id;
    const text = (msg.text || '').trim();

    console.log(`📩 [Telegram Webhook] Received from ${chatId} (${msg.from?.username || msg.from?.first_name}): "${text}"`);

    if (!chatId) return false;

    const cfg = await this.getConfig();
    const webAppUrl = cfg.webAppUrl || 'https://t.me';

    // Track bot started in DB
    if (msg.from?.id) {
      try {
        await query(
          'UPDATE users SET bot_started = TRUE WHERE telegram_id = $1',
          [msg.from.id]
        );
      } catch { }
    }

    if (text.startsWith('/start') || text === '/play') {
      if (process.env.MAINTENANCE_MODE === 'true') {
        const maintenanceMsg =
          `🛠️ <b>ውድ ደንበኞቻችን፣ ሎሚ ቢንጎ በጊዜያዊ ጥገና ላይ ነው!</b> 🍋\n\n` +
          `ስርዓታችንን ለማሻሻል እና የተሻለ አገልግሎት ለመስጠት ጨዋታው ለጥቂት ሰዓታት በጊዜያዊ ጥገና ላይ ይቆያል።\n\n` +
          `🔒 <b>የእርስዎ ቀሪ ሂሳብ እና ገንዘብ 100% ደህንነቱ የተጠበቀ ነው!</b>\n` +
          `በቅርቡ በታላቅ ማሻሻያ እንመለሳለን።\n\n` +
          `📢 <i>ዝርዝር መረጃ ለማግኘት ቻናላችንን ይከታተሉ: @lomibingo_official</i>\n\n` +
          `────────────────\n` +
          `🛠️ <b>Lomi Bingo is under scheduled maintenance.</b>\n` +
          `All player wallet balances are 100% safe. We will be back online shortly!`;

        await this.sendMessage(chatId, maintenanceMsg);
        return true;
      }

      const parts = text.split(' ');
      const startParam = parts.length > 1 ? parts[1].trim() : '';
      const playAppUrl = this.getVersionedWebAppUrl(webAppUrl, startParam);

      let welcomeText =
        `👋 <b>እንኳን ወደ ሎሚ ቢንጎ በደህና መጡ!</b> 🍋🎯
<b>Welcome to Lomi / Betika Bingo!</b>

🇪🇹 Ethiopia's #1 Real-Time Multiplayer Live Bingo in Telegram!

🎁 <b>10 ETB Welcome Bonus</b> for new players
⚡ <b>Instant Cashier Withdrawals & Deposits</b>
🎙️ <b>Authentic Voice Caller</b> in Amharic and English!
🛡️ <b>Disconnect Protection:</b> Never lose a win even on network drops!

Tap the button below to launch the game and start winning! 👇`;
      let welcomePhoto = '';

      try {
        const settingsRes = await query(
          `SELECT key, value FROM admin_settings WHERE key IN ('telegram_bot_welcome_text', 'telegram_bot_welcome_photo')`
        );
        for (const row of settingsRes.rows) {
          if (row.key === 'telegram_bot_welcome_text' && row.value && row.value.trim()) {
            welcomeText = row.value.trim();
          } else if (row.key === 'telegram_bot_welcome_photo' && row.value && row.value.trim()) {
            welcomePhoto = row.value.trim();
          }
        }
      } catch (e) {
        console.warn('Could not read custom welcome greeting:', e);
      }

      const channelLink = cfg.channelId ? `https://t.me/${cfg.channelId.replace('@', '')}` : 'https://t.me/lomibingo_official';

      const inlineKeyboard = [
        [{ text: '🎮 Play Bingo Now (10 ETB Gift)', web_app: { url: playAppUrl } }],
        [{ text: '📢 Join Official Channel', url: channelLink }]
      ];

      if (welcomePhoto) {
        await this.sendPhoto(chatId, welcomePhoto, welcomeText, { inlineKeyboard });
      } else {
        await this.sendMessage(chatId, welcomeText, { inlineKeyboard });
      }
      return true;
    }

    if (text === '/help') {
      const helpText =
        `📖 <b>Lomi Bingo Help & Guides</b> 🍋

1️⃣ <b>Select a Room:</b> Choose 10, 20, 50, or 100 ETB stake room.
2️⃣ <b>Pick Cartelas:</b> Choose 1 or 2 cartelas from 400 serial numbers.
3️⃣ <b>Daub & Win:</b> Watch real-time live ball calls or activate Auto-Daub!
4️⃣ <b>Withdrawals:</b> Telebirr, CBE Birr & Cashier processed instantly.

Tap below to jump into the arena:`;

      await this.sendMessage(chatId, helpText, {
        inlineKeyboard: [
          [{ text: '🎮 Open Bingo Arena', web_app: { url: this.getVersionedWebAppUrl(webAppUrl) } }]
        ]
      });
      return true;
    }

    if (text === '/bonus') {
      const bonusText =
        `🎁 <b>የአዲስ ደንበኛ 10 ETB ነፃ ቦነስ!</b> 🍋
<b>10 ETB Welcome Bonus for New Players!</b>

ካርቴላ ለመቁረጥ እና ለማሸነፍ አሁኑኑ ጨዋታውን ይክፈቱ!
Open the game below to claim your free welcome bonus cartela! 👇`;

      await this.sendMessage(chatId, bonusText, {
        inlineKeyboard: [
          [{ text: '🎁 Claim 10 ETB & Play Now', web_app: { url: this.getVersionedWebAppUrl(webAppUrl) } }]
        ]
      });
      return true;
    }

    if (text === '/promo' || text === '/promotion' || text === '/promotions') {
      let promoText =
        `🎁 <b>የሎሚ ቢንጎ ልዩ ማስተዋወቂያዎች!</b> 🍋✨
<b>Active Lomi Bingo Promotions:</b>

🎉 <b>1. 10 ETB የነፃ ቦነስ ስጦታ</b> ለሁሉም አዳዲስ ደንበኞች!
💰 <b>2. 10,000 ETB የሳምንቱ መጨረሻ ውድድር!</b>
⚡ <b>3. 200% ተቀማጭ ቦነስ</b> በቴሌብር እና በሲቢኢ ብር!

👇 አሁኑኑ ጨዋታውን ይክፈቱ እና ያሸንፉ!`;
      let promoPhoto = '';
      let btnText = '🎮 Play Bingo & Claim Offer';
      let btnUrl = `https://t.me/LomiBingobot/play`;

      try {
        const promoRes = await query(
          `SELECT key, value FROM admin_settings WHERE key IN ('telegram_active_promo_text', 'telegram_active_promo_photo', 'telegram_active_promo_button_text', 'telegram_active_promo_button_url')`
        );
        for (const row of promoRes.rows) {
          if (row.key === 'telegram_active_promo_text' && row.value?.trim()) promoText = row.value.trim();
          if (row.key === 'telegram_active_promo_photo' && row.value?.trim()) promoPhoto = row.value.trim();
          if (row.key === 'telegram_active_promo_button_text' && row.value?.trim()) btnText = row.value.trim();
          if (row.key === 'telegram_active_promo_button_url' && row.value?.trim()) btnUrl = row.value.trim();
        }
      } catch { }

      const isHttpWebApp = btnUrl.startsWith('http') && !btnUrl.includes('t.me');
      const finalBtnUrl = isHttpWebApp ? this.getVersionedWebAppUrl(btnUrl) : btnUrl;

      const inlineKeyboard = isHttpWebApp
        ? [[{ text: btnText, web_app: { url: finalBtnUrl } }]]
        : [[{ text: btnText, url: finalBtnUrl }]];

      if (promoPhoto) {
        await this.sendPhoto(chatId, promoPhoto, promoText, { inlineKeyboard });
      } else {
        await this.sendMessage(chatId, promoText, { inlineKeyboard });
      }
      return true;
    }

    return false;
  }
}

export const telegramBotService = TelegramBotService.getInstance();
