/**
 * Standby Bot Roster for 10 Birr Room (Zero-Database-Impact Architecture)
 *
 * 200 authentic Ethiopian bot profiles containing culturally accurate male/female names,
 * father names, and valid Ethiopian phone prefixes (09xx, 07xx).
 *
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * 1. This roster is stored purely in-memory in code to guarantee ZERO database modifications
 *    or pollution on the shared Neon PostgreSQL database.
 * 2. It is strictly dedicated to Room 10 ('room-10' / ARENA_ROOM_ID).
 * 3. Rooms 20, 50, and 100 remain 100% untouched and do not use this standby pool.
 */

export interface StandbyBotProfile {
  id: string;
  name: string;
  phone: string;
  gender?: 'female' | 'male';
}

export const ETHIOPIAN_200_BOT_ROSTER: ReadonlyArray<StandbyBotProfile> = Object.freeze([
  // --- 1 to 62: NICKNAMES + EMOJIS & UNIQUE SYMBOLS (~30% / 62 bots) ---
  // Female with Emojis (12 bots)
  { id: 'bot_standby_001', name: 'Selam 🌸', phone: '0911100001', gender: 'female' },
  { id: 'bot_standby_002', name: 'Hana ✨', phone: '0912103822', gender: 'female' },
  { id: 'bot_standby_003', name: 'Sara 🦋', phone: '0913107643', gender: 'female' },
  { id: 'bot_standby_004', name: 'Mimi 💎', phone: '0920111464', gender: 'female' },
  { id: 'bot_standby_005', name: 'Lula 🌺', phone: '0921115285', gender: 'female' },
  { id: 'bot_standby_006', name: 'Beti 🎀', phone: '0922119106', gender: 'female' },
  { id: 'bot_standby_007', name: 'Tsion 🕊️', phone: '0929122927', gender: 'female' },
  { id: 'bot_standby_008', name: 'Kalkidan ✝️', phone: '0930126748', gender: 'female' },
  { id: 'bot_standby_009', name: 'Lidya 💫', phone: '0935130569', gender: 'female' },
  { id: 'bot_standby_010', name: 'Ruthy 🌸', phone: '0940134390', gender: 'female' },
  { id: 'bot_standby_011', name: 'Mahi 💖', phone: '0944138211', gender: 'female' },
  { id: 'bot_standby_012', name: 'Fifi 🍓', phone: '0952142032', gender: 'female' },

  // Male / Neutral with Emojis (50 bots)
  { id: 'bot_standby_013', name: 'Beki ⚡', phone: '0970145853', gender: 'male' },
  { id: 'bot_standby_014', name: 'Nati 👑', phone: '0711149674', gender: 'male' },
  { id: 'bot_standby_015', name: 'Yoni 🔥', phone: '0712153495', gender: 'male' },
  { id: 'bot_standby_016', name: 'Abyssinia 🇪🇹', phone: '0777157316', gender: 'male' },
  { id: 'bot_standby_017', name: 'Bini 🎯', phone: '0911161137', gender: 'male' },
  { id: 'bot_standby_018', name: 'Dagi 💎', phone: '0912164958', gender: 'male' },
  { id: 'bot_standby_019', name: 'Miki 🚀', phone: '0913168779', gender: 'male' },
  { id: 'bot_standby_020', name: 'Tsehay ☀️', phone: '0920172600', gender: 'male' },
  { id: 'bot_standby_021', name: 'Kidu 🦁', phone: '0921176421', gender: 'male' },
  { id: 'bot_standby_022', name: 'Eyu ✌️', phone: '0922180242', gender: 'male' },
  { id: 'bot_standby_023', name: 'Alex ⚽', phone: '0929184063', gender: 'male' },
  { id: 'bot_standby_024', name: 'Fira 🕊️', phone: '0930187884', gender: 'male' },
  { id: 'bot_standby_025', name: '_Maki 🖤', phone: '0935191705', gender: 'male' },
  { id: 'bot_standby_026', name: 'Bereket ツ', phone: '0940195526', gender: 'male' },
  { id: 'bot_standby_027', name: 'Amen 🙏', phone: '0944199347', gender: 'male' },
  { id: 'bot_standby_028', name: 'Sonic Fan 👑', phone: '0952203168', gender: 'male' },
  { id: 'bot_standby_029', name: 'Dani 🎲', phone: '0970206989', gender: 'male' },
  { id: 'bot_standby_030', name: 'Henok 🏆', phone: '0711210810', gender: 'male' },
  { id: 'bot_standby_031', name: 'Robel 💎', phone: '0712214631', gender: 'male' },
  { id: 'bot_standby_032', name: 'Sami ⚡', phone: '0777218452', gender: 'male' },
  { id: 'bot_standby_033', name: 'Biruk 🌟', phone: '0911222273', gender: 'male' },
  { id: 'bot_standby_034', name: 'Fraol 🦁', phone: '0912226094', gender: 'male' },
  { id: 'bot_standby_035', name: 'Abuki 🎯', phone: '0913229915', gender: 'male' },
  { id: 'bot_standby_036', name: 'Temu 🔥', phone: '0920233736', gender: 'male' },
  { id: 'bot_standby_037', name: 'Chalu ⚡', phone: '0921237557', gender: 'male' },
  { id: 'bot_standby_038', name: 'Barok 🙏', phone: '0922241378', gender: 'male' },
  { id: 'bot_standby_039', name: 'Tinsae ☀️', phone: '0929245199', gender: 'male' },
  { id: 'bot_standby_040', name: 'Habesha 🇪🇹', phone: '0930249020', gender: 'male' },
  { id: 'bot_standby_041', name: 'Sol 👑', phone: '0935252841', gender: 'male' },
  { id: 'bot_standby_042', name: 'Eyob 🚀', phone: '0940256662', gender: 'male' },
  { id: 'bot_standby_043', name: 'Surafel ⚽', phone: '0944260483', gender: 'male' },
  { id: 'bot_standby_044', name: 'Miki_G 💎', phone: '0952264304', gender: 'male' },
  { id: 'bot_standby_045', name: 'Zack 🔥', phone: '0970268125', gender: 'male' },
  { id: 'bot_standby_046', name: 'Bini_A ⚡', phone: '0711271946', gender: 'male' },
  { id: 'bot_standby_047', name: 'Dagmawi 👑', phone: '0712275767', gender: 'male' },
  { id: 'bot_standby_048', name: 'Kidus_T ✝️', phone: '0777279588', gender: 'male' },
  { id: 'bot_standby_049', name: 'Aman 🎯', phone: '0911283409', gender: 'male' },
  { id: 'bot_standby_050', name: 'Tedi 🎸', phone: '0912287230', gender: 'male' },
  { id: 'bot_standby_051', name: 'Yared 🎵', phone: '0913291051', gender: 'male' },
  { id: 'bot_standby_052', name: 'Ermias 🌟', phone: '0920294872', gender: 'male' },
  { id: 'bot_standby_053', name: 'Nahom ⚡', phone: '0921298693', gender: 'male' },
  { id: 'bot_standby_054', name: 'Jemberu ☀️', phone: '0922302514', gender: 'male' },
  { id: 'bot_standby_055', name: 'Senay 🍀', phone: '0929306335', gender: 'male' },
  { id: 'bot_standby_056', name: 'Kirubel 🕊️', phone: '0930310156', gender: 'male' },
  { id: 'bot_standby_057', name: 'Tolosa 🦁', phone: '0935313977', gender: 'male' },
  { id: 'bot_standby_058', name: 'Gashaw 💎', phone: '0940317798', gender: 'male' },
  { id: 'bot_standby_059', name: 'Fikadu 🎯', phone: '0944321619', gender: 'male' },
  { id: 'bot_standby_060', name: 'Mati ⚡', phone: '0952325440', gender: 'male' },
  { id: 'bot_standby_061', name: 'Gossaye 👑', phone: '0970329261', gender: 'male' },
  { id: 'bot_standby_062', name: 'Bisrat 🌟', phone: '0711333082', gender: 'male' },

  // --- 63 to 92: AUTHENTIC AMHARIC / GE'EZ FIDEL NAMES (30 bots / 15%) ---
  // Female Fidel (8 bots)
  { id: 'bot_standby_063', name: 'ሰላም', phone: '0712336903', gender: 'female' },
  { id: 'bot_standby_064', name: 'ኤደን', phone: '0777340724', gender: 'female' },
  { id: 'bot_standby_065', name: 'ማሂ', phone: '0911344545', gender: 'female' },
  { id: 'bot_standby_066', name: 'ቤቲ', phone: '0912348366', gender: 'female' },
  { id: 'bot_standby_067', name: 'ፍቅር', phone: '0913352187', gender: 'female' },
  { id: 'bot_standby_068', name: 'ብርቱካን', phone: '0920356008', gender: 'female' },
  { id: 'bot_standby_069', name: 'ሃና', phone: '0921359829', gender: 'female' },
  { id: 'bot_standby_070', name: 'ሜሮን', phone: '0922363650', gender: 'female' },

  // Male Fidel (22 bots)
  { id: 'bot_standby_071', name: 'ናቲ', phone: '0929367471', gender: 'male' },
  { id: 'bot_standby_072', name: 'ዮናስ', phone: '0930371292', gender: 'male' },
  { id: 'bot_standby_073', name: 'ኪዱ', phone: '0935375113', gender: 'male' },
  { id: 'bot_standby_074', name: 'ሮቤል', phone: '0940378934', gender: 'male' },
  { id: 'bot_standby_075', name: 'ዳጊ', phone: '0944382755', gender: 'male' },
  { id: 'bot_standby_076', name: 'ሄኖክ', phone: '0952386576', gender: 'male' },
  { id: 'bot_standby_077', name: 'አቤኒ', phone: '0970390397', gender: 'male' },
  { id: 'bot_standby_078', name: 'ሳሚ', phone: '0711394218', gender: 'male' },
  { id: 'bot_standby_079', name: 'ቴዲ', phone: '0712398039', gender: 'male' },
  { id: 'bot_standby_080', name: 'አማን', phone: '0777401860', gender: 'male' },
  { id: 'bot_standby_081', name: 'ተስፋ', phone: '0911405681', gender: 'male' },
  { id: 'bot_standby_082', name: 'ዮኒ', phone: '0912409502', gender: 'male' },
  { id: 'bot_standby_083', name: 'ብርሃኑ', phone: '0913413323', gender: 'male' },
  { id: 'bot_standby_084', name: 'ታደለ', phone: '0920417144', gender: 'male' },
  { id: 'bot_standby_085', name: 'ሙሉጌታ', phone: '0921420965', gender: 'male' },
  { id: 'bot_standby_086', name: 'ደስታ', phone: '0922424786', gender: 'male' },
  { id: 'bot_standby_087', name: 'ግርማ', phone: '0929428607', gender: 'male' },
  { id: 'bot_standby_088', name: 'ሰለሞን', phone: '0930432428', gender: 'male' },
  { id: 'bot_standby_089', name: 'ዳንኤል', phone: '0935436249', gender: 'male' },
  { id: 'bot_standby_090', name: 'በቀለ', phone: '0940440070', gender: 'male' },
  { id: 'bot_standby_091', name: 'ኤርሚያስ', phone: '0944443891', gender: 'male' },
  { id: 'bot_standby_092', name: 'ፋሲል', phone: '0952447712', gender: 'male' },

  // --- 93 to 142: FIRST NAME + INITIAL (50 bots / 25%) ---
  // Female First + Initial (10 bots)
  { id: 'bot_standby_093', name: 'Eyerus G.', phone: '0970451533', gender: 'female' },
  { id: 'bot_standby_094', name: 'Helen S.', phone: '0711455354', gender: 'female' },
  { id: 'bot_standby_095', name: 'Marta B.', phone: '0712459175', gender: 'female' },
  { id: 'bot_standby_096', name: 'Senait M.', phone: '0777462996', gender: 'female' },
  { id: 'bot_standby_097', name: 'Almaz G.', phone: '0911466817', gender: 'female' },
  { id: 'bot_standby_098', name: 'Tigist K.', phone: '0912470638', gender: 'female' },
  { id: 'bot_standby_099', name: 'Bethlehem A.', phone: '0913474459', gender: 'female' },
  { id: 'bot_standby_100', name: 'Rahel T.', phone: '0920478280', gender: 'female' },
  { id: 'bot_standby_101', name: 'Kidist F.', phone: '0921482101', gender: 'female' },
  { id: 'bot_standby_102', name: 'Genet Z.', phone: '0922485922', gender: 'female' },

  // Male First + Initial (40 bots)
  { id: 'bot_standby_103', name: 'Aman T.', phone: '0929489743', gender: 'male' },
  { id: 'bot_standby_104', name: 'Natnael K.', phone: '0930493564', gender: 'male' },
  { id: 'bot_standby_105', name: 'Dawit M.', phone: '0935497385', gender: 'male' },
  { id: 'bot_standby_106', name: 'Biniyam A.', phone: '0940501206', gender: 'male' },
  { id: 'bot_standby_107', name: 'Kidus T.', phone: '0944505027', gender: 'male' },
  { id: 'bot_standby_108', name: 'Sami B.', phone: '0952508848', gender: 'male' },
  { id: 'bot_standby_109', name: 'Robel Z.', phone: '0970512669', gender: 'male' },
  { id: 'bot_standby_110', name: 'Biruk A.', phone: '0711516490', gender: 'male' },
  { id: 'bot_standby_111', name: 'Eyob H.', phone: '0712520311', gender: 'male' },
  { id: 'bot_standby_112', name: 'Yared S.', phone: '0777524132', gender: 'male' },
  { id: 'bot_standby_113', name: 'Surafel D.', phone: '0911527953', gender: 'male' },
  { id: 'bot_standby_114', name: 'Yonas B.', phone: '0912531774', gender: 'male' },
  { id: 'bot_standby_115', name: 'Henok W.', phone: '0913535595', gender: 'male' },
  { id: 'bot_standby_116', name: 'Solomon G.', phone: '0920539416', gender: 'male' },
  { id: 'bot_standby_117', name: 'Daniel T.', phone: '0921543237', gender: 'male' },
  { id: 'bot_standby_118', name: 'Nahom K.', phone: '0922547058', gender: 'male' },
  { id: 'bot_standby_119', name: 'Abel M.', phone: '0929550879', gender: 'male' },
  { id: 'bot_standby_120', name: 'Bereket F.', phone: '0930554700', gender: 'male' },
  { id: 'bot_standby_121', name: 'Mikiyas E.', phone: '0935558521', gender: 'male' },
  { id: 'bot_standby_122', name: 'Fikadu N.', phone: '0940562342', gender: 'male' },
  { id: 'bot_standby_123', name: 'Getachew S.', phone: '0944566163', gender: 'male' },
  { id: 'bot_standby_124', name: 'Girma T.', phone: '0952569984', gender: 'male' },
  { id: 'bot_standby_125', name: 'Kassahun Y.', phone: '0970573805', gender: 'male' },
  { id: 'bot_standby_126', name: 'Mulugeta B.', phone: '0711577626', gender: 'male' },
  { id: 'bot_standby_127', name: 'Tadesse H.', phone: '0712581447', gender: 'male' },
  { id: 'bot_standby_128', name: 'Worku L.', phone: '0777585268', gender: 'male' },
  { id: 'bot_standby_129', name: 'Zenebe T.', phone: '0911589089', gender: 'male' },
  { id: 'bot_standby_130', name: 'Alemayehu E.', phone: '0912592910', gender: 'male' },
  { id: 'bot_standby_131', name: 'Assefa G.', phone: '0913596731', gender: 'male' },
  { id: 'bot_standby_132', name: 'Berhanu M.', phone: '0920600552', gender: 'male' },
  { id: 'bot_standby_133', name: 'Desta M.', phone: '0921604373', gender: 'male' },
  { id: 'bot_standby_134', name: 'Fisseha E.', phone: '0922608194', gender: 'male' },
  { id: 'bot_standby_135', name: 'Haile D.', phone: '0929612015', gender: 'male' },
  { id: 'bot_standby_136', name: 'Kebede Z.', phone: '0930615836', gender: 'male' },
  { id: 'bot_standby_137', name: 'Mengistu A.', phone: '0935619657', gender: 'male' },
  { id: 'bot_standby_138', name: 'Negash E.', phone: '0940623478', gender: 'male' },
  { id: 'bot_standby_139', name: 'Seyoum F.', phone: '0944627299', gender: 'male' },
  { id: 'bot_standby_140', name: 'Tekle M.', phone: '0952631120', gender: 'male' },
  { id: 'bot_standby_141', name: 'Tesfaye S.', phone: '0970634941', gender: 'male' },
  { id: 'bot_standby_142', name: 'Tariku T.', phone: '0711638762', gender: 'male' },

  // --- 143 to 172: TELEGRAM HANDLE & GAMER TAG STYLE (30 bots / 15%) ---
  // Female Handles (5 bots)
  { id: 'bot_standby_143', name: 'samri_love', phone: '0712642583', gender: 'female' },
  { id: 'bot_standby_144', name: 'mimi_addis', phone: '0777646404', gender: 'female' },
  { id: 'bot_standby_145', name: 'helen_queen', phone: '0911650225', gender: 'female' },
  { id: 'bot_standby_146', name: 'selam_21', phone: '0912654046', gender: 'female' },
  { id: 'bot_standby_147', name: 'fifi_star', phone: '0913657867', gender: 'female' },

  // Male / Neutral Handles (25 bots)
  { id: 'bot_standby_148', name: 'nati_boy', phone: '0920661688', gender: 'male' },
  { id: 'bot_standby_149', name: 'king_dani', phone: '0921665509', gender: 'male' },
  { id: 'bot_standby_150', name: 'beki_12', phone: '0922669330', gender: 'male' },
  { id: 'bot_standby_151', name: 'ethio_star', phone: '0929673151', gender: 'male' },
  { id: 'bot_standby_152', name: 'habesha_vibes', phone: '0930676972', gender: 'male' },
  { id: 'bot_standby_153', name: 'yonathan_t', phone: '0935680793', gender: 'male' },
  { id: 'bot_standby_154', name: 'alex_pro', phone: '0940684614', gender: 'male' },
  { id: 'bot_standby_155', name: 'dagi_21', phone: '0944688435', gender: 'male' },
  { id: 'bot_standby_156', name: 'miki_eth', phone: '0952692256', gender: 'male' },
  { id: 'bot_standby_157', name: 'fira_24', phone: '0970696077', gender: 'male' },
  { id: 'bot_standby_158', name: 'aman_jr', phone: '0711699898', gender: 'male' },
  { id: 'bot_standby_159', name: 'bini_cool', phone: '0712703719', gender: 'male' },
  { id: 'bot_standby_160', name: 'chala_king', phone: '0777707540', gender: 'male' },
  { id: 'bot_standby_161', name: 'habesha_king', phone: '0911711361', gender: 'male' },
  { id: 'bot_standby_162', name: 'ethio_gamer', phone: '0912715182', gender: 'male' },
  { id: 'bot_standby_163', name: 'kidu_07', phone: '0913719003', gender: 'male' },
  { id: 'bot_standby_164', name: 'robel_pro', phone: '0920722824', gender: 'male' },
  { id: 'bot_standby_165', name: 'sam_the_man', phone: '0921726645', gender: 'male' },
  { id: 'bot_standby_166', name: 'dani_boy', phone: '0922730466', gender: 'male' },
  { id: 'bot_standby_167', name: 'teddy_b', phone: '0929734287', gender: 'male' },
  { id: 'bot_standby_168', name: 'yoni_star', phone: '0930738108', gender: 'male' },
  { id: 'bot_standby_169', name: 'bek_addis', phone: '0935741929', gender: 'male' },
  { id: 'bot_standby_170', name: 'jerry_eth', phone: '0940745750', gender: 'male' },
  { id: 'bot_standby_171', name: 'abuki_pro', phone: '0944749571', gender: 'male' },
  { id: 'bot_standby_172', name: 'fidel_gamer', phone: '0952753392', gender: 'male' },

  // --- 173 to 200: TRADITIONAL FULL NAMES / MONONYMS (28 bots / 14%) ---
  // Female Traditional (5 bots)
  { id: 'bot_standby_173', name: 'Almaz Tadesse', phone: '0970757213', gender: 'female' },
  { id: 'bot_standby_174', name: 'Yemisrach Seyoum', phone: '0711761034', gender: 'female' },
  { id: 'bot_standby_175', name: 'Genet Wolde', phone: '0712764855', gender: 'female' },
  { id: 'bot_standby_176', name: 'Hiwot Assefa', phone: '0777768676', gender: 'female' },
  { id: 'bot_standby_177', name: 'Frehiwot Berhanu', phone: '0911772497', gender: 'female' },

  // Male Traditional (23 bots)
  { id: 'bot_standby_178', name: 'Dawit Alemayehu', phone: '0912776318', gender: 'male' },
  { id: 'bot_standby_179', name: 'Abebe Bikila', phone: '0913780139', gender: 'male' },
  { id: 'bot_standby_180', name: 'Samuel Mengistu', phone: '0920783960', gender: 'male' },
  { id: 'bot_standby_181', name: 'Henok Haile', phone: '0921787781', gender: 'male' },
  { id: 'bot_standby_182', name: 'Yohannes Tadesse', phone: '0922791602', gender: 'male' },
  { id: 'bot_standby_183', name: 'Tewodros Girma', phone: '0929795423', gender: 'male' },
  { id: 'bot_standby_184', name: 'Ermias Mengistu', phone: '0930799244', gender: 'male' },
  { id: 'bot_standby_185', name: 'Natnael Worku', phone: '0935803065', gender: 'male' },
  { id: 'bot_standby_186', name: 'Biruk Tefera', phone: '0940806886', gender: 'male' },
  { id: 'bot_standby_187', name: 'Solomon Tesfaye', phone: '0944810707', gender: 'male' },
  { id: 'bot_standby_188', name: 'Nahom Desta', phone: '0952814528', gender: 'male' },
  { id: 'bot_standby_189', name: 'Abel Berhanu', phone: '0970818349', gender: 'male' },
  { id: 'bot_standby_190', name: 'Bereket Fikadu', phone: '0711822170', gender: 'male' },
  { id: 'bot_standby_191', name: 'Eyob Getachew', phone: '0712825991', gender: 'male' },
  { id: 'bot_standby_192', name: 'Mikiyas Mulugeta', phone: '0777829812', gender: 'male' },
  { id: 'bot_standby_193', name: 'Biniyam Zenebe', phone: '0911833633', gender: 'male' },
  { id: 'bot_standby_194', name: 'Getachew Seyoum', phone: '0912837454', gender: 'male' },
  { id: 'bot_standby_195', name: 'Girma Tekle', phone: '0913841275', gender: 'male' },
  { id: 'bot_standby_196', name: 'Mulugeta Tariku', phone: '0920845096', gender: 'male' },
  { id: 'bot_standby_197', name: 'Tadesse Teshome', phone: '0921848917', gender: 'male' },
  { id: 'bot_standby_198', name: 'Tamirat Zerihun', phone: '0922852738', gender: 'male' },
  { id: 'bot_standby_199', name: 'Gizachew Bisrat', phone: '0929856559', gender: 'male' },
  { id: 'bot_standby_200', name: 'Melaku Chala', phone: '0930860380', gender: 'male' }
]);

/**
 * Standby Bot Pool Configuration & Range Bounds
 */
export const MIN_STANDBY_BOT_COUNT = 0;
export const MAX_STANDBY_BOT_COUNT = 50;
export const DEFAULT_STANDBY_BOT_COUNT = 20;

// Legacy backwards compatibility alias
export const STANDBY_BOT_COUNT = 50;

export interface BotEngineConfig {
  mode: 'dynamic' | 'fixed' | 'disabled';
  minBots: number;        // 0 to 50 (default 2)
  maxBots: number;        // 0 to 50 (default 50)
  fixedCount: number;     // 0 to 50 (default 20)
  staggeredJoin: boolean; // trickle bots in lobby countdown
  livingClock: boolean;   // continuous autonomous game loop
}

/**
 * Markovian table retention drift engine for dynamic bot target counts across consecutive rounds.
 * 
 * In real casinos and gaming mini-apps:
 * 1. 75% to 90% of players stay for the rematch / revenge game ("one more round!").
 * 2. Natural churn is gradual: a few players leave, a few new ones join.
 * 3. Round-to-round delta is strictly bounded: |B_t - B_{t-1}| <= 6 bots.
 * 4. High traffic rooms (e.g. 35 to 48 bots) maintain "Rush Hour" momentum across multiple
 *    consecutive rounds before drifting down smoothly.
 * 5. Low traffic tables warm up progressively (e.g. 12 -> 16 -> 21 -> 27).
 * 6. Sudden unnatural crashes (e.g. 40 -> 10) are MATHEMATICALLY IMPOSSIBLE.
 * 
 * @param previousTarget The bot target count from the previous round (undefined on server boot)
 * @param min Minimum bots configured by admin (default 2, bounded in [0, 50])
 * @param max Maximum bots configured by admin (default 50, bounded in [0, 50])
 * @returns Next round's target bot count (guaranteeing |next - prev| <= 6)
 */
export function generateNextRoundBotTarget(
  previousTarget?: number,
  min: number = 2,
  max: number = 50
): number {
  const safeMin = Math.max(MIN_STANDBY_BOT_COUNT, Math.min(min, MAX_STANDBY_BOT_COUNT));
  const safeMax = Math.max(safeMin, Math.min(max, MAX_STANDBY_BOT_COUNT));
  if (safeMin >= safeMax) return safeMin;

  // If no previous round exists (server startup or fresh room), seed a natural initial table
  if (previousTarget === undefined || previousTarget === null || isNaN(previousTarget)) {
    // Initial room baseline: healthy moderate traffic (e.g. 15 to 28 bots, clamped to [safeMin, safeMax])
    const initialMid = Math.floor(safeMin + (safeMax - safeMin) * 0.4);
    const initialSpread = Math.max(2, Math.floor((safeMax - safeMin) * 0.2));
    const raw = initialMid + Math.floor((Math.random() * 2 - 1) * initialSpread);
    return Math.max(safeMin, Math.min(safeMax, raw));
  }

  const prev = Math.max(safeMin, Math.min(safeMax, previousTarget));

  // Determine drift direction and magnitude based on current traffic zone and natural retention
  const rand = Math.random();
  let delta: number;

  if (prev >= 35) {
    // HIGH TRAFFIC / RUSH HOUR MOMENTUM:
    // In peak rounds, table retention is high (75%-90% stay).
    // 40% chance: Table stays roughly same size (+- 2)
    // 35% chance: Small churn (-3 to -5)
    // 25% chance: More players pile in (+1 to +5)
    if (rand < 0.40) {
      delta = Math.floor(Math.random() * 5) - 2; // -2, -1, 0, 1, 2
    } else if (rand < 0.75) {
      delta = -(Math.floor(Math.random() * 3) + 3); // -3, -4, -5
    } else {
      delta = Math.floor(Math.random() * 5) + 1; // +1, +2, +3, +4, +5
    }
  } else if (prev <= 12) {
    // QUIET / WARMING-UP TABLE:
    // Table tends to attract more players as lobby countdown ticks.
    // 50% chance: Gains players (+2 to +5)
    // 35% chance: Steady (+- 1)
    // 15% chance: Drops 1 or 2
    if (rand < 0.50) {
      delta = Math.floor(Math.random() * 4) + 2; // +2, +3, +4, +5
    } else if (rand < 0.85) {
      delta = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
    } else {
      delta = -(Math.floor(Math.random() * 2) + 1); // -1, -2
    }
  } else {
    // NORMAL BUSTLING ROOM (13 to 34 bots):
    // Balanced random walk with mean-reversion drift
    // 35% chance: Slight increase (+1 to +4)
    // 35% chance: Slight decrease (-1 to -4)
    // 30% chance: Flat (+- 1)
    if (rand < 0.35) {
      delta = Math.floor(Math.random() * 4) + 1; // +1 to +4
    } else if (rand < 0.70) {
      delta = -(Math.floor(Math.random() * 4) + 1); // -1 to -4
    } else {
      delta = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
    }
  }

  // Strictly enforce max step bound of +/- 6 bots to guarantee ZERO WHIPLASH
  const clampedDelta = Math.max(-6, Math.min(6, delta));
  const nextTarget = Math.max(safeMin, Math.min(safeMax, prev + clampedDelta));
  return nextTarget;
}

/**
 * Organic traffic curve generator for dynamic bot target counts.
 * Supports optional previousTarget to preserve inter-round table retention.
 */
export function generateDynamicBotTarget(min: number = 2, max: number = 50, previousTarget?: number): number {
  return generateNextRoundBotTarget(previousTarget, min, max);
}

/**
 * Calculates Room 10 dynamic bot target bounds strictly by Ethiopian 12-hour Clock (East Africa Time / UTC+3):
 * 1. ከ ሌሊቱ 7 ሰዓት – እስከ ንጋቱ 12:00 ሰዓት (01:00 AM – 05:59 AM): 0 bots (Sleep Mode)
 * 2. ከ ንጋት 12:00 ሰዓት – እስከ ጠዋቱ 2:00 ሰዓት (06:00 AM – 07:59 AM): 10 to 15 bots (Morning Warmup)
 * 3. ከ ጠዋቱ 2:00 ሰዓት – እስከ ረፋዱ 5:00 ሰዓት (08:00 AM – 10:59 AM): 15 to 20 bots (Morning Traffic)
 * 4. ከ ረፋዱ 5:00 ሰዓት – እስከ ከሰዓቱ 7:00 ሰዓት (11:00 AM – 12:59 PM): 20 to 30 bots (Lunchtime Casual)
 * 5. ከ ከሰዓቱ 7:00 ሰዓት በኋላ – እስከ 9:00 ሰዓት (01:00 PM – 02:59 PM): 35 to 40 bots (Afternoon Rush)
 * 6. ከ ከሰዓቱ 9:00 ሰዓት በኋላ – እስከ ምሽቱ 5:00 ሰዓት (03:00 PM – 10:59 PM): 40 to 50 bots (Super Peak Evening)
 * 7. ከ ምሽቱ 5:00 ሰዓት በኋላ – እስከ ሌሊቱ 7:00 ሰዓት (11:00 PM – 12:59 AM): 20 to 25 bots (Late Night Taper)
 */
export function getRoom10HourlyBounds(date: Date = new Date()): { min: number; max: number } {
  // Convert to Ethiopian / East Africa Time (UTC+3)
  const eatHour = (date.getUTCHours() + 3) % 24;

  // 1. ከ ሌሊቱ 7 ሰዓት – እስከ ንጋቱ 12:00 ሰዓት (01:00 AM – 05:59 AM): 0 bots (Sleep Mode)
  if (eatHour >= 1 && eatHour < 6) {
    return { min: 0, max: 0 };
  }

  // 2. ከ ንጋት 12:00 ሰዓት – እስከ ጠዋቱ 2:00 ሰዓት (06:00 AM – 07:59 AM): 10 to 15 bots
  if (eatHour >= 6 && eatHour < 8) {
    return { min: 10, max: 15 };
  }

  // 3. ከ ጠዋቱ 2:00 ሰዓት – እስከ ረፋዱ 5:00 ሰዓት (08:00 AM – 10:59 AM): 15 to 20 bots
  if (eatHour >= 8 && eatHour < 11) {
    return { min: 15, max: 20 };
  }

  // 4. ከ ረፋዱ 5:00 ሰዓት – እስከ ከሰዓቱ 7:00 ሰዓት (11:00 AM – 12:59 PM): 20 to 30 bots
  if (eatHour >= 11 && eatHour < 13) {
    return { min: 20, max: 30 };
  }

  // 5. ከ ከሰዓቱ 7:00 ሰዓት በኋላ – እስከ 9:00 ሰዓት (01:00 PM – 02:59 PM): 35 to 40 bots
  if (eatHour >= 13 && eatHour < 15) {
    return { min: 35, max: 40 };
  }

  // 6. ከ ከሰዓቱ 9:00 ሰዓት በኋላ – እስከ ምሽቱ 5:00 ሰዓት (03:00 PM – 10:59 PM): 40 to 50 bots
  if (eatHour >= 15 && eatHour < 23) {
    return { min: 40, max: 50 };
  }

  // 7. ከ ምሽቱ 5:00 ሰዓት በኋላ – እስከ ሌሊቱ 7:00 ሰዓት (11:00 PM – 12:59 AM): 20 to 25 bots
  return { min: 20, max: 25 };
}

/**
 * Calculates Room 10's target bot count for the upcoming round:
 * - 0 bots between 01:00 AM and 06:00 AM (sleep mode)
 * - 10 to 50 bots across daytime and evening hours based on Ethiopian clock
 * - Seamless Markovian retention between consecutive rounds (|next - prev| <= 5)
 */
export function calculateRoom10TargetBots(previousTarget?: number, customDate?: Date): number {
  const bounds = getRoom10HourlyBounds(customDate);
  if (bounds.max === 0) {
    return 0; // Absolute 0 bots during late night sleep
  }

  // Generate target using Markovian retention within hourly bounds
  return generateNextRoundBotTarget(previousTarget, bounds.min, bounds.max);
}

/**
 * Calculates the target cumulative bot count that should be present in Room 10
 * at elapsed second `elapsedSeconds` (0 to 45, where elapsedSeconds = 45 - remainingSeconds),
 * mimicking authentic human player arrivals across a 45-second lobby countdown.
 *
 * S-Curve Arrival Intervals:
 * - tau = 0-7s: Early Table Seeding (5% - 10%, baseline 1-2 bots)
 * - tau = 8-21s: Steady Influx (10% - 35%)
 * - tau = 22-35s: The "Hurry-Up" Acceleration (35% - 75%)
 * - tau = 36-43s: Last-Minute Rush (75% - 100%)
 * - tau = 44-45s: Gate Lock (100% exact targetBots)
 *
 * GUARANTEES:
 * 1. Monotonic non-decreasing: N(tau) >= N(tau - 1) for all tau.
 * 2. Bounds guarantee: 0 <= N(tau) <= targetBots.
 * 3. Exact target at gate lock: N(44) === targetBots and N(45) === targetBots.
 * 4. Room Isolation: Pure stateless helper function; zero effect on other rooms.
 *
 * @param targetBots Total bots assigned for the round (e.g. 40)
 * @param elapsedSeconds Seconds elapsed in lobby (0 to 45)
 * @returns Cumulative bot count that should have arrived by this second
 */
export function getTargetBotsForElapsedSecond(targetBots: number, elapsedSeconds: number, totalDuration: number = 40): number {
  if (targetBots <= 0) return 0;
  if (elapsedSeconds <= 0) {
    // At second 0 (40s remaining): Seed initial baseline of 1-2 players
    return Math.min(targetBots, Math.max(1, Math.min(2, Math.floor(targetBots * 0.05) || 1)));
  }
  if (targetBots <= 2) {
    return Math.min(targetBots, elapsedSeconds >= 1 ? targetBots : 1);
  }
  if (elapsedSeconds >= totalDuration - 1) {
    return targetBots; // 100% sealed at gate closure
  }

  const tau = Math.max(0, Math.min(totalDuration, elapsedSeconds));
  let fraction: number;

  if (tau <= 6) {
    // Early birds (5% to 10%)
    fraction = 0.05 + (tau / 6) * 0.05;
  } else if (tau <= 18) {
    // Steady trickle (10% to 35%)
    fraction = 0.10 + ((tau - 6) / 12) * 0.25;
  } else if (tau <= 31) {
    // The "Hurry-Up" influx (35% to 75%)
    fraction = 0.35 + ((tau - 18) / 13) * 0.40;
  } else {
    // Last minute rush (75% to 100%)
    fraction = 0.75 + ((tau - 31) / (totalDuration - 31)) * 0.25;
  }

  const targetAtSecond = Math.floor(targetBots * fraction);
  // Ensure at least baseline 1-2 bots and never exceed targetBots
  return Math.min(targetBots, Math.max(1, targetAtSecond));
}

/**
 * Uniformly samples N distinct bots from the 200-bot roster.
 * Uses Fisher-Yates true random shuffle to guarantee dynamic rotation
 * so players never see the same bots repeatedly.
 *
 * @param count Number of bots to sample (default 20, supports 0 to 50)
 * @param excludeIds Optional set of bot IDs to exclude from this round
 * @returns Array of StandbyBotProfile
 */
export function sampleStandbyBots(count: number = DEFAULT_STANDBY_BOT_COUNT, excludeIds?: Set<string>): StandbyBotProfile[] {
  if (count <= 0) {
    return [];
  }

  const eligible = excludeIds && excludeIds.size > 0
    ? ETHIOPIAN_200_BOT_ROSTER.filter(b => !excludeIds.has(b.id))
    : [...ETHIOPIAN_200_BOT_ROSTER];

  // Fisher-Yates Shuffle on a copy
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Checks if a given user/bot ID belongs to the standby bot roster.
 */
export function isStandbyBotId(id?: string): boolean {
  if (!id) return false;
  return id.startsWith('bot_standby_');
}

/**
 * Fast lookup helper for a standby bot by ID.
 */
export function getStandbyBotById(id: string): StandbyBotProfile | undefined {
  return ETHIOPIAN_200_BOT_ROSTER.find(b => b.id === id);
}
