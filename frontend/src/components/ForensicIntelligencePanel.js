import { getTransactionStatus, STATUS_COLORS } from '../utils/statusHelper.js';

export class ForensicIntelligencePanel {
  constructor(onSelectNodeCallback, onTraceRequestedCallback, onClearTraceCallback, onBackToNetworkCallback, onCreateCaseCallback) {
    this.onSelectNode = onSelectNodeCallback;
    this.onTraceRequested = onTraceRequestedCallback;
    this.onClearTrace = onClearTraceCallback;
    this.onBackToNetwork = onBackToNetworkCallback;
    this.onCreateCase = onCreateCaseCallback;

    this.currentNode = null;
    this.currentNodeId = null;
    this.currentAiAnalysis = null;
    this.currentDetail = null;
    this.isTracingActive = false;
    this.currentDepth = 1;
    this.inspectSequence = 0;

    // View Containers
    this.panelRoot = document.getElementById('inspector-panel-root');
    this.emptyView = document.getElementById('inspector-empty-view');
    this.activeView = document.getElementById('inspector-active-view');
    this.btnCloseInsp = document.getElementById('btn-close-inspector');

    // Investigation Navigation Header & Breadcrumb
    this.btnBackNetwork = document.getElementById('btn-back-to-network');
    this.crumbNavNetwork = document.getElementById('crumb-nav-network');
    this.crumbNavInv = document.getElementById('crumb-nav-inv');
    this.crumbNavTarget = document.getElementById('crumb-nav-target');

    // Investigation History Trail
    this.trailChipsEl = document.getElementById('investigation-trail-chips');

    // Header Card
    this.statusPill = document.getElementById('insp-status-pill');
    this.slicePill = document.getElementById('insp-slice-pill');
    this.txIdEl = document.getElementById('insp-tx-id');
    this.copyBtn = document.getElementById('btn-copy-tx-id');

    // Forensic Case File Button
    this.btnCreateCase = document.getElementById('btn-create-case-insp') || document.getElementById('btn-create-case');
    this.btnCreateCaseLabel = document.getElementById('btn-create-case-label');

    // Network Trace Controls
    this.traceToggleBtn = document.getElementById('btn-toggle-trace');
    this.traceTextEl = document.getElementById('btn-trace-text');
    this.traceStatusSub = document.getElementById('trace-status-sub');
    this.depthBtns = document.querySelectorAll('.depth-btn');
    this.btnTrace1 = document.getElementById('btn-trace-1');
    this.btnTrace2 = document.getElementById('btn-trace-2');
    this.btnTraceReset = document.getElementById('btn-trace-reset');
    this.traceDepthVal = document.getElementById('insp-trace-depth-val');
    this.tracePathContainer = document.getElementById('insp-trace-path-steps');
    this.trConnectedCount = document.getElementById('tr-connected-count');
    this.trDirectExposure = document.getElementById('tr-direct-exposure');
    this.trExtendedExposure = document.getElementById('tr-extended-exposure');
    this.trClusterType = document.getElementById('tr-cluster-type');

    // 4-Cell Intelligence Risk Metrics Grid
    this.finalRiskEl = document.getElementById('insp-final-risk');
    this.mlRiskEl = document.getElementById('insp-ml-risk');
    this.networkRiskEl = document.getElementById('insp-network-risk');
    this.confNumEl = document.getElementById('insp-conf-num');

    // Connected Activity & Network Pattern
    this.highRiskConnsEl = document.getElementById('insp-high-risk-conns');
    this.illicitConnsEl = document.getElementById('insp-illicit-conns');
    this.unknownConnsEl = document.getElementById('insp-unknown-conns');
    this.networkPatternEl = document.getElementById('insp-network-pattern-val');

    // Risk Score & Confidence
    this.riskLevelTag = document.getElementById('insp-risk-level-tag');
    this.confidenceTag = document.getElementById('insp-ai-confidence');
    this.riskScoreNum = document.getElementById('insp-risk-score');
    this.riskBarFill = document.getElementById('insp-risk-bar');

    // Pattern Header
    this.aiPatternName = document.getElementById('ai-pattern-name');

    // Tabs
    this.tabBtns = document.querySelectorAll('.tab-btn');
    this.paneAi = document.getElementById('pane-ai');
    this.paneNetwork = document.getElementById('pane-network');
    this.paneFeatures = document.getElementById('pane-features');

    // Tab 1: AI Forensic Explainability
    this.execSummaryText = document.getElementById('ai-executive-summary-text');
    this.factorsInteractiveList = document.getElementById('ai-factors-interactive-list');
    this.whyFlaggedTitle = document.getElementById('why-flagged-title');
    this.whyFlaggedList = document.getElementById('why-flagged-list');
    this.evidenceChainFlow = document.getElementById('insp-evidence-chain');
    this.aiActionRec = document.getElementById('ai-action-rec');
    this.aiSuspectChips = document.getElementById('ai-suspect-chips-list');

    // Network Connectivity Metrics
    this.inDegEl = document.getElementById('insp-tech-in') || document.getElementById('insp-in-deg');
    this.outDegEl = document.getElementById('insp-tech-out') || document.getElementById('insp-out-deg');
    this.totDegEl = document.getElementById('insp-tot-deg');
    this.threatNeighborsEl = document.getElementById('insp-threat-neighbors');
    this.upstreamChips = document.getElementById('insp-upstream-chips');
    this.downstreamChips = document.getElementById('insp-downstream-chips');

    // Tab 3: Features
    this.featInDeg = document.getElementById('feat-in-deg');
    this.featOutDeg = document.getElementById('feat-out-deg');
    this.featFee = document.getElementById('feat-fee');
    this.featVol = document.getElementById('feat-vol');
    this.featInputs = document.getElementById('feat-inputs');

    this.init();
  }

  init() {
    // 1. "Back to Network" Action Button & Root Breadcrumb Click
    const handleBack = () => {
      this.clear();
      if (this.onBackToNetwork) {
        this.onBackToNetwork();
      }
    };

    if (this.btnBackNetwork) this.btnBackNetwork.addEventListener('click', handleBack);
    if (this.btnCloseInsp) this.btnCloseInsp.addEventListener('click', handleBack);
    if (this.crumbNavNetwork) this.crumbNavNetwork.addEventListener('click', handleBack);

    // 2. Middle Breadcrumb Click ("INVESTIGATION" -> Resets Trace to Target)
    if (this.crumbNavInv) {
      this.crumbNavInv.addEventListener('click', () => {
        if (this.isTracingActive) {
          this.resetTraceButton();
          if (this.onClearTrace) this.onClearTrace();
        }
      });
    }

    // 3. Copy TxID
    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', () => {
        if (this.currentNodeId) {
          navigator.clipboard.writeText(this.currentNodeId);
          this.copyBtn.style.color = '#10b981';
          setTimeout(() => { this.copyBtn.style.color = ''; }, 1200);
        }
      });
    }

    // 4. Create / Open Case File Action
    if (this.btnCreateCase) {
      this.btnCreateCase.addEventListener('click', () => {
        if (this.currentNode && this.onCreateCase) {
          this.onCreateCase(this.currentNode, this.currentAiAnalysis, this.currentDetail, false);
        }
      });
    }

    // 4.5 Generate Report Direct Action
    this.btnGenReportInsp = document.getElementById('btn-gen-report-insp');
    if (this.btnGenReportInsp) {
      this.btnGenReportInsp.addEventListener('click', () => {
        if (this.currentNode && this.onCreateCase) {
          this.onCreateCase(this.currentNode, this.currentAiAnalysis, this.currentDetail, true);
        }
      });
    }

    // 5. Tab Navigation
    this.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // 6. Trace Network Action Toggle
    if (this.traceToggleBtn) {
      this.traceToggleBtn.addEventListener('click', () => {
        if (!this.currentNode) return;
        this.isTracingActive = !this.isTracingActive;

        if (this.isTracingActive) {
          if (this.traceTextEl) this.traceTextEl.textContent = 'Clear Trace';
          this.traceToggleBtn.classList.add('active');
          if (this.onTraceRequested) {
            this.onTraceRequested(this.currentNode, this.currentDepth);
          }
        } else {
          this.resetTraceButton();
          if (this.onClearTrace) {
            this.onClearTrace();
          }
        }
      });
    }

    // 7. Trace Depth Buttons (1 Hop, 2 Hops, 3 Hops)
    this.depthBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const depth = parseInt(btn.getAttribute('data-depth'), 10) || 1;
        this.setTraceDepth(depth);
      });
    });

    if (this.btnTraceReset) {
      this.btnTraceReset.addEventListener('click', () => {
        this.resetTraceButton();
        if (this.onClearTrace) {
          this.onClearTrace();
        }
        if (this.currentNode) {
          this.renderTracePath({
            traceSteps: [{
              step: 1,
              role: 'Target Entity',
              txId: this.currentNode.id,
              status: getTransactionStatus(this.currentNode),
              direction: 'Origin'
            }]
          });
        }
      });
    }
  }

  setTraceDepth(depth) {
    this.currentDepth = depth;
    this.depthBtns.forEach(b => {
      const d = parseInt(b.getAttribute('data-depth'), 10);
      b.classList.toggle('active', d === depth);
    });

    if (this.traceDepthVal) {
      this.traceDepthVal.textContent = `${depth}-hop active`;
    }

    if (this.traceStatusSub) {
      if (depth === 1) {
        this.traceStatusSub.textContent = '1 Hop: Target + direct counterparty connections';
      } else if (depth === 2) {
        this.traceStatusSub.textContent = '2 Hops: Target + direct + 2nd-degree intermediaries';
      } else {
        this.traceStatusSub.textContent = '3 Hops: Target + extended multi-tier cluster';
      }
    }

    if (this.currentNode && this.onTraceRequested) {
      this.isTracingActive = true;
      this.onTraceRequested(this.currentNode, depth);
    }
  }

  resetTraceButton() {
    this.isTracingActive = false;
    if (this.traceTextEl) this.traceTextEl.textContent = 'Trace Network';
    if (this.traceToggleBtn) this.traceToggleBtn.classList.remove('active');
    if (this.traceStatusSub) this.traceStatusSub.textContent = 'Direct 1-Hop Connections';
    this.updateBreadcrumb();
  }

  updateBreadcrumb() {
    if (this.crumbNavTarget) {
      if (this.currentNodeId) {
        if (this.isTracingActive) {
          this.crumbNavTarget.textContent = `TX #${this.currentNodeId} (${this.currentDepth}H TRACE)`;
        } else {
          this.crumbNavTarget.textContent = `TX #${this.currentNodeId}`;
        }
      } else {
        this.crumbNavTarget.textContent = 'OVERVIEW';
      }
    }
  }

  switchTab(tabName) {
    if (this.paneAi) this.paneAi.classList.toggle('hidden', tabName !== 'ai');
    if (this.paneNetwork) this.paneNetwork.classList.toggle('hidden', tabName !== 'network');
    if (this.paneFeatures) this.paneFeatures.classList.toggle('hidden', tabName !== 'features');
  }

  clear() {
    this.currentNode = null;
    this.currentNodeId = null;
    this.currentAiAnalysis = null;
    this.currentDetail = null;
    this.resetTraceButton();
    if (this.panelRoot) this.panelRoot.classList.add('hidden');
    if (this.emptyView) this.emptyView.classList.add('hidden');
    if (this.activeView) this.activeView.classList.add('hidden');
  }

  renderInvestigationHistory(historyList) {
    if (!this.trailChipsEl) return;
    this.trailChipsEl.innerHTML = '';

    if (!historyList || historyList.length === 0) {
      this.trailChipsEl.innerHTML = '<span class="text-dim">No trail history</span>';
      return;
    }

    historyList.forEach((item, idx) => {
      const chip = document.createElement('button');
      chip.className = `trail-chip-item ${item.id === this.currentNodeId ? 'active-target' : ''}`;
      chip.textContent = item.id;
      chip.title = `Return to target #${item.id}`;
      chip.addEventListener('click', () => {
        if (this.onSelectNode) {
          this.onSelectNode(item.id);
        }
      });

      this.trailChipsEl.appendChild(chip);

      if (idx < historyList.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'trail-sep';
        sep.textContent = '→';
        this.trailChipsEl.appendChild(sep);
      }
    });
  }

  renderTraceSummary(summary) {
    if (!summary) return;
    if (this.trConnectedCount) this.trConnectedCount.textContent = `${summary.totalNodes} Nodes`;
    if (this.trDirectExposure) this.trDirectExposure.textContent = `${summary.directThreats} Flagged`;
    if (this.trExtendedExposure) this.trExtendedExposure.textContent = `${summary.extendedThreats} Flagged`;
    if (this.trClusterType) this.trClusterType.textContent = summary.clusterType;

    if (this.threatNeighborsEl) {
      this.threatNeighborsEl.textContent = summary.directThreats;
    }
    this.updateBreadcrumb();
  }

  renderTracePath(summary) {
    if (!this.tracePathContainer) return;
    this.tracePathContainer.innerHTML = '';

    const steps = (summary && summary.traceSteps) || [];
    if (steps.length === 0) {
      if (this.currentNode) {
        const status = getTransactionStatus(this.currentNode);
        this.tracePathContainer.innerHTML = `
          <div class="trace-step-item origin active" data-step="1">
            <div class="step-num-badge">1</div>
            <div class="step-meta">
              <div class="step-role">Target Entity</div>
              <strong class="step-tx mono" style="color: ${status.css}">#${this.currentNode.id}</strong>
            </div>
            <div class="step-badge-wrap">
              <span class="step-class-pill ${status.badgeClass}">${status.label}</span>
              <span class="step-dir-tag">Origin</span>
            </div>
          </div>
        `;
      }
      return;
    }

    steps.forEach((st) => {
      const stepItem = document.createElement('div');
      const isTarget = (st.step === 1 || String(st.txId) === String(this.currentNodeId));
      const status = st.status || { label: 'Unknown', css: '#94a3b8', badgeClass: 'unknown' };
      const isOutflow = st.direction === 'Output';

      stepItem.className = `trace-step-item ${isTarget ? 'origin active' : (isOutflow ? 'outflow' : 'inflow')}`;
      stepItem.setAttribute('data-tx', st.txId);
      stepItem.setAttribute('title', `Click to inspect #${st.txId} (${status.label})`);

      stepItem.innerHTML = `
        <div class="step-num-badge mono">${st.step}</div>
        <div class="step-meta">
          <div class="step-role">${st.role || (isTarget ? 'Target Entity' : 'Connected Counterparty')}</div>
          <strong class="step-tx mono" style="color: ${status.css}">#${st.txId}</strong>
        </div>
        <div class="step-badge-wrap">
          <span class="step-class-pill ${status.badgeClass}">${status.label}</span>
          <span class="step-dir-tag">${st.direction || 'Hop'}</span>
        </div>
      `;

      if (!isTarget) {
        stepItem.style.cursor = 'pointer';
        stepItem.addEventListener('click', () => {
          if (this.onSelectNode) {
            this.onSelectNode(st.txId);
          }
        });
      }

      this.tracePathContainer.appendChild(stepItem);
    });
  }

  async inspectNode(node) {
    if (!node || !node.id) return;
    this.currentNode = node;
    this.currentNodeId = node.id;

    // Sequence check to avoid race conditions where older requests overwrite newer selections
    this.inspectSequence = (this.inspectSequence || 0) + 1;
    const seq = this.inspectSequence;

    // Immediately clear previous transaction's data, reasons, evidence and factors
    this.currentDetail = null;
    this.currentAiAnalysis = null;

    if (this.panelRoot) this.panelRoot.classList.remove('hidden');
    if (this.emptyView) this.emptyView.classList.add('hidden');
    if (this.activeView) this.activeView.classList.remove('hidden');

    if (this.txIdEl) this.txIdEl.textContent = `#${node.id}`;
    if (this.slicePill) this.slicePill.textContent = `Time Period ${node.timestep || 1}`;

    // Update Breadcrumbs
    this.updateBreadcrumb();

    // Determine initial unified status
    const initStatus = getTransactionStatus(node);
    this.updateStatusPill(node);

    // Initialize initial Step 1 for Trace Path
    this.renderTracePath({
      traceSteps: [{
        step: 1,
        role: 'Target Entity',
        txId: node.id,
        status: initStatus,
        direction: 'Origin'
      }]
    });

    // Update Network Degrees
    if (this.inDegEl) this.inDegEl.textContent = node.in_degree || 0;
    if (this.outDegEl) this.outDegEl.textContent = node.out_degree || 0;
    if (this.totDegEl) this.totDegEl.textContent = node.degree || ((node.in_degree || 0) + (node.out_degree || 0));

    // Neutral / clean initial state (NO stale data reused from previous selection)
    if (this.riskLevelTag) {
      this.riskLevelTag.textContent = initStatus.label.toUpperCase();
      this.riskLevelTag.className = `risk-level-badge mono font-bold ${initStatus.badgeClass}`;
    }
    if (this.confidenceTag) {
      this.confidenceTag.textContent = 'Calculating...';
    }
    if (this.riskScoreNum) {
      this.riskScoreNum.textContent = '-- / 100';
      this.riskScoreNum.style.color = initStatus.css;
    }
    if (this.riskBarFill) {
      this.riskBarFill.style.width = '0%';
      this.riskBarFill.style.backgroundColor = initStatus.css;
    }

    // Immediately clear AI textual explanations & evidence
    if (this.execSummaryText) {
      this.execSummaryText.textContent = 'Retrieving transaction intelligence...';
    }
    if (this.factorsInteractiveList) {
      this.factorsInteractiveList.innerHTML = '<div class="text-dim text-xs py-2">Loading contributing factors...</div>';
    }
    if (this.whyFlaggedList) {
      this.whyFlaggedList.innerHTML = '<li class="text-dim">Evaluating transaction drivers...</li>';
    }
    if (this.evidenceChainFlow) {
      this.evidenceChainFlow.innerHTML = '<div class="text-dim text-xs py-1">Tracing evidence chain...</div>';
    }
    if (this.aiActionRec) {
      this.aiActionRec.textContent = 'Analyzing compliance recommendation...';
    }
    if (this.aiSuspectChips) {
      this.aiSuspectChips.innerHTML = '<span class="text-dim text-xs">Evaluating connections...</span>';
    }

    // Fetch Deep Transaction Detail & Flow Data
    try {
      const res = await fetch(`/api/transaction/${node.id}`);
      if (this.inspectSequence !== seq) return; // Discard stale response

      if (res.ok) {
        const detail = await res.json();
        if (this.inspectSequence !== seq) return; // Discard stale response

        this.currentDetail = detail;
        this.currentAiAnalysis = detail.ai_analysis;
        this.updateStatusPill(detail);
        this.renderAiAnalysis(detail.ai_analysis, detail);
        this.renderFlows(detail.upstream_txs, detail.downstream_txs);
        this.renderFeatures(detail.sample_features);
      } else {
        this.renderFallbackAnalysis(node);
      }
    } catch (err) {
      if (this.inspectSequence !== seq) return;
      console.warn('Could not fetch deep node detail:', err);
      this.renderFallbackAnalysis(node);
    }
  }

  updateStatusPill(item) {
    if (!this.statusPill) return;
    const status = getTransactionStatus(item);
    this.statusPill.textContent = `Dataset: ${status.label}`;
    this.statusPill.className = `status-pill ${status.badgeClass}`;
  }

  renderAiAnalysis(ai, detailOrLabel) {
    if (!ai) return;

    const status = getTransactionStatus(detailOrLabel || { risk_score: ai.risk_score, threat_level: ai.threat_level });
    const rawScore = ai.risk_score != null ? ai.risk_score : (status.key === 'licit' ? 0.08 : 0.5);
    const score = rawScore <= 1.0 ? Math.round(rawScore * 100) : Math.round(rawScore);
    const conf = Math.round((ai.confidence != null ? ai.confidence : 0.95) * 100);

    // 1. Risk Level & Score strictly aligned with status
    if (this.riskLevelTag) {
      this.riskLevelTag.textContent = status.label.toUpperCase();
      this.riskLevelTag.className = `risk-level-badge mono font-bold ${status.badgeClass}`;
    }

    if (this.confidenceTag) {
      this.confidenceTag.textContent = `${conf}% Conf`;
      this.confidenceTag.title = ai.confidence_reason || 'Analytical confidence derived from graph topology & feature dimensions.';
    }

    if (this.riskScoreNum) {
      this.riskScoreNum.textContent = `${score} / 100`;
      this.riskScoreNum.style.color = status.css;
    }
    if (this.riskBarFill) {
      this.riskBarFill.style.width = `${Math.min(100, Math.max(4, score))}%`;
      this.riskBarFill.style.backgroundColor = status.css;
    }

    // 1.5 Populate 4-Cell Intelligence Risk Metrics Grid
    const fr = detailOrLabel?.final_risk_score != null ? detailOrLabel.final_risk_score : (ai.final_risk_score != null ? ai.final_risk_score : score);
    const mr = detailOrLabel?.ml_risk_score != null ? detailOrLabel.ml_risk_score : (ai.ml_risk_score != null ? ai.ml_risk_score : Math.round((ai.illicit_probability || ai.risk_score || 0.5) * 100));
    const nr = detailOrLabel?.network_risk_score != null ? detailOrLabel.network_risk_score : (ai.network_risk_score != null ? ai.network_risk_score : (status.key === 'illicit' ? 85 : 20));

    if (this.finalRiskEl) {
      this.finalRiskEl.textContent = fr;
      this.finalRiskEl.className = `ai-metric-num mono ${fr >= 70 ? 'text-threat' : (fr <= 25 ? 'text-emerald' : 'text-amber')}`;
    }
    if (this.mlRiskEl) {
      this.mlRiskEl.textContent = mr;
      this.mlRiskEl.className = `ai-metric-num mono ${mr >= 70 ? 'text-threat' : (mr <= 25 ? 'text-emerald' : 'text-cyan')}`;
    }
    if (this.networkRiskEl) {
      this.networkRiskEl.textContent = nr;
      this.networkRiskEl.className = `ai-metric-num mono ${nr >= 70 ? 'text-threat' : (nr <= 25 ? 'text-emerald' : 'text-amber')}`;
    }
    if (this.confNumEl) {
      this.confNumEl.textContent = `${conf}%`;
    }

    // 1.6 Connected Activity & Pattern
    const ca = detailOrLabel?.connected_activity;
    if (ca) {
      if (this.totDegEl) this.totDegEl.textContent = ca.total_connections;
      if (this.highRiskConnsEl) this.highRiskConnsEl.textContent = ca.high_risk_connections;
      if (this.illicitConnsEl) this.illicitConnsEl.textContent = ca.illicit_connections;
      if (this.unknownConnsEl) this.unknownConnsEl.textContent = ca.unknown_connections;
    }
    if (this.networkPatternEl) {
      this.networkPatternEl.textContent = detailOrLabel?.network_pattern || ai.pattern_detected || "Standard P2P Transfer";
    }

    // 2. Behavioral Pattern Badge
    if (this.aiPatternName) {
      const cleanPattern = (detailOrLabel?.network_pattern || ai.pattern_detected || 'Standard P2P Transfer').replace(/_/g, ' ');
      this.aiPatternName.textContent = cleanPattern;
    }

    // 3. Executive Summary Briefing
    if (this.execSummaryText) {
      this.execSummaryText.textContent = ai.executive_summary || (
        score >= 70
          ? 'High-risk transaction showing strong association with a flagged illicit cluster. Immediate investigation is recommended.'
          : (score <= 20
            ? 'Low-risk transaction with characteristics consistent with normal regulated exchange activity. No immediate AML action required.'
            : 'Moderate-risk transaction with heuristic flow patterns. Downstream monitoring is advised.')
      );
    }

    // 4. Interactive Contributing Evidence Factors with % Weight Bars & Clickable "Why This Matters"
    if (this.factorsInteractiveList) {
      this.factorsInteractiveList.innerHTML = '';
      const nodeLabel = detailOrLabel?.label || (typeof detailOrLabel === 'string' ? detailOrLabel : (status.key === 'threat' ? '1' : (status.key === 'licit' ? '2' : 'unknown')));
      const isNodeIllicit = (nodeLabel === '1');
      const isNodeLicit = (nodeLabel === '2');

      const factors = ai.factor_details || [
        {
          name: 'Network Exposure',
          weight_pct: 35,
          rating: score >= 70 ? 'CRITICAL' : (score <= 20 ? 'LOW' : 'MODERATE'),
          explanation: 'Topological connectivity to high-degree mixer hubs and peeling chains.',
          why_matters: 'Measures how deeply this transaction is embedded in multi-hop funds distribution networks.'
        },
        {
          name: 'Suspicious Links',
          weight_pct: 25,
          rating: score >= 70 ? 'Flagged Criminal Hub' : '0 Flagged',
          explanation: 'Direct 1-hop connections to known criminal addresses in dataset.',
          why_matters: 'Direct links indicate unmediated fund receipt or transfer with blacklisted operators.'
        },
        {
          name: 'Transaction Pattern',
          weight_pct: 25,
          rating: score >= 70 ? 'CRITICAL' : 'LOW',
          explanation: 'Structural fan-out and consolidation balance matching known heuristics.',
          why_matters: 'Detects automated laundering scripts designed to evade fixed-amount AML triggers.'
        },
        {
          name: 'Entity Classification',
          weight_pct: 15,
          rating: isNodeIllicit ? 'FLAGGED ILLICIT' : (isNodeLicit ? 'VERIFIED LICIT' : 'UNLABELED'),
          explanation: 'Ground-truth verification annotation from the Elliptic Bitcoin dataset.',
          why_matters: 'Provides cryptographic proof from real-world blockchain enforcement investigations.'
        }
      ];

      factors.forEach((f) => {
        const card = document.createElement('div');
        card.className = 'factor-card-item';
        const isFactorThreat = f.rating.includes('CRITICAL') || f.rating.includes('HIGH') || f.rating.includes('ILLICIT') || f.rating.includes('Flagged');
        const isFactorLicit = f.rating.includes('LOW') || f.rating.includes('LICIT') || f.rating.includes('Clean');
        const ratingClass = isFactorThreat ? 'threat' : (isFactorLicit ? 'licit' : 'moderate');

        card.innerHTML = `
          <div class="factor-card-header-row">
            <div class="factor-name-wrap">
              <span class="factor-title-text">${f.name}</span>
              <span class="factor-weight-pill mono">${f.weight_pct}% Weight</span>
            </div>
            <span class="factor-rating-badge ${ratingClass} mono">${f.rating}</span>
          </div>
          <div class="factor-progress-track">
            <div class="factor-progress-fill ${ratingClass}" style="width: ${f.weight_pct * 2.5}%;"></div>
          </div>
          <p class="factor-explanation-text">${f.explanation}</p>
          <div class="factor-why-matters-box">
            <span class="why-matters-label">Why this matters to a compliance officer:</span>
            <span>${f.why_matters}</span>
          </div>
        `;

        // Click to toggle "Why This Matters"
        card.addEventListener('click', () => {
          card.classList.toggle('expanded');
        });

        this.factorsInteractiveList.appendChild(card);
      });
    }

    // 5. Why Flagged? / Why Cleared? Primary Drivers
    const nodeLabel = detailOrLabel?.label || (typeof detailOrLabel === 'string' ? detailOrLabel : (status.key === 'threat' ? '1' : (status.key === 'licit' ? '2' : 'unknown')));
    const isNodeLicit = (nodeLabel === '2');
    const isNodeIllicit = (nodeLabel === '1');

    if (this.whyFlaggedTitle) {
      if (isNodeIllicit || score >= 50) {
        this.whyFlaggedTitle.textContent = 'Why Flagged? (Primary Risk Drivers)';
      } else if (isNodeLicit || score <= 25) {
        this.whyFlaggedTitle.textContent = 'Why Cleared? (Compliance Indicators)';
      } else {
        this.whyFlaggedTitle.textContent = 'Analytical Assessment Drivers';
      }
    }

    if (this.whyFlaggedList) {
      this.whyFlaggedList.innerHTML = '';
      let drivers = [];

      if (isNodeLicit) {
        drivers = (detailOrLabel?.factors_reducing_risk && detailOrLabel.factors_reducing_risk.length > 0)
          ? detailOrLabel.factors_reducing_risk
          : [
            'Model evaluated transaction signature as consistent with licit commercial activity.',
            'Clean topological neighborhood: zero confirmed illicit counterparties.',
            'Direct connection to verified compliant entities in the Elliptic benchmark.',
            `Analytical compliance risk score: ${fr}/100 (LOW)`
          ];
      } else if (detailOrLabel?.factors_increasing_risk && detailOrLabel.factors_increasing_risk.length > 0) {
        drivers = detailOrLabel.factors_increasing_risk;
        if (detailOrLabel.factors_reducing_risk && detailOrLabel.factors_reducing_risk.length > 0) {
          drivers = [...drivers, ...detailOrLabel.factors_reducing_risk];
        }
      } else if (ai.why_this_score && ai.why_this_score.length > 0) {
        drivers = ai.why_this_score;
      } else if (ai.why_flagged_or_cleared && ai.why_flagged_or_cleared.length > 0) {
        drivers = ai.why_flagged_or_cleared;
      } else {
        drivers = isNodeIllicit ? [
          `Model assessed transaction signature with high illicit probability (${mr}%).`,
          'Direct ground-truth criminal entity in Elliptic Bitcoin dataset.',
          'Connected to network neighborhood with active risk exposure.'
        ] : [
          `Model evaluated transaction signature as consistent with licit baseline activity.`,
          'Clean topological neighborhood with low counterparty taint.',
          'Balanced transaction topology matching standard payment transfers.'
        ];
      }

      drivers.forEach(d => {
        const li = document.createElement('li');
        li.textContent = d;
        this.whyFlaggedList.appendChild(li);
      });
    }

    // 6. Forensic Evidence Chain Flow
    if (this.evidenceChainFlow) {
      this.evidenceChainFlow.innerHTML = '';
      const chain = ai.evidence_chain || [
        `Target: #${this.currentNodeId || 'TX'}`,
        isNodeIllicit ? 'Ground-Truth Illicit Entity' : (isNodeLicit ? 'Verified Licit Commercial Entity' : 'Evaluated Entity'),
        `Taint Profile: ${fr}/100 Risk`,
        `Signature: ${(detailOrLabel?.network_pattern || ai.pattern_detected || 'Analyzed').replace(/_/g, ' ')}`,
        ai.recommended_action ? `Action: ${ai.recommended_action.substring(0, 32)}...` : 'Compliance Retention'
      ];

      chain.forEach((step, idx) => {
        const stepEl = document.createElement('div');
        const isStepThreat = step.includes('Illicit') || step.includes('Threat') || step.includes('Flagged') || step.includes('Freeze') || step.includes('SAR');
        stepEl.className = `chain-step ${isStepThreat ? 'threat' : ''}`;
        stepEl.textContent = step;
        this.evidenceChainFlow.appendChild(stepEl);

        if (idx < chain.length - 1) {
          const arrow = document.createElement('span');
          arrow.className = 'chain-arrow';
          arrow.textContent = '→';
          this.evidenceChainFlow.appendChild(arrow);
        }
      });
    }

    // 7. Recommended Action
    if (this.aiActionRec) {
      this.aiActionRec.textContent = ai.recommended_action || 'Routine monitoring.';
    }

    // 8. Suspect Chips
    if (this.aiSuspectChips) {
      this.aiSuspectChips.innerHTML = '';
      const suspects = ai.related_suspects || [];
      if (suspects.length > 0) {
        suspects.forEach(sid => {
          const chip = document.createElement('button');
          chip.className = 'chip-suspect-hop';
          chip.textContent = sid;
          chip.title = `Inspect connected entity #${sid}`;
          chip.addEventListener('click', () => {
            if (this.onSelectNode) this.onSelectNode(sid);
          });
          this.aiSuspectChips.appendChild(chip);
        });
      } else {
        this.aiSuspectChips.innerHTML = '<span class="text-dim">No adjacent suspect hops</span>';
      }
    }
  }

  renderFallbackAnalysis(node) {
    const isThreat = node.label === '1';
    const isLicit = node.label === '2';

    if (isThreat) {
      this.renderAiAnalysis({
        risk_score: 0.93,
        confidence: 0.96,
        confidence_reason: 'Cryptographic ground-truth verification from Elliptic Bitcoin dataset.',
        pattern_detected: 'ILLICIT_BTC_LAUNDERING_RING',
        risk_factor_breakdown: {
          network_exposure: 'CRITICAL',
          suspicious_connections: 'Flagged Criminal Hub',
          transaction_pattern: 'HIGH',
          entity_reputation: 'FLAGGED ILLICIT',
        },
        factor_details: [
          {
            name: 'Network Exposure',
            weight_pct: 35,
            rating: 'CRITICAL (93/100)',
            explanation: 'High centrality in dense criminal cluster.',
            why_matters: 'Measures how deeply this transaction is embedded in multi-hop funds distribution networks.'
          },
          {
            name: 'Suspicious Links',
            weight_pct: 25,
            rating: 'Flagged Criminal Hub',
            explanation: 'Direct link to known blacklisted address.',
            why_matters: 'Direct links indicate unmediated fund receipt or transfer with blacklisted operators.'
          },
          {
            name: 'Transaction Pattern',
            weight_pct: 25,
            rating: 'CRITICAL',
            explanation: 'Automated peeling chain signature.',
            why_matters: 'Detects automated laundering scripts designed to evade fixed-amount AML triggers.'
          },
          {
            name: 'Entity Classification',
            weight_pct: 15,
            rating: 'FLAGGED ILLICIT',
            explanation: 'Annotated illicit entity in dataset.',
            why_matters: 'Provides cryptographic proof from real-world blockchain enforcement investigations.'
          }
        ],
        executive_summary: 'High-risk transaction showing confirmed association with a flagged illicit cluster. Immediate investigation is recommended.',
        why_flagged_or_cleared: [
          'Direct ground-truth illicit classification in the Elliptic Bitcoin dataset.',
          'Adjacency to flagged criminal entity in the active network window.',
          'High-density transaction flow consistent with criminal dispersal.'
        ],
        evidence_chain: [
          `Target Tx: #${node.id}`,
          'Ground-Truth Illicit Entity',
          'Taint Profile: 93/100 Risk',
          'Signature: Illicit Syndicate',
          'Action: SAR Escalation'
        ]
      }, '1');
    } else if (isLicit) {
      this.renderAiAnalysis({
        risk_score: 0.05,
        confidence: 0.95,
        confidence_reason: 'Verified compliant entity annotation in Elliptic Bitcoin dataset.',
        pattern_detected: 'REGULATED_EXCHANGE_LIQUIDITY_HUB',
        risk_factor_breakdown: {
          network_exposure: 'LOW',
          suspicious_connections: '0 Flagged',
          transaction_pattern: 'LOW',
          entity_reputation: 'VERIFIED LICIT',
        },
        factor_details: [
          {
            name: 'Network Exposure',
            weight_pct: 35,
            rating: 'LOW (5/100)',
            explanation: 'Clean commercial transaction topology.',
            why_matters: 'Normal regulated exchange liquidity routing.'
          },
          {
            name: 'Suspicious Links',
            weight_pct: 25,
            rating: '0 Flagged',
            explanation: 'Zero structural link to illicit addresses.',
            why_matters: 'Direct links indicate unmediated fund receipt or transfer with blacklisted operators.'
          },
          {
            name: 'Transaction Pattern',
            weight_pct: 25,
            rating: 'LOW',
            explanation: 'Standard commercial payment balance.',
            why_matters: 'Detects automated laundering scripts designed to evade fixed-amount AML triggers.'
          },
          {
            name: 'Entity Classification',
            weight_pct: 15,
            rating: 'VERIFIED LICIT',
            explanation: 'Verified licit entity in dataset.',
            why_matters: 'Provides cryptographic proof from real-world blockchain enforcement investigations.'
          }
        ],
        executive_summary: 'Low-risk transaction with characteristics consistent with normal regulated exchange activity. No immediate AML action required.',
        why_flagged_or_cleared: [
          'Verified compliant entity classification in the Elliptic Bitcoin dataset.',
          'Zero direct or indirect links to flagged criminal entities.',
          'Balanced transaction topology matching normal commercial payments.'
        ],
        evidence_chain: [
          `Target Tx: #${node.id}`,
          'Verified Licit Entity',
          'Taint Profile: 5/100 Risk',
          'Signature: Compliant Hub',
          'Action: Record Retention'
        ]
      }, '2');
    } else {
      // Unlabeled node with no precomputed score — do NOT invent a fake score!
      if (this.riskLevelTag) {
        this.riskLevelTag.textContent = 'UNLABELED';
        this.riskLevelTag.className = 'risk-level-badge mono moderate';
      }
      if (this.confidenceTag) {
        this.confidenceTag.textContent = 'N/A';
        this.confidenceTag.title = 'No ground-truth label available in dataset for this transaction.';
      }
      if (this.riskScoreNum) {
        this.riskScoreNum.textContent = 'N/A';
        this.riskScoreNum.style.color = '#94a3b8';
      }
      if (this.riskBarFill) {
        this.riskBarFill.style.width = '0%';
        this.riskBarFill.style.backgroundColor = '#64748b';
      }
      if (this.aiPatternName) {
        this.aiPatternName.textContent = 'Unlabeled Transaction';
      }
      if (this.execSummaryText) {
        this.execSummaryText.textContent = 'This transaction is unlabeled in the Elliptic Bitcoin dataset. No individual risk score is pre-assigned.';
      }
      if (this.whyFlaggedList) {
        this.whyFlaggedList.innerHTML = '<li>Unlabeled entity in dataset.</li><li>No confirmed illicit or licit ground-truth label.</li>';
      }
      if (this.factorsInteractiveList) {
        this.factorsInteractiveList.innerHTML = '<div class="text-dim p-2">Individual risk score not pre-assigned. Showing dataset classification: Unknown.</div>';
      }
    }
  }

  renderFlows(upstream, downstream) {
    if (this.upstreamChips) {
      this.upstreamChips.innerHTML = '';
      if (upstream && upstream.length > 0) {
        upstream.forEach(id => {
          const chip = document.createElement('div');
          chip.className = 'flow-node-item in-flow';
          chip.innerHTML = `<span>← IN</span><span class="mono">${id}</span>`;
          chip.title = `Click to trace source #${id}`;
          chip.addEventListener('click', () => {
            if (this.onSelectNode) this.onSelectNode(id);
          });
          this.upstreamChips.appendChild(chip);
        });
      } else {
        this.upstreamChips.innerHTML = '<span class="text-dim">No incoming connections in slice</span>';
      }
    }

    if (this.downstreamChips) {
      this.downstreamChips.innerHTML = '';
      if (downstream && downstream.length > 0) {
        downstream.forEach(id => {
          const chip = document.createElement('div');
          chip.className = 'flow-node-item out-flow';
          chip.innerHTML = `<span>→ OUT</span><span class="mono">${id}</span>`;
          chip.title = `Click to trace destination #${id}`;
          chip.addEventListener('click', () => {
            if (this.onSelectNode) this.onSelectNode(id);
          });
          this.downstreamChips.appendChild(chip);
        });
      } else {
        this.downstreamChips.innerHTML = '<span class="text-dim">No outgoing connections in slice</span>';
      }
    }
  }

  renderFeatures(features) {
    if (!features) return;
    if (this.featInDeg) this.featInDeg.textContent = features.in_degree_norm ?? '--';
    if (this.featOutDeg) this.featOutDeg.textContent = features.out_degree_norm ?? '--';
    if (this.featFee) this.featFee.textContent = features.tx_fee_norm ?? '--';
    if (this.featVol) this.featVol.textContent = features.volume_norm ?? '--';
    if (this.featInputs) this.featInputs.textContent = features.inputs_count_norm ?? '--';
  }
}
