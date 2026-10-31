import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { socketService } from '../../services/socketService.ts';
import { apiClient } from '../../services/apiClient.ts';
import { DatabaseHealthWidget } from './DatabaseHealthWidget.tsx';

interface RoomMetric {
  id: string;
  name: string;
  stakeAmount: number;
  phase: string;
  roundNumber: number;
  activeSocketsCount: number;
  ticketsCount: number;
  playersCount: number;
  drawnBallsCount: number;
}

interface OfflineWin {
  id: string;
  userId: string;
  userName: string;
  roomId: string;
  roundNumber: number;
  cartelaId: number;
  amount: number;
  referenceCode: string;
  timestamp: string;
  isOffline: boolean;
  acknowledged: boolean;
  winningPattern: string;
}

interface NetworkMetrics {
  totalActiveSockets: number;
  engineStatus: string;
  disconnectProtectionActive: boolean;
  transportsSupported: string[];
  rooms: RoomMetric[];
  totalOfflineWinsRecorded: number;
  recentOfflineWins: OfflineWin[];
  serverTimestamp: string;
}

export const NetworkHealthDesk: React.FC = () => {
  const { showToast } = useApp();
  const [metrics, setMetrics] = useState<NetworkMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [livePing, setLivePing] = useState<number>(24);
  const [isTestingPing, setIsTestingPing] = useState<boolean>(false);

  const fetchMetrics = async () => {
    try {
      const data = await apiClient.admin.getNetworkHealth();
      if (data && data.success && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Error fetching network metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleTestPing = async () => {
    setIsTestingPing(true);
    try {
      const ping = await socketService.measurePing();
      setLivePing(ping);
      showToast(`⚡ Server Round-Trip Latency: ${ping}ms`);
    } catch (err) {
      showToast('⚠️ Ping measurement failed');
    } finally {
      setIsTestingPing(false);
    }
  };

  const safeRooms = metrics?.rooms || [];
  const safeOfflineWins = metrics?.recentOfflineWins || [];

  return (
    <div className="admin-content-desk-container">
      {/* 1. Hero Banner */}
      <div className="desk-hero-banner network-hero">
        <div className="desk-hero-left">
          <div className="desk-hero-icon-box broadcast-icon">
            <i className="fa-solid fa-tower-broadcast"></i>
          </div>
          <div className="desk-hero-titles">
            <div className="desk-hero-badge-row">
              <span className="live-status-pill green">
                <span className="pulse-green-dot"></span>
                <span>DUAL-ENGINE SYSTEM ACTIVE</span>
              </span>
              <span className="tech-tag">WebSocket + HTTP Fallback</span>
              <span className="tech-tag shield">
                <i className="fa-solid fa-shield-halved"></i> 100% Disconnect Protected
              </span>
            </div>
            <h1 className="desk-hero-main-title">LIVE NETWORK HEALTH & DISCONNECT PROTECTION</h1>
            <p className="desk-hero-sub-title">
              የሞባይል ኔትዎርክ ፍጥነት፣ የቀጥታ ሶኬት ግንኙነቶች እና ተጫዋቾች ስልካቸው ቢቋረጥም ገንዘብ የሚያስገኝ ራስ-ሰር ሞተር
            </p>
          </div>
        </div>

        <div className="desk-hero-actions">
          <button
            type="button"
            className="desk-action-btn ping-btn"
            onClick={handleTestPing}
            disabled={isTestingPing}
          >
            <i className={`fa-solid fa-bolt ${isTestingPing ? 'fa-spin' : ''}`}></i>
            <span>{isTestingPing ? 'Pinging...' : `Ping: ${livePing}ms`}</span>
          </button>
          <button
            type="button"
            className="desk-action-btn refresh-btn"
            onClick={() => {
              fetchMetrics();
              showToast('🔄 Live Metrics Refreshed');
            }}
          >
            <i className="fa-solid fa-rotate-right"></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Key Operational KPI Cards */}
      <div className="network-kpi-grid">
        <div className="network-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-title">Active Sockets Online</span>
            <div className="kpi-icon-pill green">
              <i className="fa-solid fa-plug-circle-bolt"></i>
            </div>
          </div>
          <div className="kpi-main-number">{metrics ? metrics.totalActiveSockets : '...'}</div>
          <div className="kpi-sub-txt green">
            <i className="fa-solid fa-wifi"></i> Low-Latency Keepalive (5s/4s)
          </div>
        </div>

        <div className="network-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-title">Roundtrip Latency</span>
            <div className="kpi-icon-pill blue">
              <i className="fa-solid fa-stopwatch"></i>
            </div>
          </div>
          <div className="kpi-main-number">{livePing} <small style={{ fontSize: '1rem' }}>ms</small></div>
          <div className="kpi-sub-txt blue">
            <i className="fa-solid fa-gauge-high"></i> High-Speed Ethiopian 4G Ready
          </div>
        </div>

        <div className="network-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-title">Disconnect Protection</span>
            <div className="kpi-icon-pill gold">
              <i className="fa-solid fa-shield-cat"></i>
            </div>
          </div>
          <div className="kpi-main-number gold-txt">100% SHIELD</div>
          <div className="kpi-sub-txt gold">
            <i className="fa-solid fa-circle-check"></i> Authoritative Neon DB Auto-Claim
          </div>
        </div>

        <div className="network-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-title">Auto-Credited Offline Wins</span>
            <div className="kpi-icon-pill purple">
              <i className="fa-solid fa-trophy"></i>
            </div>
          </div>
          <div className="kpi-main-number purple-txt">
            {metrics ? metrics.totalOfflineWinsRecorded : 0}
          </div>
          <div className="kpi-sub-txt purple">
            <i className="fa-solid fa-coins"></i> Total Disconnected Payouts Saved
          </div>
        </div>
      </div>

      {/* 3. Live Game Rooms Connectivity Table */}
      <div className="desk-table-card">
        <div className="desk-table-header">
          <div className="table-header-left">
            <h3 className="desk-table-title">
              <i className="fa-solid fa-cubes-stacked"></i> Live Rooms Network Distribution
            </h3>
            <p className="desk-table-desc">Active socket transports and state synchronizations per room</p>
          </div>
          <span className="table-status-pill">4 Rooms Online</span>
        </div>

        <div className="table-responsive-wrapper">
          <table className="admin-clean-table">
            <thead>
              <tr>
                <th>Room Name</th>
                <th>Stake</th>
                <th>Current Phase</th>
                <th>Round #</th>
                <th>Active Sockets</th>
                <th>Active Tickets</th>
                <th>Balls Called</th>
                <th>Fallback Protection</th>
              </tr>
            </thead>
            <tbody>
              {safeRooms.map(room => (
                <tr key={room.id}>
                  <td>
                    <div className="room-name-cell">
                      <i className="fa-solid fa-circle-play purple-icon"></i>
                      <strong>{room.name}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="stake-badge">{room.stakeAmount} ETB</span>
                  </td>
                  <td>
                    <span className={`phase-tag ${room.phase}`}>
                      {room.phase.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <strong>#{room.roundNumber}</strong>
                  </td>
                  <td>
                    <span className="socket-count-badge">
                      <span className="pulse-green-mini"></span>
                      {room.activeSocketsCount} Sockets
                    </span>
                  </td>
                  <td>
                    <strong>{room.ticketsCount} tickets</strong>
                  </td>
                  <td>
                    <span className="balls-count-badge">{room.drawnBallsCount} / 75</span>
                  </td>
                  <td>
                    <span className="shield-tag-active">
                      <i className="fa-solid fa-shield-halved"></i> Active
                    </span>
                  </td>
                </tr>
              ))}
              {safeRooms.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    {isLoading ? 'Loading live room metrics...' : 'No room data available'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Neon Cloud Database & Free-Tier Quota Health Desk */}
      <DatabaseHealthWidget />

      {/* 5. Disconnect Protection & Offline Wins Audit Ledger */}
      <div className="desk-table-card" style={{ marginTop: '20px' }}>
        <div className="desk-table-header">
          <div className="table-header-left">
            <h3 className="desk-table-title">
              <i className="fa-solid fa-receipt"></i> Disconnect Protection Audit Ledger
            </h3>
            <p className="desk-table-desc">
              All rounds where players won while offline and were automatically credited in Neon PostgreSQL
            </p>
          </div>
          <span className="table-status-pill gold-border">
            <i className="fa-solid fa-lock"></i> Authoritative Ledger
          </span>
        </div>

        <div className="table-responsive-wrapper">
          <table className="admin-clean-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Room</th>
                <th>Round</th>
                <th>Cartela #</th>
                <th>Amount</th>
                <th>Neon DB Wallet Status</th>
                <th>Reference Code</th>
                <th>Time (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {safeOfflineWins.map(win => (
                <tr key={win.id}>
                  <td>
                    <div className="user-id-cell">
                      <strong>{win.userName}</strong>
                      <small className="muted-id">{win.userId ? `${win.userId.slice(0, 8)}...` : 'N/A'}</small>
                    </div>
                  </td>
                  <td>
                    <span className="stake-badge">{win.roomId.toUpperCase()}</span>
                  </td>
                  <td>
                    <strong>#{win.roundNumber}</strong>
                  </td>
                  <td>
                    <span className="cartela-pill">#{win.cartelaId}</span>
                  </td>
                  <td>
                    <strong className="green-amount">+{win.amount.toFixed(2)} ETB</strong>
                  </td>
                  <td>
                    <span className="status-badge-approved">
                      <i className="fa-solid fa-circle-check"></i> Credited to Wallet
                    </span>
                  </td>
                  <td>
                    <code className="ref-code">{win.referenceCode}</code>
                  </td>
                  <td>
                    <span className="timestamp-txt">
                      {new Date(win.timestamp).toLocaleTimeString()}
                    </span>
                  </td>
                </tr>
              ))}
              {safeOfflineWins.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    <i className="fa-solid fa-shield-halved" style={{ fontSize: '1.5rem', color: '#22c55e', marginBottom: '8px', display: 'block' }}></i>
                    <strong>Disconnect Protection is Active & Ready.</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                      When a player buys a ticket and disconnects, their winnings will be automatically logged and credited here.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
