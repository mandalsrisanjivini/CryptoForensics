/**
 * InvestigationTimeline.js
 * 49-Period Threat Intelligence & Temporal Activity Engine
 * Authentically evaluates real metrics across all 49 Elliptic Bitcoin dataset periods.
 */

export class InvestigationTimeline {
  constructor(onSliceChangedCallback) {
    this.onSliceChanged = onSliceChangedCallback;
    this.currentSlice = 1;
    this.periods = [];
    this.periodsMap = new Map();
    this.isLoading = false;

    // Elements in 3D Network bottom time bar
    this.counterEl = document.getElementById('nav-slice-counter');
    this.prevBtn = document.getElementById('btn-nav-prev');
    this.nextBtn = document.getElementById('btn-nav-next');
    this.sliceSelect = document.getElementById('select-slice-jump');
    this.visualTimelineStrip = document.getElementById('visual-timeline-strip');
    this.timeBarStatsEl = document.getElementById('timeline-period-stats');

    // Elements in dedicated Timeline View
    this.matrixStripEl = document.getElementById('timeline-matrix-49-strip');
    this.btnFindHighRisk = document.getElementById('btn-timeline-find-high-risk');
    this.btnOpen3d = document.getElementById('btn-timeline-open-3d');
    this.highRiskGridEl = document.getElementById('high-risk-periods-grid');

    // Tooltip Element
    this.tooltipEl = null;

    this.init();
  }

  async init() {
    this.createTooltipElement();
    this.bindControls();
    await this.fetchTimelineData();
  }

  createTooltipElement() {
    let tip = document.getElementById('timeline-interactive-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'timeline-interactive-tooltip';
      tip.className = 'timeline-interactive-tooltip hidden';
      document.body.appendChild(tip);
    }
    this.tooltipEl = tip;
  }

  bindControls() {
    // Dropdown populator
    if (this.sliceSelect) {
      this.sliceSelect.innerHTML = '';
      for (let i = 1; i <= 49; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Period ${i} of 49`;
        this.sliceSelect.appendChild(opt);
      }
      this.sliceSelect.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (val >= 1 && val <= 49) this.setSlice(val);
      });
    }

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => {
        if (this.currentSlice > 1) this.setSlice(this.currentSlice - 1);
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        if (this.currentSlice < 49) this.setSlice(this.currentSlice + 1);
      });
    }

    if (this.btnFindHighRisk) {
      this.btnFindHighRisk.addEventListener('click', () => {
        this.highlightHighRiskPeriods();
      });
    }

    // Connect Open in 3D Network from Timeline View
    if (this.btnOpen3d) {
      this.btnOpen3d.addEventListener('click', () => {
        const netBtn = document.getElementById('nav-btn-network');
        if (netBtn) netBtn.click();
      });
    }
  }

  async fetchTimelineData() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const res = await fetch('/api/analytics/timeline');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.periods = data.periods || [];
      this.periodsMap.clear();

      this.periods.forEach(p => {
        this.periodsMap.set(p.timestep, p);
      });

      this.renderHorizontalStrips();
      this.renderHighRiskPeriodsGrid();
      this.updatePeriodDetails(this.currentSlice);
      this.updatePeriodComparison(this.currentSlice);

    } catch (err) {
      console.warn('[InvestigationTimeline] Failed to fetch timeline analytics:', err);
    } finally {
      this.isLoading = false;
    }
  }

  renderHorizontalStrips() {
    if (this.visualTimelineStrip) {
      this.render49Strip(this.visualTimelineStrip, false);
    }
    if (this.matrixStripEl) {
      this.render49Strip(this.matrixStripEl, true);
    }
  }

  render49Strip(container, isLarge = false) {
    if (!container) return;
    container.innerHTML = '';

    const maxTxs = Math.max(...this.periods.map(p => p.total_txs || 1), 1000);

    this.periods.forEach(p => {
      const col = document.createElement('div');
      const isSelected = (p.timestep === this.currentSlice);

      // Color classification based on real dataset metrics
      let colorClass = 'gray';
      if (p.illicit_txs >= 50 || p.network_activity_level === 'CRITICAL') {
        colorClass = 'red';
      } else if (p.illicit_txs >= 20 || p.network_activity_level === 'ELEVATED') {
        colorClass = 'amber';
      } else if (p.licit_txs > 250) {
        colorClass = 'green';
      }

      col.className = `timeline-col-node ${colorClass} ${isSelected ? 'active' : ''} ${isLarge ? 'large' : 'compact'}`;
      col.setAttribute('data-period', p.timestep);

      // Height proportional to real transaction volume
      const heightPct = Math.min(100, Math.max(16, Math.round((p.total_txs / maxTxs) * 100)));

      col.innerHTML = `
        <div class="col-bar-track">
          <div class="col-bar-fill" style="height: ${heightPct}%;"></div>
        </div>
        <span class="col-num-label mono">${p.timestep}</span>
      `;

      // Hover Tooltip Events
      col.addEventListener('mouseenter', (e) => {
        this.showTooltip(p, e.currentTarget);
      });
      col.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });

      // Click Event
      col.addEventListener('click', (e) => {
        e.preventDefault();
        this.setSlice(p.timestep);
      });

      container.appendChild(col);
    });
  }

  showTooltip(p, targetEl) {
    if (!this.tooltipEl || !p) return;

    this.tooltipEl.innerHTML = `
      <div class="tt-header">
        <strong class="mono">Period ${p.timestep} of 49</strong>
        <span class="tt-activity ${p.network_activity_level.toLowerCase()}">${p.network_activity_level}</span>
      </div>
      <div class="tt-grid">
        <div class="tt-row"><span>Transactions:</span> <strong class="mono">${(p.total_txs || 0).toLocaleString()}</strong></div>
        <div class="tt-row"><span>Illicit:</span> <strong class="mono text-threat">${(p.illicit_txs || 0).toLocaleString()}</strong></div>
        <div class="tt-row"><span>Licit:</span> <strong class="mono text-emerald">${(p.licit_txs || 0).toLocaleString()}</strong></div>
        <div class="tt-row"><span>Unknown:</span> <strong class="mono text-dim">${(p.unknown_txs || 0).toLocaleString()}</strong></div>
        <div class="tt-row"><span>Avg Risk:</span> <strong class="mono">${p.avg_risk_score || 0} / 100</strong></div>
        <div class="tt-row"><span>High-Risk Txs:</span> <strong class="mono text-threat">${p.high_risk_tx_count || 0}</strong></div>
      </div>
      ${p.hotspot_tag ? `<div class="tt-hotspot text-cyan">${p.hotspot_tag}</div>` : ''}
    `;

    const rect = targetEl.getBoundingClientRect();
    this.tooltipEl.style.left = `${Math.min(window.innerWidth - 230, Math.max(10, rect.left + (rect.width / 2) - 100))}px`;
    this.tooltipEl.style.top = `${Math.max(10, rect.top - 180)}px`;
    this.tooltipEl.classList.remove('hidden');
  }

  hideTooltip() {
    if (this.tooltipEl) {
      this.tooltipEl.classList.add('hidden');
    }
  }

  updatePeriodDetails(sliceNum) {
    const p = this.periodsMap.get(sliceNum);
    if (!p) return;

    const elPeriodNum = document.getElementById('tp-selected-period-num');
    if (elPeriodNum) elPeriodNum.textContent = `Period ${p.timestep} of 49`;

    const elTotalTxs = document.getElementById('tp-total-txs');
    if (elTotalTxs) elTotalTxs.textContent = (p.total_txs || 0).toLocaleString();

    const elIllicit = document.getElementById('tp-illicit-txs');
    if (elIllicit) elIllicit.textContent = (p.illicit_txs || 0).toLocaleString();

    const elLicit = document.getElementById('tp-licit-txs');
    if (elLicit) elLicit.textContent = (p.licit_txs || 0).toLocaleString();

    const elUnknown = document.getElementById('tp-unknown-txs');
    if (elUnknown) elUnknown.textContent = (p.unknown_txs || 0).toLocaleString();

    const elAvgRisk = document.getElementById('tp-avg-risk');
    if (elAvgRisk) elAvgRisk.textContent = `${p.avg_risk_score || 0} / 100`;

    const elActivity = document.getElementById('tp-activity-level');
    if (elActivity) {
      elActivity.textContent = p.network_activity_level;
      elActivity.className = `pm-val mono text-${p.network_activity_level === 'CRITICAL' ? 'threat' : (p.network_activity_level === 'ELEVATED' ? 'amber' : 'emerald')}`;
    }

    const elNarrativeBox = document.getElementById('tp-narrative-box');
    const elNarrativeTag = document.getElementById('tp-narrative-tag');
    const elNarrativeText = document.getElementById('tp-narrative-text');

    if (elNarrativeBox && elNarrativeTag && elNarrativeText) {
      if (p.hotspot_tag || p.hotspot_narrative) {
        elNarrativeBox.style.display = 'block';
        elNarrativeTag.textContent = p.hotspot_tag || `Period ${p.timestep} Criminal Focus`;
        elNarrativeText.textContent = p.hotspot_narrative || `Concentrated criminal activity exhibiting elevated topological risk.`;
      } else {
        elNarrativeBox.style.display = 'block';
        elNarrativeTag.textContent = `Standard Operational Window ${p.timestep}`;
        elNarrativeText.textContent = `Baseline financial transaction traffic with ${p.illicit_txs} flagged illicit transfers across ${p.edges_count} network edges.`;
      }
    }

    // Update 3D Network bottom time bar stats
    if (this.timeBarStatsEl) {
      this.timeBarStatsEl.innerHTML = `
        <span class="mono text-cyan">${(p.total_txs || 0).toLocaleString()} Txs</span>
        <span class="text-dim">·</span>
        <span class="mono text-threat">${p.illicit_txs || 0} Illicit</span>
        <span class="text-dim">·</span>
        <span class="mono">${p.avg_risk_score || 0}/100 Risk</span>
      `;
    }
  }

  updatePeriodComparison(sliceNum) {
    const curr = this.periodsMap.get(sliceNum);
    if (!curr) return;

    const prev = sliceNum > 1 ? this.periodsMap.get(sliceNum - 1) : null;
    const next = sliceNum < 49 ? this.periodsMap.get(sliceNum + 1) : null;

    // Header comparison tag
    const elCompTag = document.getElementById('tp-comparison-tag');
    if (elCompTag) {
      elCompTag.textContent = prev ? `Period ${prev.timestep} → Period ${curr.timestep}` : `Period 1 (Genesis Snapshot)`;
    }

    // Previous Column
    const elPrevId = document.getElementById('comp-prev-id');
    const elPrevTxs = document.getElementById('comp-prev-txs');
    const elPrevIll = document.getElementById('comp-prev-illicit');
    const elPrevRisk = document.getElementById('comp-prev-risk');

    if (prev) {
      if (elPrevId) elPrevId.textContent = `Period ${prev.timestep}`;
      if (elPrevTxs) elPrevTxs.textContent = (prev.total_txs || 0).toLocaleString();
      if (elPrevIll) elPrevIll.textContent = (prev.illicit_txs || 0).toLocaleString();
      if (elPrevRisk) elPrevRisk.textContent = `${prev.avg_risk_score || 0}/100`;
    } else {
      if (elPrevId) elPrevId.textContent = 'None';
      if (elPrevTxs) elPrevTxs.textContent = '—';
      if (elPrevIll) elPrevIll.textContent = '—';
      if (elPrevRisk) elPrevRisk.textContent = '—';
    }

    // Current Column
    const elCurrId = document.getElementById('comp-curr-id');
    const elCurrTxs = document.getElementById('comp-curr-txs');
    const elCurrIll = document.getElementById('comp-curr-illicit');
    const elCurrRisk = document.getElementById('comp-curr-risk');

    if (elCurrId) elCurrId.textContent = `Period ${curr.timestep}`;
    if (elCurrTxs) elCurrTxs.textContent = (curr.total_txs || 0).toLocaleString();
    if (elCurrIll) elCurrIll.textContent = (curr.illicit_txs || 0).toLocaleString();
    if (elCurrRisk) elCurrRisk.textContent = `${curr.avg_risk_score || 0}/100`;

    // Next Column
    const elNextId = document.getElementById('comp-next-id');
    const elNextTxs = document.getElementById('comp-next-txs');
    const elNextIll = document.getElementById('comp-next-illicit');
    const elNextRisk = document.getElementById('comp-next-risk');

    if (next) {
      if (elNextId) elNextId.textContent = `Period ${next.timestep}`;
      if (elNextTxs) elNextTxs.textContent = (next.total_txs || 0).toLocaleString();
      if (elNextIll) elNextIll.textContent = (next.illicit_txs || 0).toLocaleString();
      if (elNextRisk) elNextRisk.textContent = `${next.avg_risk_score || 0}/100`;
    } else {
      if (elNextId) elNextId.textContent = 'None';
      if (elNextTxs) elNextTxs.textContent = '—';
      if (elNextIll) elNextIll.textContent = '—';
      if (elNextRisk) elNextRisk.textContent = '—';
    }

    // Real Deltas (Period X-1 vs Period X)
    const elDeltaTxs = document.getElementById('tp-delta-txs');
    const elDeltaIll = document.getElementById('tp-delta-illicit');
    const elDeltaRisk = document.getElementById('tp-delta-risk');

    if (prev) {
      const diffTx = curr.total_txs - prev.total_txs;
      const pctTx = prev.total_txs ? ((diffTx / prev.total_txs) * 100).toFixed(1) : '0.0';
      const signTx = diffTx >= 0 ? '+' : '';

      const diffIll = curr.illicit_txs - prev.illicit_txs;
      const pctIll = prev.illicit_txs ? ((diffIll / prev.illicit_txs) * 100).toFixed(1) : '0.0';
      const signIll = diffIll >= 0 ? '↑' : '↓';

      const diffRisk = curr.avg_risk_score - prev.avg_risk_score;
      const signRisk = diffRisk >= 0 ? '+' : '';

      if (elDeltaTxs) {
        elDeltaTxs.textContent = `${signTx}${pctTx}% (${prev.total_txs.toLocaleString()} → ${curr.total_txs.toLocaleString()})`;
      }

      if (elDeltaIll) {
        elDeltaIll.textContent = `Period ${prev.timestep} → Period ${curr.timestep}: Illicit activity ${signIll} ${Math.abs(pctIll)}% (${diffIll >= 0 ? '+' : ''}${diffIll} txs)`;
        elDeltaIll.className = `delta-val mono ${diffIll > 0 ? 'text-threat' : (diffIll < 0 ? 'text-emerald' : 'text-dim')}`;
      }

      if (elDeltaRisk) {
        elDeltaRisk.textContent = `${signRisk}${diffRisk} pts (${prev.avg_risk_score} → ${curr.avg_risk_score}/100)`;
        elDeltaRisk.className = `delta-val mono ${diffRisk > 0 ? 'text-threat' : (diffRisk < 0 ? 'text-emerald' : 'text-dim')}`;
      }
    } else {
      if (elDeltaTxs) elDeltaTxs.textContent = 'Genesis Snapshot (Baseline)';
      if (elDeltaIll) elDeltaIll.textContent = 'Initial temporal dataset baseline established';
      if (elDeltaRisk) elDeltaRisk.textContent = `Initial baseline risk: ${curr.avg_risk_score}/100`;
    }
  }

  renderHighRiskPeriodsGrid() {
    if (!this.highRiskGridEl || this.periods.length === 0) return;

    // Rank periods by illicit count and analytical risk
    const sorted = [...this.periods].sort((a, b) => {
      if (b.illicit_txs !== a.illicit_txs) {
        return b.illicit_txs - a.illicit_txs;
      }
      return b.avg_risk_score - a.avg_risk_score;
    });

    const topPeriods = sorted.slice(0, 6);

    this.highRiskGridEl.innerHTML = topPeriods.map((p, idx) => {
      const isTop1 = idx === 0;
      return `
        <div class="high-risk-period-tile ${isTop1 ? 'priority-top' : ''}" data-period="${p.timestep}">
          <div class="hr-tile-top">
            <span class="hr-tile-rank mono">#${idx + 1} THREAT</span>
            <span class="hr-tile-num mono">Period ${p.timestep}</span>
          </div>
          <div class="hr-tile-metric-row">
            <span class="hr-tile-illicit mono text-threat font-bold">${p.illicit_txs} Illicit Txs</span>
            <span class="hr-tile-rate mono text-dim">${p.illicit_rate_pct}% Rate</span>
          </div>
          <div class="hr-tile-sub mono">
            ${(p.total_txs || 0).toLocaleString()} Total Txs • ${p.avg_risk_score}/100 Risk
          </div>
          <button class="btn-hr-tile-jump" data-period="${p.timestep}">
            <span>Inspect Period ${p.timestep}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      `;
    }).join('');

    this.highRiskGridEl.querySelectorAll('.high-risk-period-tile, .btn-hr-tile-jump').forEach(el => {
      el.addEventListener('click', (e) => {
        const period = parseInt(el.getAttribute('data-period'), 10);
        if (period) {
          this.setSlice(period);
        }
      });
    });
  }

  highlightHighRiskPeriods() {
    // Rank and highlight the top 6 periods with an animation flash
    const topTimesteps = new Set(
      [...this.periods]
        .sort((a, b) => b.illicit_txs - a.illicit_txs)
        .slice(0, 6)
        .map(p => p.timestep)
    );

    document.querySelectorAll('.timeline-col-node').forEach(col => {
      const pNum = parseInt(col.getAttribute('data-period'), 10);
      if (topTimesteps.has(pNum)) {
        col.classList.add('flash-highlight');
        setTimeout(() => col.classList.remove('flash-highlight'), 2400);
      }
    });

    // Auto-select the #1 highest illicit period if not already on it
    const top1 = [...this.periods].sort((a, b) => b.illicit_txs - a.illicit_txs)[0];
    if (top1) {
      this.setSlice(top1.timestep);
    }
  }

  setSlice(sliceNum) {
    if (sliceNum < 1) sliceNum = 1;
    if (sliceNum > 49) sliceNum = 49;
    this.currentSlice = sliceNum;

    if (this.counterEl) {
      this.counterEl.textContent = `Period ${sliceNum} of 49`;
    }
    if (this.sliceSelect) {
      this.sliceSelect.value = sliceNum;
    }

    if (this.prevBtn) this.prevBtn.disabled = (sliceNum === 1);
    if (this.nextBtn) this.nextBtn.disabled = (sliceNum === 49);

    // Update active node styling in visual strips
    document.querySelectorAll('.timeline-col-node').forEach(col => {
      const pNum = parseInt(col.getAttribute('data-period'), 10);
      col.classList.toggle('active', pNum === sliceNum);
    });

    this.updatePeriodDetails(sliceNum);
    this.updatePeriodComparison(sliceNum);

    if (this.onSliceChanged) {
      this.onSliceChanged(sliceNum);
    }
  }
}
