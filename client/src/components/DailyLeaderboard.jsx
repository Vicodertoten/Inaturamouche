import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import './DailyLeaderboard.css';
import { API_BASE_URL } from '../services/api.js';

const DailyLeaderboard = ({ playerScore, playerTotal, playerPseudo }) => {
  const { t } = useLanguage();
  const [entries, setEntries] = useState([]);
  const [playerRank, setPlayerRank] = useState(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [pseudo, setPseudo] = useState(playerPseudo || '');
  const [loading, setLoading] = useState(false);

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/daily/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setTotalPlayers(data.totalPlayers || 0);
      }
    } catch {
      // Silently ignore — leaderboard is optional
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = pseudo.trim();
    if (!name) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/daily/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: name, score: playerScore, total: playerTotal }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlayerRank(data.rank);
        setSubmitted(true);
        // Save pseudo for future use
        try { localStorage.setItem('daily_pseudo', name); } catch { /* noop */ }
        // Refresh leaderboard
        await fetchLeaderboard();
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="daily-leaderboard">
      <h3 className="section-title">
        {t('daily.leaderboard_title', {}, 'Classement du jour')}
      </h3>

      {!submitted && (
        <form className="daily-submit-form" onSubmit={handleSubmit}>
          <p className="daily-submit-hint">
            {t('daily.submit_hint', {}, 'Entre un pseudo pour apparaître au classement !')}
          </p>
          <div className="daily-submit-row">
            <label className="sr-only" htmlFor="daily-pseudo-input">
              {t('daily.pseudo_label', {}, 'Pseudo')}
            </label>
            <input
              id="daily-pseudo-input"
              type="text"
              className="daily-pseudo-input"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder={t('daily.pseudo_placeholder', {}, 'Ton pseudo…')}
              maxLength={30}
              required
            />
            <button type="submit" className="btn btn--accent daily-submit-btn" disabled={loading || !pseudo.trim()}>
              {loading
                ? t('common.loading', {}, '...')
                : t('daily.submit_score', {}, 'Publier')}
            </button>
          </div>
        </form>
      )}

      {submitted && playerRank && (
        <p className="daily-rank-badge">
          {t('daily.your_rank', { rank: playerRank, total: totalPlayers }, `Tu es ${playerRank}e sur ${totalPlayers} joueurs !`)}
        </p>
      )}

      {entries.length > 0 && (
        <ol className="daily-entries">
          {entries.map((e) => {
            const isPlayer = submitted && e.pseudo.toLowerCase() === pseudo.trim().toLowerCase();
            return (
              <li key={e.rank} className={`daily-entry ${isPlayer ? 'is-player' : ''}`}>
                <span className="daily-entry-rank">
                  {`#${e.rank}`}
                </span>
                <span className="daily-entry-pseudo">{e.pseudo}</span>
                <span className="daily-entry-score">{e.score}/{e.total}</span>
              </li>
            );
          })}
        </ol>
      )}

      {entries.length === 0 && submitted && (
        <p className="daily-empty">{t('daily.first_player', {}, 'Tu es le premier aujourd\'hui !')}</p>
      )}
    </div>
  );
};

export default DailyLeaderboard;
