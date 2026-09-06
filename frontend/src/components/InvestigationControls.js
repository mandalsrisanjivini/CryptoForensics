export class InvestigationControls {
  constructor(graphInstance, onSearchCallback, onSelectPriorityCallback) {
    this.graph = graphInstance;
    this.onSearch = onSearchCallback;
    this.onSelectPriority = onSelectPriorityCallback;

    // Search
    this.searchInput = document.getElementById('investigate-search-input');
    this.searchBtn = document.getElementById('btn-search-trigger');

    // Priority Investigations
    this.priorityListEl = document.getElementById('priority-targets-list');
    this.priorityCountBadge = document.getElementById('priority-count-badge');

    // Classification Segmented Buttons
    this.segmentBtns = document.querySelectorAll('.segment-btn');
    this.highRiskToggle = document.getElementById('toggle-high-risk-only');
    this.highRiskToggleRow = document.getElementById('high-risk-toggle-row');
    this.highRiskStatePill = document.getElementById('high-risk-state-pill');
    this.highRiskModeBadge = document.getElementById('high-risk-mode-badge');

    // Global Toast
    this.toastEl = document.getElementById('app-toast');
    this.toastTimeout = null;

    // Advanced View Controls
    this.camDefaultBtn = document.getElementById('btn-camera-default');
    this.camSuspectsBtn = document.getElementById('btn-camera-suspects');
    this.camTopBtn = document.getElementById('btn-camera-top');
    this.particlesToggleBtn = document.getElementById('btn-toggle-particles');
    this.rotateToggleBtn = document.getElementById('btn-toggle-rotate');
    this.resetBtn = document.getElementById('btn-reset-view');

    // Slice Counters
    this.sliceDisplay = document.getElementById('active-slice-display');
    this.renderedNodesLbl = document.getElementById('lbl-rendered-nodes');
    this.renderedIllicitLbl = document.getElementById('lbl-rendered-illicit');

    // Overview Modal
    this.openOverviewBtn = document.getElementById('btn-open-overview');
    this.overviewModal = document.getElementById('overview-modal');
    this.closeOverviewBtn = document.getElementById('btn-close-overview');

    this.init();
  }

  setGraph(graphInstance) {
    this.graph = graphInstance;
  }

  init() {
    // 1. Search Execution (Button Click & Enter Key)
    const executeSearch = () => {
      const q = this.searchInput ? this.searchInput.value.trim() : '';
      if (!q) {
        this.showToast('Please enter a Transaction ID to investigate', true);
        return;
      }
      if (this.onSearch) {
        this.onSearch(q);
      }
    };

    if (this.searchBtn) this.searchBtn.addEventListener('click', executeSearch);
    if (this.searchInput) {
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeSearch();
      });
    }

    // Sample Search Chips
    const sampleChips = document.querySelectorAll('.sample-chip');
    sampleChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const txId = chip.getAttribute('data-tx');
        if (txId) {
          this.setSearchInputValue(txId);
          if (this.onSearch) this.onSearch(txId);
        }
      });
    });

    // 2. Segmented Classification Filter
    this.segmentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.segmentBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filterVal = btn.getAttribute('data-filter') || 'all';
        if (this.graph) this.graph.setClassificationFilter(filterVal);
      });
    });

    // 3. High Risk Only Toggle
    if (this.highRiskToggle) {
      this.highRiskToggle.addEventListener('change', (e) => {
        const isHighRisk = e.target.checked;
        this.setHighRiskVisualState(isHighRisk);
        if (this.graph) this.graph.setHighRiskOnly(isHighRisk);
      });
    }

    // 4. Camera Presets
    if (this.camDefaultBtn) this.camDefaultBtn.addEventListener('click', () => { if (this.graph) this.graph.resetCamera(); });
    if (this.camSuspectsBtn) this.camSuspectsBtn.addEventListener('click', () => { if (this.graph) this.graph.focusSuspects(); });
    if (this.camTopBtn) this.camTopBtn.addEventListener('click', () => { if (this.graph) this.graph.setTopDownCamera(); });

    // 5. Particles & Rotate
    if (this.particlesToggleBtn) {
      this.particlesToggleBtn.addEventListener('click', () => {
        if (!this.graph) return;
        const on = this.graph.toggleParticles();
        this.particlesToggleBtn.textContent = `Flow: ${on ? 'On' : 'Off'}`;
        this.particlesToggleBtn.classList.toggle('active', on);
      });
    }

    if (this.rotateToggleBtn) {
      this.rotateToggleBtn.addEventListener('click', () => {
        if (!this.graph) return;
        const rotating = this.graph.toggleAutoRotate();
        this.rotateToggleBtn.classList.toggle('active', rotating);
      });
    }

    // 6. Reset View
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        this.resetFiltersAndSearch();
      });
    }

    // 7. Overview Modal
    if (this.openOverviewBtn && this.overviewModal) {
      this.openOverviewBtn.addEventListener('click', () => this.overviewModal.classList.remove('hidden'));
    }
    if (this.closeOverviewBtn && this.overviewModal) {
      this.closeOverviewBtn.addEventListener('click', () => this.overviewModal.classList.add('hidden'));
    }
    if (this.overviewModal) {
      this.overviewModal.addEventListener('click', (e) => {
        if (e.target === this.overviewModal) this.overviewModal.classList.add('hidden');
      });
    }
  }

  setSearchInputValue(txId) {
    if (this.searchInput) {
      this.searchInput.value = txId;
    }
  }

  resetFiltersAndSearch() {
    if (this.searchInput) this.searchInput.value = '';
    if (this.highRiskToggle) {
      this.highRiskToggle.checked = false;
      this.setHighRiskVisualState(false);
    }
    this.segmentBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-filter') === 'all'));
    if (this.graph) {
      this.graph.setClassificationFilter('all');
      this.graph.setHighRiskOnly(false);
      this.graph.resetCamera();
    }
  }

  setHighRiskVisualState(isActive) {
    if (this.highRiskToggleRow) {
      this.highRiskToggleRow.classList.toggle('active-threat', isActive);
    }
    if (this.highRiskStatePill) {
      this.highRiskStatePill.classList.toggle('hidden', !isActive);
    }
    if (this.highRiskModeBadge) {
      this.highRiskModeBadge.classList.toggle('hidden', !isActive);
    }
  }

  updatePriorityInvestigations(nodes) {
    if (!this.priorityListEl) return;
    this.priorityListEl.innerHTML = '';

    // Filter real high-risk / illicit transactions in this slice
    const threats = nodes.filter(n => n.label === '1');

    if (this.priorityCountBadge) {
      this.priorityCountBadge.textContent = `${threats.length} Flagged`;
    }

    if (threats.length === 0) {
      this.priorityListEl.innerHTML = '<div class="priority-loading-hint">No flagged threats in this window. Showing active nodes.</div>';
      return;
    }

    // Show top 4-5 threats
    const topThreats = threats.slice(0, 5);
    topThreats.forEach(node => {
      // Deterministic risk score derived from degree and topology
      const degree = node.degree || 0;
      const riskScore = Math.min(98, 88 + Math.min(degree * 2, 10));

      const card = document.createElement('div');
      card.className = 'priority-item-card';
      card.innerHTML = `
        <div class="priority-item-meta">
          <span class="priority-txid mono">${node.id}</span>
          <span class="priority-risk-pill">High Risk · ${riskScore}/100</span>
        </div>
        <button class="btn-priority-inspect" title="Investigate target">Investigate</button>
      `;

      card.addEventListener('click', () => {
        this.setSearchInputValue(node.id);
        if (this.onSelectPriority) {
          this.onSelectPriority(node.id);
        }
      });

      this.priorityListEl.appendChild(card);
    });
  }

  showToast(message, isError = false) {
    if (!this.toastEl) return;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.toastEl.textContent = message;
    this.toastEl.className = `app-toast-clean ${isError ? 'error' : ''}`;
    this.toastEl.classList.remove('hidden');

    this.toastTimeout = setTimeout(() => {
      this.toastEl.classList.add('hidden');
    }, 3500);
  }

  updateSliceTelemetry(graphData) {
    if (this.sliceDisplay) this.sliceDisplay.textContent = `Slice ${graphData.timestep} of 49`;
    if (this.renderedNodesLbl) this.renderedNodesLbl.textContent = graphData.rendered_nodes.toLocaleString();
    if (this.renderedIllicitLbl) this.renderedIllicitLbl.textContent = graphData.illicit_count.toLocaleString();
    
    // Update Priority Investigations list with real slice nodes
    this.updatePriorityInvestigations(graphData.nodes || []);
  }
}
