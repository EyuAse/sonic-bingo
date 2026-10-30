import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.ts';
import { generateToken, requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { io } from '../io.ts';

const router = Router();

/**
 * Admin Cashier PIN Authentication
 * Authenticates with PIN (default 1234) and returns an official Admin JWT token
 */
router.post('/admin-login', async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, error: 'Admin PIN is required' });
    }

    if (pin !== '1234' && pin !== process.env.ADMIN_PIN) {
      return res.status(401).json({ success: false, error: 'Invalid Admin PIN.' });
    }

    // Find or create the Admin Cashier account
    let adminRes = await query(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
    let adminRow = adminRes.rows[0];

    if (!adminRow) {
      const hashedPin = await bcrypt.hash('1234', 10);
      const newAdmin = await query(
        `INSERT INTO users (phone, full_name, pin_hash, role, status)
         VALUES ('0998983344', 'Mekonen Woldekidane (Cashier)', $1, 'admin', 'active')
         RETURNING *`,
        [hashedPin]
      );
      adminRow = newAdmin.rows[0];
    }

    const authUser = {
      id: adminRow.id,
      phone: adminRow.phone,
      fullName: adminRow.full_name,
      role: 'admin' as const
    };

    const token = generateToken(authUser);

    return res.json({
      success: true,
      token,
      user: {
        id: adminRow.id,
        phone: adminRow.phone,
        fullName: adminRow.full_name,
        role: 'admin'
      }
    });
  } catch (error: any) {
    console.error('❌ [Admin Login Error]:', error);
    return res.status(500).json({ success: false, error: 'Admin authentication failed' });
  }
});

/**
 * Check if Telegram User already exists in Neon DB
 */
router.get('/check-telegram/:telegramId', async (req, res) => {
  try {
    const tgId = Number(req.params.telegramId);
    if (!tgId || isNaN(tgId)) {
      return res.json({ success: true, exists: false });
    }
    const checkRes = await query('SELECT id FROM users WHERE telegram_id = $1 LIMIT 1', [tgId]);
    return res.json({ success: true, exists: checkRes.rows.length > 0 });
  } catch (err: any) {
    return res.json({ success: true, exists: false });
  }
});

/**
 * 1-Click Telegram Mini App Authentication
 * Seamlessly logs in or auto-registers the Telegram user with a live Neon DB wallet & welcome bonus.
 */
router.post('/telegram', async (req, res) => {
  try {
    const { telegramId, username, firstName, lastName, photoUrl, phone, referralCode } = req.body;

    if (!telegramId) {
      return res.status(400).json({ success: false, error: 'telegramId is required' });
    }

    const tgIdNum = (telegramId && !isNaN(Number(telegramId))) ? Number(telegramId) : null;
    const cleanUsername = username ? username.replace(/^@/, '') : `user_${tgIdNum || Date.now().toString().slice(-6)}`;
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || cleanUsername;

    // Check if user exists by telegram_id or phone
    const existingUserRes = await query(
      `SELECT u.*, w.balance, w.bonus, w.locked_balance 
       FROM users u 
       LEFT JOIN wallets w ON u.id = w.user_id 
       WHERE (u.telegram_id IS NOT NULL AND u.telegram_id = $1) 
          OR (u.phone IS NOT NULL AND u.phone = $2)
       LIMIT 1`,
      [tgIdNum, phone || null]
    );

    let userRow: any;
    let walletRow: any;
    let isNewUser = false;

    if (existingUserRes.rows.length > 0) {
      // Existing User: Update latest profile info and login time
      userRow = existingUserRes.rows[0];

      // Backfill referral_code if missing
      if (!userRow.referral_code) {
        const genCode = 'SONIC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await query('UPDATE users SET referral_code = $1 WHERE id = $2', [genCode, userRow.id]);
        userRow.referral_code = genCode;
      }

      await query(
        `UPDATE users 
         SET last_login_at = NOW(),
             telegram_username = COALESCE($1, telegram_username),
             first_name = COALESCE($2, first_name),
             last_name = COALESCE($3, last_name),
             photo_url = COALESCE($4, photo_url),
             phone = COALESCE($5, phone),
             bot_started = TRUE
         WHERE id = $6`,
        [cleanUsername, firstName || null, lastName || null, photoUrl || null, phone || null, userRow.id]
      );

      walletRow = {
        balance: parseFloat(userRow.balance || '0'),
        bonus: parseFloat(userRow.bonus || '0'),
        lockedBalance: parseFloat(userRow.locked_balance || '0')
      };
    } else {
      // New User: Create atomically with initial 10 ETB Welcome Bonus & Referral Attribution
      isNewUser = true;
      const myReferralCode = 'SONIC-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      const result = await withTransaction(async (client) => {
        // Resolve referrer if valid code passed
        let referrerId: string | null = null;
        if (referralCode && typeof referralCode === 'string') {
          const cleanRef = referralCode.replace(/^ref_/, '').trim().toUpperCase();
          if (cleanRef) {
            const refLookup = await client.query(
              `SELECT id FROM users 
               WHERE referral_code = $1 
                  OR UPPER(referral_code) = $1 
                  OR id::text = $1 
                  OR telegram_id::text = $1 
               LIMIT 1`,
              [cleanRef]
            );
            if (refLookup.rows.length > 0) {
              referrerId = refLookup.rows[0].id;
            }
          }
        }

        const newUserRes = await client.query(
          `INSERT INTO users (telegram_id, telegram_username, first_name, last_name, full_name, photo_url, phone, role, status, referral_code, referred_by, bot_started, bot_blocked)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'player', 'active', $8, $9, TRUE, FALSE)
           RETURNING *`,
          [tgIdNum, cleanUsername, firstName || null, lastName || null, fullName, photoUrl || null, phone || null, myReferralCode, referrerId]
        );
        const newUser = newUserRes.rows[0];

        // Link into referrals table with status 'pending_deposit'
        if (referrerId && referrerId !== newUser.id) {
          await client.query(
            `INSERT INTO referrals (referrer_id, referred_user_id, status, is_telegram_premium)
             VALUES ($1, $2, 'pending_deposit', false)
             ON CONFLICT (referred_user_id) DO NOTHING`,
            [referrerId, newUser.id]
          );
          console.log(`🎁 [Referral Link] User ${newUser.id} attributed to referrer ${referrerId}`);
        }

        // Create Wallet with 20 ETB Welcome Bonus (Enqu Requirements)
        const newWalletRes = await client.query(
          `INSERT INTO wallets (user_id, balance, bonus, locked_balance)
           VALUES ($1, 0.00, 20.00, 0.00)
           RETURNING *`,
          [newUser.id]
        );
        const newWallet = newWalletRes.rows[0];

        // Record Welcome Bonus Ledger Transaction
        await client.query(
          `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
           VALUES ($1, 'bonus', 20.00, 20.00, $2, 'completed', 'welcome_reward', 'Sonic Bingo 20 ETB Registration Bonus')`,
          [newUser.id, `BONUS-TG-${tgIdNum}-${Date.now().toString().slice(-6)}`]
        );

        // Initialize Coin Wallet (Loyalty System)
        await client.query(
          `INSERT INTO coin_wallets (user_id, balance, lifetime_earned, lifetime_redeemed)
           VALUES ($1, 0, 0, 0)
           ON CONFLICT (user_id) DO NOTHING`,
          [newUser.id]
        );


      return { user: newUser, wallet: newWallet };
      });

      userRow = result.user;
      walletRow = {
        balance: parseFloat(result.wallet.balance || '0'),
        bonus: parseFloat(result.wallet.bonus || '20.00'),
        lockedBalance: parseFloat(result.wallet.locked_balance || '0')
      };

      // Broadcast new player registration to Admin Dashboard
      io.emit('admin_new_user', {
        id: userRow.id,
        name: userRow.full_name,
        phone: userRow.phone,
        telegramUsername: userRow.telegram_username,
        role: userRow.role,
        balance: 0,
        bonus: 20,
        createdAt: userRow.created_at
      });
    }

    const authUser = {
      id: userRow.id,
      telegramId: userRow.telegram_id ? Number(userRow.telegram_id) : undefined,
      telegramUsername: userRow.telegram_username,
      phone: userRow.phone,
      fullName: userRow.full_name,
      role: userRow.role as 'player' | 'cashier' | 'admin'
    };

    const token = generateToken(authUser);

    return res.json({
      success: true,
      token,
      isNewUser,
      user: {
        id: userRow.id,
        telegramId: userRow.telegram_id,
        telegramUsername: userRow.telegram_username,
        fullName: userRow.full_name,
        firstName: userRow.first_name,
        lastName: userRow.last_name,
        phone: userRow.phone,
        avatar: userRow.avatar || '👤',
        photoUrl: userRow.photo_url,
        role: userRow.role,
        referralCode: userRow.referral_code,
        attachedAccounts: userRow.attached_accounts || [],
        createdAt: userRow.created_at
      },
      wallet: walletRow
    });
  } catch (error: any) {
    console.error('❌ [Auth Telegram Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Authentication failed' });
  }
});

/**
 * Standard Phone & PIN Registration
 */
router.post('/register', async (req, res) => {
  try {
    const { phone, pin, fullName, referralCode } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ success: false, error: 'Phone and PIN are required' });
    }

    const cleanPhone = phone.trim();
    const existingUser = await query('SELECT id FROM users WHERE phone = $1 LIMIT 1', [cleanPhone]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'An account with this phone number already exists. Please log in.' });
    }

    const hashedPin = await bcrypt.hash(pin.trim(), 10);
    const name = (fullName || 'Lomi Player').trim();
    const myReferralCode = 'LOMI-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const result = await withTransaction(async (client) => {
      // Resolve referrer if code passed
      let referrerId: string | null = null;
      if (referralCode && typeof referralCode === 'string') {
        const cleanRef = referralCode.replace(/^ref_/, '').trim().toUpperCase();
        if (cleanRef) {
          const refLookup = await client.query(
            `SELECT id FROM users 
             WHERE referral_code = $1 
                OR UPPER(referral_code) = $1 
                OR id::text = $1 
                OR phone = $1 
             LIMIT 1`,
            [cleanRef]
          );
          if (refLookup.rows.length > 0) {
            referrerId = refLookup.rows[0].id;
          }
        }
      }

      const newUserRes = await client.query(
        `INSERT INTO users (phone, full_name, pin_hash, role, status, referral_code, referred_by)
         VALUES ($1, $2, $3, 'player', 'active', $4, $5)
         RETURNING *`,
        [cleanPhone, name, hashedPin, myReferralCode, referrerId]
      );
      const newUser = newUserRes.rows[0];

      // Link in referrals table
      if (referrerId && referrerId !== newUser.id) {
        await client.query(
          `INSERT INTO referrals (referrer_id, referred_user_id, status, is_telegram_premium)
           VALUES ($1, $2, 'pending_deposit', false)
           ON CONFLICT (referred_user_id) DO NOTHING`,
          [referrerId, newUser.id]
        );
        console.log(`🎁 [Referral Link Web] User ${newUser.id} attributed to referrer ${referrerId}`);
      }

      const newWalletRes = await client.query(
        `INSERT INTO wallets (user_id, balance, bonus, locked_balance)
         VALUES ($1, 0.00, 20.00, 0.00)
         RETURNING *`,
        [newUser.id]
      );
      const newWallet = newWalletRes.rows[0];

      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
         VALUES ($1, 'bonus', 20.00, 20.00, $2, 'completed', 'welcome_reward', 'Sonic Bingo 20 ETB Registration Bonus')`,
        [newUser.id, `BONUS-WEB-${Date.now().toString().slice(-6)}`]
      );

      // Initialize Coin Wallet (Loyalty System)
      await client.query(
        `INSERT INTO coin_wallets (user_id, balance, lifetime_earned, lifetime_redeemed)
         VALUES ($1, 0, 0, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [newUser.id]
      );

      return { user: newUser, wallet: newWallet };
    });

    const authUser = {
      id: result.user.id,
      phone: result.user.phone,
      fullName: result.user.full_name,
      role: result.user.role as 'player' | 'cashier' | 'admin'
    };

    const token = generateToken(authUser);

    io.emit('admin_new_user', {
      id: result.user.id,
      name: result.user.full_name,
      phone: result.user.phone,
      role: result.user.role,
      balance: 0,
      bonus: 20,
      createdAt: result.user.created_at
    });

    return res.json({
      success: true,
      token,
      user: {
        id: result.user.id,
        phone: result.user.phone,
        fullName: result.user.full_name,
        role: result.user.role,
        createdAt: result.user.created_at
      },
      wallet: {
        balance: parseFloat(result.wallet.balance || '0'),
        bonus: parseFloat(result.wallet.bonus || '20.00'),
        lockedBalance: parseFloat(result.wallet.locked_balance || '0')
      }
    });
  } catch (error: any) {
    console.error('❌ [Auth Register Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Registration failed' });
  }
});

/**
 * Standard Phone & PIN Login (e.g. for Cashier/Admin Portal or Web)
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ success: false, error: 'Phone and PIN are required' });
    }

    const userRes = await query(
      `SELECT u.*, w.balance, w.bonus, w.locked_balance 
       FROM users u 
       LEFT JOIN wallets w ON u.id = w.user_id 
       WHERE u.phone = $1 OR u.telegram_username = $1
       LIMIT 1`,
      [phone.trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid phone number or account not found.' });
    }

    const userRow = userRes.rows[0];
    if (userRow.pin_hash) {
      const match = await bcrypt.compare(pin, userRow.pin_hash);
      if (!match) {
        return res.status(401).json({ success: false, error: 'Invalid PIN. Please try again.' });
      }
    }

    const authUser = {
      id: userRow.id,
      telegramId: userRow.telegram_id ? Number(userRow.telegram_id) : undefined,
      telegramUsername: userRow.telegram_username,
      phone: userRow.phone,
      fullName: userRow.full_name,
      role: userRow.role as 'player' | 'cashier' | 'admin'
    };

    const token = generateToken(authUser);

    return res.json({
      success: true,
      token,
      user: {
        id: userRow.id,
        telegramId: userRow.telegram_id,
        telegramUsername: userRow.telegram_username,
        fullName: userRow.full_name,
        phone: userRow.phone,
        avatar: userRow.avatar || '👤',
        photoUrl: userRow.photo_url,
        role: userRow.role
      },
      wallet: {
        balance: parseFloat(userRow.balance || '0'),
        bonus: parseFloat(userRow.bonus || '0'),
        lockedBalance: parseFloat(userRow.locked_balance || '0')
      }
    });
  } catch (error: any) {
    console.error('❌ [Auth Login Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Login failed' });
  }
});

/**
 * Get Current Authenticated Session & Live Wallet from Neon DB
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRes = await query(
      `SELECT u.*, w.balance, w.bonus, w.locked_balance 
       FROM users u 
       LEFT JOIN wallets w ON u.id = w.user_id 
       WHERE u.id = $1 
       LIMIT 1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userRow = userRes.rows[0];
    return res.json({
      success: true,
      user: {
        id: userRow.id,
        telegramId: userRow.telegram_id,
        telegramUsername: userRow.telegram_username,
        fullName: userRow.full_name,
        firstName: userRow.first_name,
        lastName: userRow.last_name,
        phone: userRow.phone,
        avatar: userRow.avatar || '👤',
        photoUrl: userRow.photo_url,
        role: userRow.role,
        attachedAccounts: userRow.attached_accounts || [],
        createdAt: userRow.created_at
      },
      wallet: {
        balance: parseFloat(userRow.balance || '0'),
        bonus: parseFloat(userRow.bonus || '0'),
        lockedBalance: parseFloat(userRow.locked_balance || '0')
      }
    });
  } catch (error: any) {
    console.error('❌ [Auth Me Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve profile' });
  }
});

/**
 * Update Authenticated Player Profile & Attached Payout Accounts
 * Persists phone number, name, telegram handle, and attached accounts directly to Neon DB
 */
router.put('/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { phone, fullName, telegramUsername, attachedAccounts } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (phone !== undefined) {
      updates.push(`phone = $${idx++}`);
      values.push(phone && typeof phone === 'string' ? phone.trim() : null);
    }
    if (fullName !== undefined && typeof fullName === 'string') {
      updates.push(`full_name = $${idx++}`);
      values.push(fullName.trim());
    }
    if (telegramUsername !== undefined && typeof telegramUsername === 'string') {
      updates.push(`telegram_username = $${idx++}`);
      values.push(telegramUsername.trim().replace(/^@/, ''));
    }
    if (attachedAccounts !== undefined && Array.isArray(attachedAccounts)) {
      updates.push(`attached_accounts = $${idx++}::jsonb`);
      values.push(JSON.stringify(attachedAccounts));
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No updates requested' });
    }

    values.push(userId);
    const updateRes = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userRow = updateRes.rows[0];

    const walletRes = await query(`SELECT balance, bonus, locked_balance FROM wallets WHERE user_id = $1`, [userId]);
    const walletRow = walletRes.rows[0] || { balance: '0', bonus: '0', locked_balance: '0' };

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: userRow.id,
        telegramId: userRow.telegram_id,
        telegramUsername: userRow.telegram_username,
        fullName: userRow.full_name,
        firstName: userRow.first_name,
        lastName: userRow.last_name,
        phone: userRow.phone,
        avatar: userRow.avatar || '👤',
        photoUrl: userRow.photo_url,
        role: userRow.role,
        attachedAccounts: userRow.attached_accounts || [],
        createdAt: userRow.created_at
      },
      wallet: {
        balance: parseFloat(walletRow.balance || '0'),
        bonus: parseFloat(walletRow.bonus || '0'),
        lockedBalance: parseFloat(walletRow.locked_balance || '0')
      }
    });
  } catch (error: any) {
    console.error('❌ [Auth Update Profile Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update profile' });
  }
});

export default router;

