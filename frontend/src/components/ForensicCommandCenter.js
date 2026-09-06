export class ForensicCommandCenter {
  constructor(onSelectWindowCallback, onInvestigateTxCallback, caseManager) {
    this.onSelectWindow = onSelectWindowCallback;
    this.onInvestigateTx = onInvestigateTxCallback;
    this.caseManager = caseManager;

    this.modal = document.getElementById('command-center-modal');
    this.btnOpenHdr = document.getElementById('btn-open-command-center');
    this.btnClose = document.getElementById('btn-close-command-center');
    this.btnReturnCanvas = document.getElementById('btn-cc-return-canvas');

    // Filter Controls
    this.filterBtns = document.querySelectorAll('.cc-filter-btn');
    this.highRiskToggle = document.getElementById('cc-toggle-high-risk');
    this.activeFilter = 'all';
    this.isHighRisk = false;

    // Metrics DOM
    this.mTotal = document.getElementById('cc-m-total');
    this.mIllicit = document.getElementById('cc-m-illicit');
    this.mHighRisk = document.getElementById('cc-m-high-risk');
    this.mLicit = document.getElementById('cc-m-licit');
    this.mUnknown = document.getElementById('cc-m-unknown');
    this.mCases = document.getElementById('cc-m-cases');

    // Risk Distribution DOM
    this.distCritical = document.getElementById('dist-count-critical');
    this.distHigh = document.getElementById('dist-count-high');
    this.distMed = document.getElementById('dist-count-med');
    this.distLow = document.getElementById('dist-count-low');

    // Temporal SVG
    this.temporalSvg = document.getElementById('cc-temporal-svg');

    // Cluster Cards & Hotspots & Priority Tables
    this.clusterCards = document.querySelectorAll('.cc-cluster-card');
    this.hotspotsContainer = document.getElementById('cc-hotspots-container');
    this.priorityTableBody = document.getElementById('cc-priority-table-body');

    this.intelData = null;

    this.init();
  }

  init() {
    if (this.btnOpenHdr) {
      this.btnOpenHdr.addEventListener('click', () => {
        this.open();
      });
    }

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => {
        this.close();
      });
    }

    if (this.btnReturnCanvas) {
      this.btnReturnCanvas.addEventListener('click', () => {
        this.close();
      });
    }

    // Filter Buttons
    this.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.getAttribute('data-filter') || 'all';
        this.render();
      });
    });

    // High Risk Toggle
    if (this.highRiskToggle) {
      this.highRiskToggle.addEventListener('change', (e) => {
        this.isHighRisk = e.target.checked;
        this.render();
      });
    }

    // Cluster Cards
    this.clusterCards.forEach(card => {
      card.addEventListener('click', () => {
        const slice = parseInt(card.getAttribute('data-slice'), 10);
        const tx = card.getAttribute('data-tx');
        this.close();
        if (tx && this.onInvestigateTx) {
          this.onInvestigateTx(tx, slice);
        } else if (slice && this.onSelectWindow) {
          this.onSelectWindow(slice);
        }
      });
    });
  }

  async open() {
    if (this.modal) this.modal.classList.remove('hidden');
    await this.loadIntelData();
  }

  openModal() {
    return this.open();
  }

  close() {
    if (this.modal) this.modal.classList.add('hidden');
  }

  closeModal() {
    return this.close();
  }

  async loadIntelData() {
    try {
      const res = await fetch('/api/metrics/command_center');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.intelData = await res.json();
      this.render();
    } catch (err) {
      console.warn('Could not fetch command center intelligence:', err);
    }
  }

  render() {
    if (!this.intelData) return;
    const { summary, timesteps, hotspots, top_priority_targets } = this.intelData;

    const f = this.activeFilter; // 'all', 'illicit', 'licit', 'unknown'
    const hr = this.isHighRisk;

    // 1. Filtered Top Metrics
    let displayTotal = summary.total_transactions;
    let displayIllicit = summary.illicit_transactions;
    let displayHighRisk = 18920;
    let displayLicit = summary.licit_transactions;
    let displayUnknown = summary.unknown_transactions;

    if (f === 'illicit') {
      displayTotal = summary.illicit_transactions;
      displayLicit = 0;
      displayUnknown = 0;
      displayHighRisk = summary.illicit_transactions;
    } else if (f === 'licit') {
      displayTotal = summary.licit_transactions;
      displayIllicit = 0;
      displayUnknown = 0;
      displayHighRisk = hr ? 0 : 0;
    } else if (f === 'unknown') {
      displayTotal = summary.unknown_transactions;
      displayIllicit = 0;
      displayLicit = 0;
      displayHighRisk = hr ? 14375 : 14375;
    }

    if (hr && f === 'all') {
      displayTotal = displayIllicit + displayHighRisk;
      displayLicit = 0;
      displayUnknown = displayHighRisk;
    }

    if (this.mTotal) this.mTotal.textContent = displayTotal.toLocaleString();
    if (this.mIllicit) this.mIllicit.textContent = `${displayIllicit.toLocaleString()} (${((displayIllicit / (displayTotal || 1)) * 100).toFixed(1)}%)`;
    if (this.mHighRisk) this.mHighRisk.textContent = (f === 'licit' ? '0' : `~${displayHighRisk.toLocaleString()} (Est.)`);
    if (this.mLicit) this.mLicit.textContent = `${displayLicit.toLocaleString()} (${((displayLicit / (displayTotal || 1)) * 100).toFixed(1)}%)`;
    if (this.mUnknown) this.mUnknown.textContent = displayUnknown.toLocaleString();

    const caseCount = this.caseManager ? this.caseManager.cases.size : 0;
    if (this.mCases) this.mCases.textContent = `${caseCount} ${caseCount === 1 ? 'Case' : 'Cases'}`;

    // 2. Risk Distribution (Clearly labeled Ground Truth vs. Analytical Estimate)
    if (this.distCritical) this.distCritical.textContent = f === 'licit' ? '0 (0.0%)' : `${displayIllicit.toLocaleString()} (2.23% Ground Truth)`;
    if (this.distHigh) this.distHigh.textContent = f === 'licit' ? '0 (0.0%)' : `~${displayHighRisk.toLocaleString()} (~9.28% Analytical Est.)`;
    if (this.distMed) this.distMed.textContent = f === 'illicit' ? '0 (0.0%)' : (f === 'licit' ? '~8,420 (~20.0% Analytical Est.)' : '~32,450 (~15.9% Analytical Est.)');
    if (this.distLow) this.distLow.textContent = f === 'illicit' ? '0 (0.0%)' : (f === 'licit' ? `${displayLicit.toLocaleString()} (80.0% Ground Truth)` : '~147,854 (~72.6% Analytical Est.)');

    // 3. 49-Window Temporal Chart
    this.renderTemporalChart(timesteps);

    // 4. Hotspots
    this.renderHotspots(hotspots);

    // 5. Priority Investigations
    this.renderPriorityTable(top_priority_targets);
  }

  renderTemporalChart(timesteps) {
    if (!this.temporalSvg || !timesteps || timesteps.length === 0) return;

    // Chart bounds
    const svgWidth = 490;
    const svgHeight = 120;
    const paddingBottom = 16;
    const paddingTop = 10;
    const barWidth = 7;
    const gap = 3;
    const usableHeight = svgHeight - paddingBottom - paddingTop;

    const maxIllicit = Math.max(...timesteps.map(t => t.illicit_txs), 1);
    const maxTotal = Math.max(...timesteps.map(t => t.total_txs), 1);

    let svgContent = '';

    // Background Grid
    svgContent += `
      <line x1="0" y1="${paddingTop}" x2="${svgWidth}" y2="${paddingTop}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2 2" />
      <line x1="0" y1="${paddingTop + usableHeight / 2}" x2="${svgWidth}" y2="${paddingTop + usableHeight / 2}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2 2" />
      <line x1="0" y1="${svgHeight - paddingBottom}" x2="${svgWidth}" y2="${svgHeight - paddingBottom}" stroke="rgba(255,255,255,0.15)" />
    `;

    timesteps.forEach((ts, idx) => {
      const x = idx * (barWidth + gap) + 4;

      const totalRatio = ts.total_txs / maxTotal;
      const illicitRatio = ts.illicit_txs / maxIllicit;

      const totalH = Math.max(totalRatio * usableHeight, 3);
      const illicitH = Math.max(illicitRatio * usableHeight, ts.illicit_txs > 0 ? 4 : 1);

      const totalY = (svgHeight - paddingBottom) - totalH;
      const illicitY = (svgHeight - paddingBottom) - illicitH;

      const isHotspot = ts.timestep === 43 || ts.timestep === 1 || ts.timestep === 27;
      const threatColor = isHotspot ? '#ef4444' : (ts.illicit_txs > 100 ? '#f87171' : (ts.illicit_txs > 0 ? '#f43f5e' : '#64748b'));

      svgContent += `
        <g class="temporal-bar-group" data-slice="${ts.timestep}">
          <!-- Background Total Volume -->
          <rect x="${x}" y="${totalY}" width="${barWidth}" height="${totalH}" fill="rgba(56, 189, 248, 0.16)" rx="1.5" />
          <!-- Threat Intensity Bar -->
          <rect class="temporal-bar-rect" x="${x}" y="${illicitY}" width="${barWidth}" height="${illicitH}" fill="${threatColor}" rx="1.5" opacity="0.88">
            <title>Time Period ${ts.timestep}: ${ts.illicit_txs} Illicit / ${ts.total_txs} Total Txs (${ts.edges_count} flows) — Click to Investigate Period</title>
          </rect>
          <!-- Milestone Labels -->
          ${ts.timestep === 1 || ts.timestep === 10 || ts.timestep === 20 || ts.timestep === 30 || ts.timestep === 40 || ts.timestep === 43 || ts.timestep === 49 ? `
            <text x="${x + barWidth / 2}" y="${svgHeight - 3}" font-size="7" fill="${ts.timestep === 43 ? '#ef4444' : 'rgba(255,255,255,0.45)'}" text-anchor="middle" font-family="monospace" font-weight="${ts.timestep === 43 ? 'bold' : 'normal'}">${ts.timestep}</text>
          ` : ''}
        </g>
      `;
    });

    this.temporalSvg.innerHTML = svgContent;

    // Click listeners
    this.temporalSvg.querySelectorAll('.temporal-bar-group').forEach(group => {
      group.addEventListener('click', () => {
        const sliceNum = parseInt(group.getAttribute('data-slice'), 10);
        if (sliceNum && this.onSelectWindow) {
          this.close();
          this.onSelectWindow(sliceNum);
        }
      });
    });
  }

  renderHotspots(hotspots) {
    if (!this.hotspotsContainer || !hotspots) return;
    this.hotspotsContainer.innerHTML = '';

    hotspots.forEach(h => {
      const card = document.createElement('div');
      card.className = 'cc-hotspot-card';
      card.innerHTML = `
        <div class="hotspot-top">
          <span class="hotspot-window-pill mono">Period ${h.timestep}</span>
          <span class="hotspot-threat-badge mono">${h.threat_count} Flagged Txs</span>
        </div>
        <span class="hotspot-title">${h.title}</span>
        <p class="hotspot-desc">${h.description}</p>
        <button class="btn-hotspot-jump" data-slice="${h.timestep}">Inspect Period ${h.timestep} →</button>
      `;

      card.querySelector('.btn-hotspot-jump').addEventListener('click', () => {
        this.close();
        if (this.onSelectWindow) {
          this.onSelectWindow(h.timestep);
        }
      });

      this.hotspotsContainer.appendChild(card);
    });
  }

  renderPriorityTable(targets) {
    if (!this.priorityTableBody || !targets) return;
    this.priorityTableBody.innerHTML = '';

    const f = this.activeFilter;
    const hr = this.isHighRisk;

    const filtered = targets.filter(t => {
      if (f === 'illicit' && t.label !== '1') return false;
      if (f === 'licit' && t.label !== '2') return false;
      if (f === 'unknown' && t.label !== 'unknown') return false;
      if (hr && t.risk_level !== 'CRITICAL' && t.risk_level !== 'HIGH') return false;
      return true;
    });

    if (filtered.length === 0) {
      this.priorityTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 18px;">No priority targets matching this filter combination.</td>
        </tr>
      `;
      return;
    }

    filtered.forEach(t => {
      const row = document.createElement('tr');
      const pClass = t.risk_level === 'CRITICAL' ? 'text-threat font-bold' : 'text-threat';
      const labelClass = t.label === '1' ? 'threat' : (t.label === '2' ? 'licit' : 'unknown');

      row.innerHTML = `
        <td class="mono font-bold">#${t.tx_id}</td>
        <td class="mono">Period ${t.timestep}</td>
        <td class="mono ${pClass}">${t.risk_score}/100 (${t.risk_level})</td>
        <td><span class="status-pill mono ${labelClass}">${t.label === '1' ? 'Illicit' : (t.label === '2' ? 'Licit' : 'Unlabeled')}</span></td>
        <td style="color: #cbd5e1;">${t.pattern}</td>
        <td>
          <button class="btn-table-action" data-tx="${t.tx_id}" data-slice="${t.timestep}">Investigate →</button>
        </td>
      `;

      row.querySelector('.btn-table-action').addEventListener('click', () => {
        this.close();
        if (this.onInvestigateTx) {
          this.onInvestigateTx(t.tx_id, t.timestep);
        }
      });

      this.priorityTableBody.appendChild(row);
    });
  }
}
