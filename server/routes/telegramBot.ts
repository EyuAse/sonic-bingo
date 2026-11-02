import { Router } from 'express';
import { telegramBotService } from '../services/telegramBotService.ts';
import { query } from '../db.ts';

const router = Router();

/**
 * 1. Live Bot Status & Metrics for Admin Desk
 * GET /api/admin/telegram/status
 */
router.get('/status', async (_req, res) => {
  try {
    const config = await telegramBotService.getConfig();
    let botInfo = null;
    let isConnected = false;

    if (config.token) {
      const meRes = await telegramBotService.getMe();
      if (meRes.ok) {
        isConnected = true;
        botInfo = meRes.result;
      }
    }

    const countRes = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE telegram_id IS NOT NULL AND telegram_id > 0) as total_telegram_users,
         COUNT(*) FILTER (WHERE telegram_id IS NOT NULL AND telegram_id > 0 AND (bot_blocked IS NULL OR bot_blocked = FALSE)) as bot_started_users
       FROM users`
    );

    const broadcastsRes = await query(
      'SELECT COUNT(*) as total_broadcasts FROM telegram_broadcasts'
    );

    let channelMembers = 4;
    try {
      const chCountRes = await telegramBotService.callApi('getChatMemberCount', {
        chat_id: config.channelId || '@SonicGameEthiopia'
      });
      if (chCountRes.ok && typeof chCountRes.result === 'number') {
        channelMembers = chCountRes.result;
      }
    } catch {}

    return res.json({
      success: true,
      isConnected,
      bot: botInfo,
      config: {
        hasToken: Boolean(config.token),
        tokenPreview: config.token ? `${config.token.slice(0, 7)}...${config.token.slice(-5)}` : '',
        webAppUrl: config.webAppUrl,
        channelId: config.channelId,
        autoPostMegaWins: config.autoPostMegaWins,
        megaWinThreshold: config.megaWinThreshold
      },
      metrics: {
        totalTelegramUsers: parseInt(countRes.rows[0]?.total_telegram_users || '0', 10),
        activeBotSubscribers: parseInt(countRes.rows[0]?.bot_started_users || '0', 10),
        totalBroadcasts: parseInt(broadcastsRes.rows[0]?.total_broadcasts || '0', 10),
        channelMembers
      }
    });
  } catch (err: any) {
    console.error('Error checking telegram bot status:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to check status' });
  }
});

/**
 * 1b. Check Telegram Channel Connection & Admin Permissions
 * GET /api/admin/telegram/channel-health
 */
router.get('/channel-health', async (req, res) => {
  try {
    const channelParam = (req.query.channel as string) || undefined;
    const status = await telegramBotService.verifyChannelStatus(channelParam);
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({ ok: false, canPost: false, description: err.message });
  }
});

/**
 * 2. Update Bot & Campaign Configuration
 * POST /api/admin/telegram/configure
 */
router.post('/configure', async (req, res) => {
  try {
    const { token, webAppUrl, channelId, autoPostMegaWins, megaWinThreshold } = req.body;

    const upsertSetting = async (key: string, val: string) => {
      await query(
        `INSERT INTO admin_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, val]
      );
    };

    if (typeof token === 'string' && token.trim()) {
      // Validate token with Telegram before saving
      const meCheck = await telegramBotService.getMe(token.trim());
      if (!meCheck.ok) {
        return res.status(400).json({
          success: false,
          error: `Invalid Telegram Bot Token: ${meCheck.description || 'Verification failed'}`
        });
      }
      await upsertSetting('telegram_bot_token', token.trim());
    }

    if (typeof webAppUrl === 'string') {
      await upsertSetting('telegram_webapp_url', webAppUrl.trim());
    }

    if (typeof channelId === 'string') {
      const normalizedChannel = telegramBotService.normalizeChannelIdentifier(channelId);
      await upsertSetting('telegram_channel_id', normalizedChannel);
    }

    if (typeof autoPostMegaWins === 'boolean') {
      await upsertSetting('telegram_auto_post_wins', autoPostMegaWins ? 'true' : 'false');
    }

    if (typeof megaWinThreshold === 'number') {
      await upsertSetting('telegram_mega_win_threshold', megaWinThreshold.toString());
    }

    telegramBotService.clearConfigCache();
    const updated = await telegramBotService.getConfig();

    return res.json({
      success: true,
      message: 'Telegram Bot settings saved successfully!',
      config: {
        hasToken: Boolean(updated.token),
        webAppUrl: updated.webAppUrl,
        channelId: updated.channelId,
        autoPostMegaWins: updated.autoPostMegaWins,
        megaWinThreshold: updated.megaWinThreshold
      }
    });
  } catch (err: any) {
    console.error('Error saving telegram configuration:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save config' });
  }
});

/**
 * 3. Configure Mini App Menu Button
 * POST /api/admin/telegram/set-menu-button
 */
router.post('/set-menu-button', async (req, res) => {
  try {
    const { webAppUrl, buttonType } = req.body;
    const result = await telegramBotService.setChatMenuButton(buttonType || 'commands', webAppUrl);
    if (result.success) {
      return res.json({ success: true, message: result.message });
    }
    return res.status(400).json({ success: false, error: result.message });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to set menu button' });
  }
});

/**
 * 3a. Register / Sync Webhook with Telegram API
 * POST /api/admin/telegram/set-webhook
 */
router.post('/set-webhook', async (req, res) => {
  try {
    const { webhookUrl } = req.body || {};
    const result = await telegramBotService.setWebhook(webhookUrl);
    if (result.success) {
      return res.json({ success: true, message: result.message });
    }
    return res.status(400).json({ success: false, error: result.message });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to register webhook' });
  }
});

/**
 * 3a-2. Query Current Webhook Status from Telegram API
 * GET /api/admin/telegram/webhook-info
 */
router.get('/webhook-info', async (_req, res) => {
  try {
    const result = await telegramBotService.getWebhookInfo();
    return res.json({ success: result.ok, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve webhook info' });
  }
});

/**
 * 3b. Configure Bot Greeting & Welcome Message for /start
 * POST /api/admin/telegram/welcome-message
 */
router.post('/welcome-message', async (req, res) => {
  try {
    const { welcomeText, welcomePhoto } = req.body;
    if (typeof welcomeText === 'string') {
      await query(
        `INSERT INTO admin_settings (key, value, updated_at)
         VALUES ('telegram_bot_welcome_text', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [welcomeText.trim()]
      );
    }
    if (typeof welcomePhoto === 'string') {
      await query(
        `INSERT INTO admin_settings (key, value, updated_at)
         VALUES ('telegram_bot_welcome_photo', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [welcomePhoto.trim()]
      );
    }
    return res.json({ success: true, message: 'Bot /start welcome greeting saved successfully!' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to save welcome message' });
  }
});

/**
 * 3c. Update Official Bot Profile Description on Telegram
 * POST /api/admin/telegram/update-profile
 */
router.post('/update-profile', async (req, res) => {
  try {
    const { description, shortDescription } = req.body;
    const results: string[] = [];

    if (typeof description === 'string' && description.trim()) {
      const descRes = await telegramBotService.setMyDescription(description.trim());
      if (descRes.success) {
        await query(
          `INSERT INTO admin_settings (key, value, updated_at)
           VALUES ('telegram_bot_description', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [description.trim()]
        );
        results.push('Bot description updated on Telegram');
      } else {
        return res.status(400).json({ success: false, error: descRes.message });
      }
    }

    if (typeof shortDescription === 'string' && shortDescription.trim()) {
      const shortRes = await telegramBotService.setMyShortDescription(shortDescription.trim());
      if (shortRes.success) {
        await query(
          `INSERT INTO admin_settings (key, value, updated_at)
           VALUES ('telegram_bot_short_description', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [shortDescription.trim()]
        );
        results.push('Bot short bio updated on Telegram');
      } else {
        return res.status(400).json({ success: false, error: shortRes.message });
      }
    }

    return res.json({ success: true, message: results.join(' & ') || 'Profile updated' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to update profile' });
  }
});

/**
 * 3d. Fetch Current Bot Profile & Welcome Settings
 * GET /api/admin/telegram/bot-profile
 */
router.get('/bot-profile', async (_req, res) => {
  try {
    const [descRes, shortRes, dbSettings] = await Promise.all([
      telegramBotService.getMyDescription(),
      telegramBotService.getMyShortDescription(),
      query(`SELECT key, value FROM admin_settings WHERE key IN ('telegram_bot_description', 'telegram_bot_short_description', 'telegram_bot_welcome_text', 'telegram_bot_welcome_photo')`)
    ]);

    const settingsMap = new Map(dbSettings.rows.map((r: any) => [r.key, r.value]));

    return res.json({
      success: true,
      description: descRes.ok ? descRes.description : (settingsMap.get('telegram_bot_description') || ''),
      shortDescription: shortRes.ok ? shortRes.shortDescription : (settingsMap.get('telegram_bot_short_description') || ''),
      welcomeText: settingsMap.get('telegram_bot_welcome_text') || '',
      welcomePhoto: settingsMap.get('telegram_bot_welcome_photo') || ''
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3e. Register Bot Commands Menu on Telegram (/start, /play, /bonus, /help)
 * POST /api/admin/telegram/set-commands
 */
router.post('/set-commands', async (req, res) => {
  try {
    const { commands } = req.body;
    const result = await telegramBotService.setMyCommands(commands);
    if (result.success) {
      return res.json({ success: true, message: result.message });
    }
    return res.status(400).json({ success: false, error: result.message });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to set commands' });
  }
});

/**
 * 3f. Fetch Bot Commands Menu
 * GET /api/admin/telegram/commands
 */
router.get('/commands', async (_req, res) => {
  try {
    const result = await telegramBotService.getMyCommands();
    return res.json({ success: result.ok, commands: result.commands || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3g. Fetch Active In-Bot Promotional Ad (Displayed on /promo and inside bot)
 * GET /api/admin/telegram/active-promo
 */
router.get('/active-promo', async (_req, res) => {
  try {
    const dbSettings = await query(
      `SELECT key, value, updated_at FROM admin_settings WHERE key IN (
        'telegram_active_promo_title',
        'telegram_active_promo_text',
        'telegram_active_promo_photo',
        'telegram_active_promo_button_text',
        'telegram_active_promo_button_url'
      )`
    );

    const settingsMap = new Map(dbSettings.rows.map((r: any) => [r.key, r.value]));
    let latestUpdate = null;
    if (dbSettings.rows.length > 0) {
      latestUpdate = dbSettings.rows[0].updated_at;
    }

    const cfg = await telegramBotService.getConfig();
    const meRes = await telegramBotService.getMe();
    const botUser = meRes.result?.username || 'SonicGameOfficialBot';

    return res.json({
      success: true,
      promo: {
        title: settingsMap.get('telegram_active_promo_title') || 'Weekend 10,000 ETB Mega Pot Tournament! 🍋🏆',
        messageText: settingsMap.get('telegram_active_promo_text') || (
          '🎉 <b>ታላቅ የሳምንቱ መጨረሻ የቢንጎ ውድድር!</b>\n\n' +
          '💰 አጠቃላይ የሽልማት ፈንድ: <b>10,000 ETB!</b>\n' +
          '⚡ ፈጣን ክፍያዎች በቴሌብር እና በሲቢኢ ብር\n' +
          '🎁 አዲስ ለተመዘገቡ ተጫዋቾች <b>10 ETB ነፃ ቦነስ</b> ተዘጋጅቷል!\n\n' +
          'ካርቴላዎን አሁኑኑ ይቁረጡ እና ያሸንፉ! 👇'
        ),
        photoUrl: settingsMap.get('telegram_active_promo_photo') || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80',
        buttonText: settingsMap.get('telegram_active_promo_button_text') || '🎮 Play Bingo Now & Get 10 ETB',
        buttonUrl: settingsMap.get('telegram_active_promo_button_url') || `https://t.me/${botUser}/play`,
        updatedAt: latestUpdate
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3h. Save or Update Active In-Bot Promotional Ad (Optionally broadcast immediately to bot players)
 * POST /api/admin/telegram/active-promo
 */
router.post('/active-promo', async (req, res) => {
  try {
    const { title, messageText, photoUrl, buttonText, buttonUrl, broadcastNow, crossPostChannel } = req.body;

    if (!title || !messageText) {
      return res.status(400).json({ success: false, error: 'Promotion title and message text are required' });
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
      [title.trim(), messageText.trim(), (photoUrl || '').trim(), (buttonText || '').trim(), (buttonUrl || '').trim()]
    );

    let broadcastResult = null;
    let channelResult = null;

    if (broadcastNow) {
      broadcastResult = await telegramBotService.broadcast({
        title: title.trim(),
        messageText: messageText.trim(),
        photoUrl: (photoUrl || '').trim() || undefined,
        buttonText: (buttonText || '').trim() || undefined,
        buttonUrl: (buttonUrl || '').trim() || undefined,
        targetType: 'all_users'
      });
    }

    if (crossPostChannel) {
      const cfg = await telegramBotService.getConfig();
      if (cfg.channelId) {
        channelResult = await telegramBotService.broadcast({
          title: title.trim(),
          messageText: messageText.trim(),
          photoUrl: (photoUrl || '').trim() || undefined,
          buttonText: (buttonText || '').trim() || undefined,
          buttonUrl: (buttonUrl || '').trim() || undefined,
          targetType: 'channel',
          targetId: cfg.channelId,
          pinMessage: false
        });
      }
    }

    return res.json({
      success: true,
      message: broadcastNow
        ? `In-Bot Promotion saved and broadcast dispatched to ${broadcastResult?.totalRecipients || 0} players!`
        : 'In-Bot Promotion saved! Players can now see this promo via /promo and inside the bot.',
      broadcastResult,
      channelResult
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Dispatch Broadcast Campaign (Channels, Groups, Players, or Test Send)
 * POST /api/admin/telegram/broadcast
 */
router.post('/broadcast', async (req, res) => {
  try {
    const {
      title,
      messageText,
      photoUrl,
      buttonText,
      buttonUrl,
      targetType,
      targetId,
      crossPostChannel,
      pinMessage
    } = req.body;

    if (!title || !messageText) {
      return res.status(400).json({ success: false, error: 'Campaign title and message content are required' });
    }

    const result = await telegramBotService.broadcast({
      title,
      messageText,
      photoUrl,
      buttonText,
      buttonUrl,
      targetType: targetType || 'all_users',
      targetId,
      crossPostChannel: Boolean(crossPostChannel),
      pinMessage: Boolean(pinMessage)
    });

    if (result.success) {
      return res.json(result);
    }
    return res.status(400).json(result);
  } catch (err: any) {
    console.error('Error creating broadcast:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to send broadcast' });
  }
});

/**
 * 5. Broadcast Campaign History & Delivery Reports
 * GET /api/admin/telegram/broadcasts
 */
router.get('/broadcasts', async (_req, res) => {
  try {
    const history = await query(
      `SELECT * FROM telegram_broadcasts 
       ORDER BY created_at DESC 
       LIMIT 50`
    );
    return res.json({
      success: true,
      broadcasts: history.rows
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. Public Inbound Webhook for Telegram Bot Commands
 * POST /api/telegram/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    await telegramBotService.handleWebhookUpdate(req.body);
    return res.status(200).send('OK');
  } catch (err) {
    console.warn('Telegram webhook warning:', err);
    return res.status(200).send('OK'); // Always return 200 to Telegram
  }
});

export default router;
