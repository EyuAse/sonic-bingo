import React, { useState } from 'react';
import { useKeno } from '../context/KenoContext.tsx';
import { ATLAS_V_PAYTABLE } from '../../server/game/kenoMath.ts';

export const KenoRulesModal: React.FC = () => {
  const {
    isRulesModalOpen,
    rulesModalTab,
    closeRulesModal,
    switchRulesTab,
    serverSeedHash,
    verifyRound
  } = useKeno();

  const [verifyServerSeed, setVerifyServerSeed] = useState('');
  const [verifyClientSeed, setVerifyClientSeed] = useState('atlas-v-client-seed');
  const [verifyNonce, setVerifyNonce] = useState('1001');
  const [verifyDrawn, setVerifyDrawn] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; error?: string } | null>(null);

  if (!isRulesModalOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyServerSeed) return;

    const drawnArray = verifyDrawn
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    const res = await verifyRound({
      serverSeed: verifyServerSeed,
      expectedHash: '',
      clientSeed: verifyClientSeed,
      nonce: parseInt(verifyNonce, 10) || 1,
      expectedDrawn: drawnArray
    });

    setVerifyResult(res);
  };

  return (
    <div
      className="rules-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeRulesModal();
      }}
    >
      <div className="rules-modal-card">
        {/* Header: UK Flag & Close Button */}
        <div className="rules-modal-header">
          <div className="rules-lang-flag" title="English">
            <svg
              viewBox="0 0 60 30"
              width="34"
              height="19"
              style={{ borderRadius: '3px', display: 'block', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
            >
              <clipPath id="uk-clip">
                <rect width="60" height="30" rx="3" />
              </clipPath>
              <g clipPath="url(#uk-clip)">
                <rect width="60" height="30" fill="#012169" />
                <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
                <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" />
                <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
                <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
              </g>
            </svg>
          </div>

          <button
            type="button"
            className="rules-modal-close"
            onClick={closeRulesModal}
            aria-label="Close Rules Modal"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="rules-nav-tabs">
          <button
            type="button"
            className={`rules-tab-btn ${rulesModalTab === 'rules' ? 'active' : ''}`}
            onClick={() => switchRulesTab('rules')}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            RULES
          </button>
          <button
            type="button"
            className={`rules-tab-btn ${rulesModalTab === 'fairness' ? 'active' : ''}`}
            onClick={() => switchRulesTab('fairness')}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            FAIRNESS
          </button>
        </div>

        {/* Body Content */}
        <div className="rules-modal-body">
          {rulesModalTab === 'rules' ? (
            <div>
              <p style={{ margin: '0 0 16px', color: '#b8c5c2' }}>
                In the field where the numbers from 1 to 80 are present, HOT and COLD numbers are
                indicated in red and blue colors, with hot numbers being those that are frequently
                drawn and blue being those that are drawn more infrequently.
              </p>

              <h3 style={{ margin: '16px 0 8px', fontSize: '15px', color: '#ffffff' }}>Payments</h3>
              <p style={{ margin: '0 0 10px', color: '#b8c5c2' }}>
                All winning ball combinations have corresponding odds, which is multiplied by the
                player&apos;s bet amount.
              </p>
              <p style={{ margin: '0 0 16px', color: '#b8c5c2' }}>
                The winning combination is calculated as the ratio of the number of balls bet to the
                number of guessed balls.
              </p>

              {/* Exact 10x10 Matrix Matching Screenshot */}
              <div className="rules-table-container">
                <table className="rules-pay-table">
                  <thead>
                    <tr>
                      <th style={{ width: '32px' }}></th>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                        <th key={s}>{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((hits) => (
                      <tr key={hits}>
                        <td style={{ fontWeight: 700, background: '#101a18', color: '#7d8c89' }}>
                          {hits}
                        </td>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((spots) => {
                          const mult = (ATLAS_V_PAYTABLE[spots] || {})[hits];
                          const has = mult !== undefined && mult > 0;
                          const isJackpot = mult >= 10000;

                          return (
                            <td
                              key={spots}
                              className={isJackpot ? 'jackpot' : has ? 'has-payout' : ''}
                            >
                              {has ? mult : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#889794' }}>
                <strong>Disconnection policy:</strong> If a disconnection occurs after an active
                game round and your bets were accepted by the server, the game will proceed as normal
                and any winnings will be processed according to the game result regardless of the
                disconnection.
              </p>
            </div>
          ) : (
            <div className="rules-fairness-wrap">
              <div className="fairness-shield-icon">
                <svg viewBox="0 0 48 54" width="46" height="52" fill="none">
                  <path d="M24 2L5 9.5V25C5 38 13.2 49.8 24 53C34.8 49.8 43 38 43 25V9.5L24 2Z" fill="url(#fairShieldGradModal)" stroke="#4fe6a3" strokeWidth="1.8" strokeLinejoin="round"/>
                  <path d="M24 4.5L7.5 11.2V25C7.5 36.5 14.8 47 24 49.8C33.2 47 40.5 36.5 40.5 25V11.2L24 4.5Z" fill="url(#fairInnerGradModal)" opacity="0.6"/>
                  <path d="M16 26.5L21.5 32L32 19.5" stroke="#ffffff" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <defs>
                    <linearGradient id="fairShieldGradModal" x1="24" y1="2" x2="24" y2="53" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#3ddc97"/>
                      <stop offset="0.3" stopColor="#1b7348"/>
                      <stop offset="0.7" stopColor="#0e4329"/>
                      <stop offset="1" stopColor="#072214"/>
                    </linearGradient>
                    <linearGradient id="fairInnerGradModal" x1="24" y1="4.5" x2="24" y2="49.8" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#55f2ab" stopOpacity="0.5"/>
                      <stop offset="0.5" stopColor="#145233" stopOpacity="0.2"/>
                      <stop offset="1" stopColor="#051a0f" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h3 className="fairness-main-title">ABOUT FAIRNESS</h3>
              <div className="fairness-content-box">
                <p className="fairness-p">Before the start of a round, the players are provided with a “Hash Code*” - an encrypted text combination “Key*”. Here are the round outcome numbers.</p>
                <p className="fairness-p">The outcome of the round is determined not at the moment of the game, but in advance for current round, and is given to the players in coded form.</p>
                <p className="fairness-p">For example, “Hash (Hash) code *” <span className="fairness-hash-code">3586ED7EECC3AEA4A6AC4A359D96E5CF30BBC47E24ED9E030066D7C7DE6C82B1F1376122E35B5165342F27243E1BE5B46B31F2A5D97E6DE26E0E4A6202DF3CDD</span>.</p>
                <p className="fairness-p">After the end of a round, the players are provided with a “Key*” and an additional input parameter for getting the “Hash Code*” - “Salt*” Using them, every player can copy and encrypt this combination to see that the encrypted “Key * ” corresponds to the “Hash code *” previously determined by the system. This ensures that the outcome of the game is determined not at the moment of the round, but previously, before playing a round.</p>
                <p className="fairness-p">What is “Salt*” - it is a random sequence of letters and numbers, For instance: <span className="fairness-code-val">e20d4c76c654</span>.</p>
                <div className="fairness-p">
                  What is “Key*” - a text combination of four parameters
                  <ol className="fairness-list">
                    <li>Round Id</li>
                    <li>The outcome numbers</li>
                    <li>Wording “Keno”</li>
                    <li>A random sequence of letters and numbers</li>
                  </ol>
                  After the end of a game, the player will see the Key in his betting history as follows: Round ID (for example, 3013185); the outcome numbers (for instance: numbers 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20); the name of the game - Keno, and a random sequence of letters and numbers - ca50e5af-9fd6- 46fc-bafa-5cfa21d2602e, followed by the “Key*”, which in this case is - <span className="fairness-code-val">3013185_numbers_1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20_Keno_ca50e5af-9fd6-46fc-bafa-5cfa21d2602e</span>.
                </div>
                <p className="fairness-p">If we encrypt the “Key*” via the “Salt*” (for example, 2b4545ed5a) using the SHA512 generator, we'll get the defined Hash code. <span className="fairness-hash-code">3586ED7EECC3AEA4A6AC4A359D96E5CF30BBC47E24ED9E030066D7C7DE6C82B1F1376122E35B5165342F27243E1BE5B46B31F2A5D97E6DE26E0E4A6202DF3CDD</span>.</p>
                <p className="fairness-p">To get a hash code you can click on check icon in Result section and perform the check. You can get the encryption “Key*” and “Hash Code*” below or check on any online server that has a generator SHA512 With Salt.</p>
              </div>

              <div
                style={{
                  background: 'var(--keno-dark)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--keno-border)',
                  marginTop: '16px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--keno-mut)' }}>
                  ACTIVE ROUND SERVER SEED HASH (SHA-256)
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: 'var(--keno-y)',
                    wordBreak: 'break-all',
                    marginTop: '4px'
                  }}
                >
                  {serverSeedHash || 'Waiting for active round hash...'}
                </div>
              </div>

              <form onSubmit={handleVerify}>
                <div className="rules-fair-input-group">
                  <label className="rules-fair-label">Revealed Server Seed</label>
                  <input
                    type="text"
                    className="rules-fair-input"
                    value={verifyServerSeed}
                    onChange={(e) => setVerifyServerSeed(e.target.value)}
                    placeholder="Enter revealed 64-char server seed..."
                    required
                  />
                </div>

                <div className="rules-fair-input-group">
                  <label className="rules-fair-label">Client Seed</label>
                  <input
                    type="text"
                    className="rules-fair-input"
                    value={verifyClientSeed}
                    onChange={(e) => setVerifyClientSeed(e.target.value)}
                  />
                </div>

                <div className="rules-fair-input-group">
                  <label className="rules-fair-label">Nonce (Round Number)</label>
                  <input
                    type="number"
                    className="rules-fair-input"
                    value={verifyNonce}
                    onChange={(e) => setVerifyNonce(e.target.value)}
                  />
                </div>

                <div className="rules-fair-input-group">
                  <label className="rules-fair-label">Expected Drawn Numbers (comma separated)</label>
                  <input
                    type="text"
                    className="rules-fair-input"
                    value={verifyDrawn}
                    onChange={(e) => setVerifyDrawn(e.target.value)}
                    placeholder="e.g. 5, 12, 19, 28, 33, ..."
                  />
                </div>

                <button type="submit" className="rules-verify-btn">
                  Verify Proof
                </button>
              </form>

              {verifyResult && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '10px',
                    borderRadius: '6px',
                    background: verifyResult.valid ? '#122e22' : '#2e1212',
                    border: `1px solid ${verifyResult.valid ? 'var(--keno-g)' : 'var(--keno-r)'}`
                  }}
                >
                  {verifyResult.valid ? (
                    <span style={{ color: 'var(--keno-g)', fontWeight: 700 }}>
                      ✓ PROVABLY FAIR VERIFIED: Draw sequence strictly matches cryptographic commitment!
                    </span>
                  ) : (
                    <span style={{ color: 'var(--keno-r)', fontWeight: 700 }}>
                      ✗ Verification failed: {verifyResult.error || 'Seed mismatch'}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

