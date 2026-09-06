/**
 * ThreatRadar.js - 49-Period Temporal Threat Intelligence & Suspicious Activity Discovery
 * Law Enforcement & Compliance Analysts can prioritize and triage high-risk targets
 * across all 49 authentic Elliptic dataset periods without needing prior knowledge of any Bitcoin TXID.
 */

import { getTransactionStatus } from '../utils/statusHelper.js';

export class ThreatRadar {
  constructor(onInvestigateCallback, onTraceCallback) {
    this.onInvestigate = onInvestigateCallback;
    this.onTrace = onTraceCallback;
    this.candidates = [];
    this.periods = [];
    this.periodsMap = new Map();
    this.activeCategory = 'ALL';
    this.activeTimestep = null;
    this.isLoading = false;

    this.container = document.getElementById('threat-radar-container');
    this.init();
  }

  async init() {
    if (!this.container) return;
    this.render();
    await this.fetchTimelineData();
    await this.fetchCandidates();
  }

  render() {
    this.container.innerHTML = `
      <div class="radar-hud-card">
        <!-- Header -->
        <div class="radar-header">
          <div class="radar-title-box">
            <div class="radar-icon-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 3v9l6 3"/>
              </svg>
            </div>
            <div>
              <h3 class="radar-title">Threat Radar · 49-Period Temporal Intelligence</h3>
              <p class="radar-subtitle">
                Temporal activity, illicit surges, and prioritized triage across 203,769 verified Bitcoin transactions.
              </p>
            </div>
          </div>
          <div class="radar-header-actions">
            <button id="radar-refresh-btn" class="btn-radar-action" title="Refresh Discovery Queue">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              <span>Scan Network</span>
            </button>
          </div>
        </div>

        <!-- 49-Period Temporal Intelligence Strip -->
        <div class="radar-temporal-section">
          <div class="radar-temporal-header">
            <div class="temporal-title-wrap">
              <span class="temporal-section-tag">49-Period Temporal Activity Over Time</span>
              <span class="temporal-period-indicator" id="radar-selected-period-label">Showing All 49 Periods (Click any period bar to filter)</span>
            </div>
            <button class="btn-reset-period-filter hidden" id="radar-btn-clear-period">Clear Period Filter (Show All)</button>
          </div>

          <!-- 49 Columns Strip Container -->
          <div class="radar-49-timeline-strip" id="radar-49-timeline-strip">
            <div class="timeline-loading-hint">Loading 49-period temporal benchmark data...</div>
          </div>

          <!-- Selected Period Quick Metrics Bar -->
          <div class="radar-period-quick-bar" id="radar-period-quick-bar">
            <div class="rp-stat-item">
              <span class="rp-stat-label">Active Period:</span>
              <strong class="rp-stat-val mono text-cyan" id="rp-active-period">All 49 Periods</strong>
            </div>
            <div class="rp-stat-item">
              <span class="rp-stat-label">Total Transactions:</span>
              <strong class="rp-stat-val mono" id="rp-total-txs">203,769</strong>
            </div>
            <div class="rp-stat-item">
              <span class="rp-stat-label">Illicit Ground-Truth:</span>
              <strong class="rp-stat-val mono text-threat" id="rp-illicit-txs">4,545</strong>
            </div>
            <div class="rp-stat-item">
              <span class="rp-stat-label">Threat Concentration:</span>
              <strong class="rp-stat-val mono text-amber" id="rp-threat-pct">2.23%</strong>
            </div>
            <div class="rp-stat-item">
              <span class="rp-stat-label">Temporal Velocity:</span>
              <strong class="rp-stat-val mono" id="rp-velocity">Stable Strata</strong>
            </div>
          </div>
        </div>

        <!-- Filter Chips -->
        <div class="radar-filters-bar">
          <button class="radar-chip active" data-category="ALL">All Threat Classes</button>
          <button class="radar-chip" data-category="CRITICAL">Critical Threats</button>
          <button class="radar-chip" data-category="HIGH">High Risk</button>
          <button class="radar-chip" data-category="MEDIUM">Review Candidates</button>
          <button class="radar-chip" data-category="PEELING_CHAIN">Peeling Chains</button>
        </div>

        <!-- 4 Sectioned Threat Radar Container -->
        <div class="radar-sections-container" id="radar-sections-root">
          <div id="radar-loading-indicator" class="radar-loading-state" style="display: none;">
            <div class="radar-spinner"></div>
            <span>Analyzing real Bitcoin transactions across dataset timesteps...</span>
          </div>

          <div id="radar-sections-content">
            <!-- Dynamically populated 4 sections: Critical, High, Review, Emerging Patterns -->
          </div>
        </div>
      </div>
    `;

    // Bind event listeners
    const refreshBtn = this.container.querySelector('#radar-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.fetchTimelineData();
        this.fetchCandidates();
      });
    }

    const clearPeriodBtn = this.container.querySelector('#radar-btn-clear-period');
    if (clearPeriodBtn) {
      clearPeriodBtn.addEventListener('click', () => {
        this.setTimestep(null);
      });
    }

    const chips = this.container.querySelectorAll('.radar-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeCategory = chip.getAttribute('data-category');
        this.fetchCandidates();
      });
    });
  }

  async fetchTimelineData() {
    try {
      const res = await fetch('/api/analytics/timeline');
      if (!res.ok) return;
      const data = await res.json();
      this.periods = data.periods || [];
      this.periodsMap.clear();
      this.periods.forEach(p => this.periodsMap.set(p.timestep, p));
      this.render49TimelineStrip();
    } catch (e) {
      console.warn('[ThreatRadar] Could not fetch timeline data:', e);
    }
  }

  render49TimelineStrip() {
    const stripEl = this.container.querySelector('#radar-49-timeline-strip');
    if (!stripEl || this.periods.length === 0) return;

    stripEl.innerHTML = '';
    const maxTxs = Math.max(...this.periods.map(p => p.total_txs || 1), 1000);

    this.periods.forEach(p => {
      const col = document.createElement('div');
      const isSelected = (p.timestep === this.activeTimestep);
      const isCritical = p.illicit_count >= 50;
      const isElevated = p.illicit_count >= 10 && !isCritical;
      const threatColor = isCritical ? '#ef4444' : (isElevated ? '#f59e0b' : '#10b981');
      const heightPct = Math.max(16, Math.min(100, Math.round((p.total_txs / maxTxs) * 100)));

      col.className = `radar-timeline-col ${isSelected ? 'selected' : ''} ${isCritical ? 'critical-threat' : ''}`;
      col.setAttribute('data-period', p.timestep);
      col.title = `Period ${p.timestep}: ${p.total_txs.toLocaleString()} Txs (${p.illicit_count} Illicit, Avg Risk: ${p.avg_risk}/100)`;

      col.innerHTML = `
        <div class="col-bar-track">
          <div class="col-bar-fill" style="height: ${heightPct}%; background-color: ${threatColor};"></div>
          ${isCritical ? '<div class="col-threat-indicator"></div>' : ''}
        </div>
        <span class="col-period-num mono">${p.timestep}</span>
      `;

      col.addEventListener('click', () => {
        if (this.activeTimestep === p.timestep) {
          this.setTimestep(null);
        } else {
          this.setTimestep(p.timestep);
        }
      });

      stripEl.appendChild(col);
    });

    this.updatePeriodQuickBar();
  }

  updatePeriodQuickBar() {
    const periodLabel = this.container.querySelector('#radar-selected-period-label');
    const clearBtn = this.container.querySelector('#radar-btn-clear-period');
    const pVal = this.container.querySelector('#rp-active-period');
    const txVal = this.container.querySelector('#rp-total-txs');
    const illVal = this.container.querySelector('#rp-illicit-txs');
    const pctVal = this.container.querySelector('#rp-threat-pct');
    const velVal = this.container.querySelector('#rp-velocity');

    if (!pVal) return;

    if (this.activeTimestep && this.periodsMap.has(this.activeTimestep)) {
      const p = this.periodsMap.get(this.activeTimestep);
      if (periodLabel) periodLabel.textContent = `Filtered to Period ${p.timestep} of 49 (${p.total_txs.toLocaleString()} Transactions)`;
      if (clearBtn) clearBtn.classList.remove('hidden');
      pVal.textContent = `Period ${p.timestep} / 49`;
      txVal.textContent = p.total_txs.toLocaleString();
      illVal.textContent = p.illicit_count.toLocaleString();
      const pct = p.total_txs > 0 ? ((p.illicit_count / p.total_txs) * 100).toFixed(2) : '0.00';
      pctVal.textContent = `${pct}% (${p.activity_level || 'EVALUATED'})`;
      velVal.textContent = p.avg_risk ? `Avg Risk: ${p.avg_risk}/100` : 'Normal Flow';
    } else {
      if (periodLabel) periodLabel.textContent = 'Showing All 49 Periods (Click any period bar to filter)';
      if (clearBtn) clearBtn.classList.add('hidden');
      pVal.textContent = 'All 49 Periods';
      txVal.textContent = '203,769';
      illVal.textContent = '4,545';
      pctVal.textContent = '2.23% Benchmark';
      velVal.textContent = '49 Discrete Windows';
    }
  }

  setTimestep(ts) {
    this.activeTimestep = ts;
    const cols = this.container.querySelectorAll('.radar-timeline-col');
    cols.forEach(col => {
      const p = parseInt(col.getAttribute('data-period'), 10);
      col.classList.toggle('selected', p === ts);
    });
    this.updatePeriodQuickBar();
    this.fetchCandidates();
  }

  async fetchCandidates() {
    if (this.isLoading) return;
    this.isLoading = true;

    const loadingEl = this.container.querySelector('#radar-loading-indicator');
    const contentEl = this.container.querySelector('#radar-sections-content');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
      let url = `/api/discovery/suspicious?limit=40`;
      if (this.activeTimestep) {
        url += `&timestep=${this.activeTimestep}`;
      }
      if (this.activeCategory && this.activeCategory !== 'ALL') {
        url += `&category=${encodeURIComponent(this.activeCategory)}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.candidates = data.candidates || [];
      this.renderCandidatesSections();
    } catch (err) {
      console.warn('[ThreatRadar] Discovery fetch failed:', err);
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="radar-empty" style="color: #ef4444; padding: 24px; text-align: center;">
            Failed to load discovery queue. Verify backend server is running on port 8000.
          </div>
        `;
      }
    } finally {
      this.isLoading = false;
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  renderCandidatesSections() {
    const contentEl = this.container.querySelector('#radar-sections-content');
    if (!contentEl) return;

    if (!this.candidates || this.candidates.length === 0) {
      contentEl.innerHTML = `
        <div class="radar-empty" style="padding: 32px; text-align: center; color: var(--text-dim);">
          No suspicious targets matched category in Period #${this.activeTimestep || 'All 49'}.
        </div>
      `;
      return;
    }

    // Categorize candidates into 4 distinct forensic sections
    const critical = [];
    const high = [];
    const review = [];
    const emerging = [];

    this.candidates.forEach(c => {
      const score = c.risk_score || Math.round((c.illicit_probability || 0.5) * 100);
      const isGtIllicit = (c.label === '1' || String(c.dataset_class).toLowerCase() === 'illicit');
      const pattern = String(c.pattern || c.candidate_reason || '').toLowerCase();

      if (isGtIllicit || score >= 85) {
        critical.push(c);
      } else if (score >= 65) {
        high.push(c);
      } else if (pattern.includes('fan-out') || pattern.includes('mixer') || pattern.includes('hub') || pattern.includes('peeling')) {
        emerging.push(c);
      } else {
        review.push(c);
      }
    });

    const renderCard = (c, badgeColor) => {
      const score = c.risk_score || Math.round((c.illicit_probability || 0.5) * 100);
      const isIllicit = (c.label === '1' || String(c.dataset_class).toLowerCase() === 'illicit');
      const isLicit = (c.label === '2' || String(c.dataset_class).toLowerCase() === 'licit');
      const classLabel = isIllicit ? 'Illicit' : (isLicit ? 'Licit' : 'Unknown');
      const reason = c.candidate_reason || c.pattern || (isIllicit ? 'Direct ground-truth criminal entity with anomalous fan-out.' : 'Unlabeled transaction exhibiting multi-hop flow characteristics.');
      const timePeriod = c.timestep || 1;

      return `
        <div class="radar-target-card" data-txid="${c.tx_id}" data-ts="${timePeriod}">
          <div class="radar-card-head">
            <span class="radar-card-tx mono">#${c.tx_id}</span>
            <span class="radar-card-score mono" style="color: ${badgeColor};">${score} / 100</span>
          </div>
          <div class="radar-card-body">
            <div class="radar-card-meta-row">
              <span class="disc-class-pill ${classLabel.toLowerCase()}">${classLabel}</span>
              <span class="radar-card-period mono">Period ${timePeriod}</span>
            </div>
            <div class="radar-card-pattern">${reason}</div>
          </div>
          <div class="radar-card-foot">
            <span class="radar-card-deg mono text-dim">${c.in_degree || 0} in · ${c.out_degree || 0} out</span>
            <button class="btn-radar-investigate" data-txid="${c.tx_id}" data-ts="${timePeriod}">
              <span>Investigate</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      `;
    };

    const renderSectionBlock = (title, items, color, tag) => {
      if (items.length === 0) return '';
      return `
        <div class="radar-section-block">
          <div class="radar-sec-header">
            <span class="radar-sec-indicator" style="background-color: ${color};"></span>
            <h4 class="radar-sec-title">${title}</h4>
            <span class="radar-sec-tag">${tag} · ${items.length} targets</span>
          </div>
          <div class="radar-cards-row">
            ${items.slice(0, 6).map(c => renderCard(c, color)).join('')}
          </div>
        </div>
      `;
    };

    contentEl.innerHTML = `
      ${renderSectionBlock('Critical Threats', critical, '#ef4444', 'Ground-Truth Illicit & High Confidence')}
      ${renderSectionBlock('High-Risk Entities', high, '#f97316', 'Elevated Topological & Behavioral Risk')}
      ${renderSectionBlock('Review Candidates', review, '#f59e0b', 'Unlabeled Entities Requiring AML Assessment')}
      ${renderSectionBlock('Emerging Patterns', emerging, '#38bdf8', 'Fan-Out Mixers, Hubs & Peeling Chains')}
    `;

    // Bind investigate button clicks
    const investBtns = contentEl.querySelectorAll('.btn-radar-investigate');
    investBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const txId = btn.getAttribute('data-txid');
        const ts = parseInt(btn.getAttribute('data-ts'), 10) || 1;
        if (this.onInvestigate) {
          this.onInvestigate(txId, ts);
        }
      });
    });

    // Row / Card click also investigates
    const cards = contentEl.querySelectorAll('.radar-target-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const txId = card.getAttribute('data-txid');
        const ts = parseInt(card.getAttribute('data-ts'), 10) || 1;
        if (this.onInvestigate) {
          this.onInvestigate(txId, ts);
        }
      });
    });
  }
}
