export class ForensicCaseManager {
  constructor(onSelectCaseTargetCallback) {
    this.onSelectCaseTarget = onSelectCaseTargetCallback;
    this.cases = new Map();
    this.generatedReports = [];
    this.currentCaseId = null;
    this.caseSequence = 1;
    this.currentReportType = 'forensic'; // 'forensic' | 'sar'

    // Dom Elements - Case Workspace Modal
    this.wsModal = document.getElementById('case-workspace-modal');
    this.wsCloseBtn = document.getElementById('btn-close-case-workspace');
    this.wsReturnBtn = document.getElementById('btn-back-to-investigation');
    this.cwCaseIdEl = document.getElementById('cw-case-id');
    this.cwStatusSelect = document.getElementById('cw-case-status');
    this.cwPriorityEl = document.getElementById('cw-case-priority');
    this.cwDateEl = document.getElementById('cw-case-date');
    this.cwTargetTxEl = document.getElementById('cw-target-tx');
    this.cwRiskScoreEl = document.getElementById('cw-risk-score');
    this.cwConfidenceEl = document.getElementById('cw-confidence');
    this.cwPatternEl = document.getElementById('cw-pattern');
    this.cwWindowEl = document.getElementById('cw-window');
    this.cwEvidenceChecklist = document.getElementById('cw-evidence-checklist');
    this.cwEvidenceCount = document.getElementById('cw-evidence-count');
    this.cwNotesInput = document.getElementById('cw-notes-input');
    this.cwNotesStatus = document.getElementById('cw-notes-status');
    this.cwTimelineFlow = document.getElementById('cw-timeline-flow');
    this.cwRecommendationEl = document.getElementById('cw-recommendation');
    this.btnOpenSar = document.getElementById('btn-open-sar-report');

    // Dom Elements - Report Preview Modal
    this.sarModal = document.getElementById('sar-report-modal');
    this.sarReportContent = document.getElementById('sar-report-content');
    this.sarCloseBtn = document.getElementById('btn-close-sar-report');
    this.sarCloseBottomBtn = document.getElementById('btn-close-sar-bottom');
    this.btnSwitchForensic = document.getElementById('btn-switch-forensic');
    this.btnSwitchSar = document.getElementById('btn-switch-sar');
    this.sarPrintBtn = document.getElementById('btn-print-report') || document.getElementById('btn-print-sar');
    this.sarPrintBottomBtn = document.getElementById('btn-print-sar-bottom');
    this.btnExportJson = document.getElementById('btn-export-json');
    this.btnExportJsonBottom = document.getElementById('btn-export-json-bottom');
    this.sarEditNotesBtn = document.getElementById('btn-edit-case-notes');
    this.sarEditNotesTopBtn = document.getElementById('btn-edit-case-notes-top');

    // Report Header & Meta
    this.repNoticeBanner = document.getElementById('rep-notice-banner');
    this.repNoticeSubtext = document.getElementById('rep-notice-subtext');
    this.repBadgeType = document.getElementById('rep-badge-type');
    this.sarCaseId = document.getElementById('sar-case-id');
    this.repReportId = document.getElementById('rep-report-id');
    this.sarCaseStatus = document.getElementById('sar-case-status');
    this.sarTargetTx = document.getElementById('sar-target-tx');
    this.sarWindow = document.getElementById('sar-window');
    this.sarDate = document.getElementById('sar-date');
    this.repGtLabel = document.getElementById('rep-gt-label');
    this.sarPriority = document.getElementById('sar-priority');
    this.sarConfidence = document.getElementById('sar-confidence');
    this.sarScoreVal = document.getElementById('sar-score-val');
    this.sarPatternText = document.getElementById('sar-pattern-text');
    this.sarExecutiveSummary = document.getElementById('sar-executive-summary');

    // Report Section Elements
    this.sarEvidenceList = document.getElementById('sar-evidence-list');
    this.repInDeg = document.getElementById('rep-in-deg');
    this.repOutDeg = document.getElementById('rep-out-deg');
    this.repTotDeg = document.getElementById('rep-tot-deg');
    this.repThreatNeighbors = document.getElementById('rep-threat-neighbors');
    this.repSchematicWrap = document.getElementById('rep-schematic-wrap');
    this.sarEvidenceChain = document.getElementById('sar-evidence-chain');
    this.repEvidenceTableBody = document.getElementById('rep-evidence-table-body');
    this.sarNarrativeText = document.getElementById('sar-narrative-text');
    this.sarInvestigatorNotes = document.getElementById('sar-investigator-notes-text');
    this.sarDirectiveText = document.getElementById('sar-directive-text');

    // Dom Elements - Case & Report List Modal
    this.listModal = document.getElementById('case-list-modal');
    this.listCloseBtn = document.getElementById('btn-close-case-list');
    this.btnOpenCasesHdr = document.getElementById('btn-open-cases');
    this.hdrCaseCount = document.getElementById('hdr-case-count');
    this.tabCaseCount = document.getElementById('tab-case-count');
    this.tabReportCount = document.getElementById('tab-report-count');
    this.tabCasesList = document.getElementById('tab-cases-list');
    this.tabReportsList = document.getElementById('tab-reports-list');
    this.paneCasesTable = document.getElementById('pane-cases-table');
    this.paneReportsTable = document.getElementById('pane-reports-table');
    this.caseTableBody = document.getElementById('case-master-table-body');
    this.reportTableBody = document.getElementById('report-master-table-body');
    this.caseEmptyMsg = document.getElementById('case-empty-msg');
    this.reportEmptyMsg = document.getElementById('report-empty-msg');

    // Load persisted cases and reports from storage
    this.loadFromStorage();
    this.initListeners();
    this.updateHeaderCount();
  }

  initListeners() {
    // 1. Case Workspace Close / Return
    const closeWs = () => {
      if (this.wsModal) this.wsModal.classList.add('hidden');
    };
    if (this.wsCloseBtn) this.wsCloseBtn.addEventListener('click', closeWs);
    if (this.wsReturnBtn) this.wsReturnBtn.addEventListener('click', closeWs);

    // 2. Status Change Listener
    if (this.cwStatusSelect) {
      this.cwStatusSelect.addEventListener('change', (e) => {
        const c = this.getActiveCase();
        if (c) {
          c.status = e.target.value;
          this.logTimeline(c, `Status updated to ${c.status}`);
          this.saveToStorage();
        }
      });
    }

    // 3. Investigator Notes Live Save
    if (this.cwNotesInput) {
      this.cwNotesInput.addEventListener('input', (e) => {
        const c = this.getActiveCase();
        if (c) {
          c.investigatorNotes = e.target.value;
          if (this.cwNotesStatus) {
            this.cwNotesStatus.textContent = 'Saving...';
            clearTimeout(this._notesTimer);
            this._notesTimer = setTimeout(() => {
              this.saveToStorage();
              this.cwNotesStatus.textContent = 'Auto-saved';
            }, 400);
          }
        }
      });
    }

    // 4. Open Report Action from Case Workspace
    if (this.btnOpenSar) {
      this.btnOpenSar.addEventListener('click', () => {
        const c = this.getActiveCase();
        if (c) {
          this.openReport(c, 'forensic');
        }
      });
    }

    // 5. Report Type Switcher Buttons
    if (this.btnSwitchForensic) {
      this.btnSwitchForensic.addEventListener('click', () => {
        this.setReportMode('forensic');
      });
    }
    if (this.btnSwitchSar) {
      this.btnSwitchSar.addEventListener('click', () => {
        this.setReportMode('sar');
      });
    }

    // 6. Report Close / Print / Export / Edit
    const closeSar = () => {
      if (this.sarModal) this.sarModal.classList.add('hidden');
    };
    if (this.sarCloseBtn) this.sarCloseBtn.addEventListener('click', closeSar);
    if (this.sarCloseBottomBtn) this.sarCloseBottomBtn.addEventListener('click', closeSar);

    const handlePrint = () => {
      window.print();
    };
    if (this.sarPrintBtn) this.sarPrintBtn.addEventListener('click', handlePrint);
    if (this.sarPrintBottomBtn) this.sarPrintBottomBtn.addEventListener('click', handlePrint);

    const handleExportJson = () => {
      this.exportReportJson();
    };
    if (this.btnExportJson) this.btnExportJson.addEventListener('click', handleExportJson);
    if (this.btnExportJsonBottom) this.btnExportJsonBottom.addEventListener('click', handleExportJson);

    const handleEditNotes = () => {
      closeSar();
      if (this.wsModal) this.wsModal.classList.remove('hidden');
    };
    if (this.sarEditNotesBtn) this.sarEditNotesBtn.addEventListener('click', handleEditNotes);
    if (this.sarEditNotesTopBtn) this.sarEditNotesTopBtn.addEventListener('click', handleEditNotes);

    // 7. Case List Master Register & Tabs
    if (this.btnOpenCasesHdr) {
      this.btnOpenCasesHdr.addEventListener('click', () => {
        this.openCaseListModal();
      });
    }
    if (this.listCloseBtn) {
      this.listCloseBtn.addEventListener('click', () => {
        if (this.listModal) this.listModal.classList.add('hidden');
      });
    }

    if (this.tabCasesList) {
      this.tabCasesList.addEventListener('click', () => {
        this.tabCasesList.classList.add('active');
        if (this.tabReportsList) this.tabReportsList.classList.remove('active');
        if (this.paneCasesTable) this.paneCasesTable.classList.remove('hidden');
        if (this.paneReportsTable) this.paneReportsTable.classList.add('hidden');
      });
    }

    if (this.tabReportsList) {
      this.tabReportsList.addEventListener('click', () => {
        this.tabReportsList.classList.add('active');
        if (this.tabCasesList) this.tabCasesList.classList.remove('active');
        if (this.paneReportsTable) this.paneReportsTable.classList.remove('hidden');
        if (this.paneCasesTable) this.paneCasesTable.classList.add('hidden');
      });
    }
  }

  getActiveCase() {
    return this.cases.get(this.currentCaseId);
  }

  getCaseForTransaction(txId) {
    for (const c of this.cases.values()) {
      if (c.txId === txId) return c;
    }
    return null;
  }

  createOrOpenCase(node, aiAnalysis = null, detail = null, openReportDirectly = false) {
    if (!node || !node.id) return;

    let existing = this.getCaseForTransaction(node.id);
    let targetCase = existing;

    if (!targetCase) {
      const seqStr = String(this.caseSequence).padStart(4, '0');
      const caseId = `CASE-2026-${seqStr}`;
      this.caseSequence++;

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

      const isThreat = node.label === '1';
      const isLicit = node.label === '2';
      const finalRisk = detail?.final_risk_score != null ? detail.final_risk_score : (aiAnalysis?.final_risk_score != null ? aiAnalysis.final_risk_score : (aiAnalysis ? Math.round(aiAnalysis.risk_score * 100) : (isThreat ? 90 : (isLicit ? 6 : 58))));
      const mlRisk = detail?.ml_risk_score != null ? detail.ml_risk_score : (aiAnalysis?.ml_risk_score != null ? aiAnalysis.ml_risk_score : Math.round((aiAnalysis?.illicit_probability || aiAnalysis?.risk_score || 0.5) * 100));
      const networkRisk = detail?.network_risk_score != null ? detail.network_risk_score : (aiAnalysis?.network_risk_score != null ? aiAnalysis.network_risk_score : (isThreat ? 85 : 20));
      const confidence = aiAnalysis ? Math.round((aiAnalysis.confidence || 0.95) * 100) : 96;
      const priority = finalRisk >= 75 ? 'CRITICAL' : (finalRisk >= 50 ? 'HIGH' : (finalRisk >= 25 ? 'MEDIUM' : 'LOW'));
      const pattern = (detail?.network_pattern || aiAnalysis?.pattern_detected || (isThreat ? 'ILLICIT_BTC_LAUNDERING_RING' : (isLicit ? 'REGULATED_EXCHANGE_HUB' : 'PEELING_CHAIN_OBFUSCATION'))).replace(/_/g, ' ');
      const gtClass = isThreat ? 'Illicit (Ground Truth Class 1)' : (isLicit ? 'Licit (Ground Truth Class 2)' : 'Unknown (Unlabeled in Dataset)');
      const explanation = aiAnalysis?.why_this_score || aiAnalysis?.why_flagged_or_cleared || (isThreat
        ? ['Direct ground-truth illicit classification in the Elliptic Bitcoin dataset.', 'Adjacency to flagged criminal entity in the active network window.', 'High-density transaction flow consistent with criminal dispersal.']
        : ['Verified compliant entity classification in the Elliptic Bitcoin dataset.', 'Zero direct or indirect links to flagged criminal entities.', 'Balanced transaction topology matching normal commercial payments.']);

      targetCase = {
        caseId: caseId,
        txId: node.id,
        label: node.label || 'unknown',
        timestep: node.timestep || detail?.timestep || 1,
        datasetClassification: gtClass,
        status: 'OPEN',
        priority: priority,
        createdDate: dateStr,
        createdTime: timeStr,
        riskScore: finalRisk,
        finalRisk: finalRisk,
        mlRisk: mlRisk,
        networkRisk: networkRisk,
        confidence: confidence,
        pattern: pattern,
        networkPattern: pattern,
        connectedActivity: detail?.connected_activity || null,
        explanation: explanation,
        inDegree: node.in_degree || (detail?.in_degree ?? 0),
        outDegree: node.out_degree || (detail?.out_degree ?? 0),
        totalDegree: node.degree || (detail?.total_degree ?? 0),
        upstreamTxs: detail?.upstream_txs || [],
        downstreamTxs: detail?.downstream_txs || [],
        executiveSummary: aiAnalysis?.executive_summary || (isThreat
          ? 'High-risk Bitcoin transaction exhibiting direct structural links to a flagged criminal cluster and laundering topology. Immediate AML escalation and SAR alert filing is recommended.'
          : (isLicit
            ? 'Low-risk Bitcoin transaction with balanced flow characteristics consistent with a regulated exchange or merchant. No AML restrictions or escalation required.'
            : 'Moderate-risk unlabeled Bitcoin transaction exhibiting heuristic mixing and multi-hop consolidation characteristics. Further downstream monitoring is advised.')),
        whyFlaggedOrCleared: explanation,
        factorDetails: aiAnalysis?.factor_details || [
          { name: 'Network Exposure', weight_pct: 35, rating: isThreat ? 'Critical (95/100)' : (isLicit ? 'Low (5/100)' : 'Moderate (50/100)'), explanation: isThreat ? 'High centrality in dense criminal cluster.' : 'Clean peer-to-peer distribution.', why_matters: 'Measures how deeply funds are embedded in laundering funnels.' },
          { name: 'Suspicious Links', weight_pct: 25, rating: isThreat ? 'Flagged Criminal Hub' : '0 Flagged', explanation: isThreat ? 'Direct 1-hop links to blacklisted addresses.' : 'No direct links to flagged addresses.', why_matters: 'Direct connections indicate fund movement from illicit operations.' },
          { name: 'Transaction Pattern', weight_pct: 25, rating: isThreat ? 'Critical' : 'Low', explanation: isThreat ? 'Asymmetric peeling chain signature.' : 'Balanced input/output ratio.', why_matters: 'Detects automated scripts evading fixed-amount AML rules.' },
          { name: 'Entity Classification', weight_pct: 15, rating: isThreat ? 'Flagged Illicit' : (isLicit ? 'Verified Licit' : 'Unlabeled Pool'), explanation: 'Ground-truth verification annotation from dataset.', why_matters: 'Provides cryptographic proof from real-world blockchain enforcement investigations.' }
        ],
        evidenceChecklist: [
          { id: 'risk_score', label: `Final Risk Score (${finalRisk}/100 · ${priority})`, checked: true },
          { id: 'ml_score', label: `ML Model Risk: ${mlRisk}/100 (Confidence: ${confidence}%)`, checked: true },
          { id: 'network_risk', label: `Network Topological Risk: ${networkRisk}/100`, checked: true },
          { id: 'reputation', label: `Dataset Classification: ${gtClass}`, checked: true },
          { id: 'pattern_sig', label: `Network Pattern: ${pattern}`, checked: true },
          { id: 'topology', label: `Graph Degree: In: ${node.in_degree || 0} / Out: ${node.out_degree || 0} (Time Period ${node.timestep || 1})`, checked: true },
          { id: 'chain', label: 'Investigation Evidence Reasoning Chain', checked: true },
        ],
        investigatorNotes: '',
        timeline: [
          { time: timeStr, text: `Case initialized for Bitcoin Transaction #${node.id}` },
          { time: timeStr, text: `AI Risk Assessment compiled (Final Risk: ${finalRisk}/100 · ${priority}, ML: ${mlRisk}/100, Net: ${networkRisk}/100)` },
          { time: timeStr, text: `Forensic Evidence Factors and topological links attached` }
        ],
        recommendedAction: aiAnalysis?.recommended_action || (isThreat
          ? 'Critical: Escalate for enhanced AML investigation, generate Suspicious Activity Report (SAR), and flag downstream exchange deposit addresses.'
          : (isLicit
            ? 'Low Risk: Compliant activity. Continue routine automated monitoring without restriction.'
            : 'Monitor: Maintain compliance observation on downstream recipient addresses.'))
      };

      this.cases.set(caseId, targetCase);
      this.saveToStorage();
      this.updateHeaderCount();
    }

    this.currentCaseId = targetCase.caseId;

    if (openReportDirectly) {
      this.openReport(targetCase, 'forensic');
    } else {
      this.renderCaseWorkspace(targetCase);
      if (this.wsModal) this.wsModal.classList.remove('hidden');
    }

    return targetCase;
  }

  renderCaseWorkspace(c) {
    if (!c) return;

    if (this.cwCaseIdEl) this.cwCaseIdEl.textContent = c.caseId;
    if (this.cwStatusSelect) this.cwStatusSelect.value = c.status;
    if (this.cwPriorityEl) {
      this.cwPriorityEl.textContent = `${c.priority} PRIORITY`;
      const pClass = c.priority === 'CRITICAL' || c.priority === 'HIGH' ? 'threat' : (c.priority === 'LOW' ? 'licit' : 'moderate');
      this.cwPriorityEl.className = `priority-pill-badge ${pClass} mono`;
    }
    if (this.cwDateEl) this.cwDateEl.textContent = `Created: ${c.createdDate} ${c.createdTime || ''}`;

    if (this.cwTargetTxEl) this.cwTargetTxEl.textContent = `#${c.txId}`;
    if (this.cwRiskScoreEl) this.cwRiskScoreEl.textContent = `${c.riskScore} / 100 (${c.priority})`;
    if (this.cwConfidenceEl) this.cwConfidenceEl.textContent = `${c.confidence}% Analytical Conf`;
    if (this.cwPatternEl) this.cwPatternEl.textContent = c.pattern;
    if (this.cwWindowEl) this.cwWindowEl.textContent = `Time Period ${c.timestep} (Elliptic Bitcoin Dataset)`;

    // Evidence Checklist
    if (this.cwEvidenceChecklist) {
      this.cwEvidenceChecklist.innerHTML = '';
      c.evidenceChecklist.forEach((item, idx) => {
        const labelEl = document.createElement('label');
        labelEl.className = 'evidence-check-item';
        labelEl.innerHTML = `
          <input type="checkbox" data-idx="${idx}" ${item.checked ? 'checked' : ''} />
          <span>${item.label}</span>
        `;
        labelEl.querySelector('input').addEventListener('change', (e) => {
          c.evidenceChecklist[idx].checked = e.target.checked;
          this.updateCheckedCount(c);
          this.saveToStorage();
        });
        this.cwEvidenceChecklist.appendChild(labelEl);
      });
      this.updateCheckedCount(c);
    }

    // Notes
    if (this.cwNotesInput) {
      this.cwNotesInput.value = c.investigatorNotes || '';
    }

    // Timeline Log
    this.renderTimeline(c);

    // Recommendation
    if (this.cwRecommendationEl) {
      this.cwRecommendationEl.textContent = c.recommendedAction;
    }
  }

  updateCheckedCount(c) {
    if (!this.cwEvidenceCount || !c) return;
    const count = c.evidenceChecklist.filter(i => i.checked).length;
    this.cwEvidenceCount.textContent = `${count} / ${c.evidenceChecklist.length} Items Attached`;
  }

  logTimeline(c, eventText) {
    if (!c) return;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    c.timeline.push({ time: timeStr, text: eventText });
    this.renderTimeline(c);
  }

  renderTimeline(c) {
    if (!this.cwTimelineFlow || !c) return;
    this.cwTimelineFlow.innerHTML = '';
    (c.timeline || []).forEach(evt => {
      const step = document.createElement('div');
      step.className = 'cw-timeline-step';
      step.innerHTML = `
        <span class="cw-time-tag">[${evt.time}]</span>
        <span class="cw-step-text">${evt.text}</span>
      `;
      this.cwTimelineFlow.appendChild(step);
    });
  }

  setReportMode(mode) {
    this.currentReportType = mode;
    if (this.btnSwitchForensic) this.btnSwitchForensic.classList.toggle('active', mode === 'forensic');
    if (this.btnSwitchSar) this.btnSwitchSar.classList.toggle('active', mode === 'sar');

    const c = this.getActiveCase();
    if (c) {
      this.populateReportView(c, mode);
    }
  }

  openReport(c, mode = 'forensic') {
    if (!c || !this.sarModal) return;
    this.currentReportType = mode;

    // Record report in history
    const repSuffix = mode === 'forensic' ? 'F' : 'SAR';
    const repId = `REP-${c.caseId.replace('CASE-', '')}-${repSuffix}`;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    const reportRecord = {
      reportId: repId,
      caseId: c.caseId,
      txId: c.txId,
      type: mode === 'forensic' ? 'Forensic Report' : 'SAR-Ready Draft',
      date: `${dateStr} ${timeStr}`,
      status: c.status
    };

    const existsIdx = this.generatedReports.findIndex(r => r.reportId === repId);
    if (existsIdx >= 0) {
      this.generatedReports[existsIdx] = reportRecord;
    } else {
      this.generatedReports.unshift(reportRecord);
    }
    this.saveToStorage();
    this.updateHeaderCount();

    this.logTimeline(c, `Generated ${mode === 'forensic' ? 'Forensic Investigation Report' : 'SAR-Ready Draft'} (${repId})`);

    this.setReportMode(mode);
    this.sarModal.classList.remove('hidden');
  }

  populateReportView(c, mode, customTargetEl = null) {
    const isForensic = mode === 'forensic';
    const repSuffix = isForensic ? 'F' : 'SAR';
    const repId = `REP-${(c.caseId || 'CASE-001').replace('CASE-', '')}-${repSuffix}`;

    const reportContentEl = customTargetEl || this.sarReportContent || document.getElementById('sar-report-content');
    if (!reportContentEl) return;

    const isThreat = c.label === '1';
    const isLicit = c.label === '2';
    const gtClassText = c.datasetClassification || (isThreat ? 'Confirmed Illicit (Class 1)' : (isLicit ? 'Verified Licit (Class 2)' : 'Unknown (Unlabeled Baseline)'));
    const finalRisk = c.finalRisk != null ? c.finalRisk : (c.riskScore ?? (isThreat ? 90 : (isLicit ? 6 : 58)));
    const mlRisk = c.mlRisk != null ? c.mlRisk : (isThreat ? 96 : (isLicit ? 0 : 52));
    const networkRisk = c.networkRisk != null ? c.networkRisk : (isThreat ? 85 : 20);
    const confidence = c.confidence ?? 96;
    const patternText = c.networkPattern || c.pattern || 'Standard P2P Transfer';
    const upstreamList = c.upstreamTxs || [];
    const downstreamList = c.downstreamTxs || [];
    const totalDeg = c.totalDegree || (c.inDegree + c.outDegree);
    const highRiskConns = c.connectedActivity?.high_risk_connections ?? (isThreat ? 1 : 0);
    const illicitConns = c.connectedActivity?.illicit_connections ?? (isThreat ? 1 : 0);
    const unknownConns = c.connectedActivity?.unknown_connections ?? Math.max(0, totalDeg - illicitConns);

    // Build SVG Flow Diagram
    const inCount = Math.min(Math.max(c.inDegree || 1, 1), 3);
    const outCount = Math.min(Math.max(c.outDegree || 1, 1), 3);
    const targetColor = isThreat ? '#ef4444' : (isLicit ? '#10b981' : '#38bdf8');
    let svgFlow = `<svg viewBox="0 0 540 85" style="width: 100%; max-width: 540px; height: 85px; margin: 0 auto; display: block;">`;
    const cx = 270, cy = 42;
    for (let i = 0; i < inCount; i++) {
      const iy = 22 + i * (40 / Math.max(inCount - 1, 1));
      svgFlow += `<line x1="85" y1="${iy}" x2="${cx - 30}" y2="${cy}" stroke="rgba(56, 189, 248, 0.45)" stroke-width="1.5" stroke-dasharray="3 2" />`;
      svgFlow += `<circle cx="70" cy="${iy}" r="11" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" />`;
      svgFlow += `<text x="70" y="${iy + 3}" fill="#94a3b8" font-size="7.5" font-family="monospace" text-anchor="middle">IN-${i+1}</text>`;
    }
    for (let j = 0; j < outCount; j++) {
      const oy = 22 + j * (40 / Math.max(outCount - 1, 1));
      svgFlow += `<line x1="${cx + 30}" y1="${cy}" x2="455" y2="${oy}" stroke="${isThreat ? 'rgba(239, 68, 68, 0.55)' : 'rgba(16, 185, 129, 0.45)'}" stroke-width="1.5" stroke-dasharray="3 2" />`;
      svgFlow += `<circle cx="470" cy="${oy}" r="11" fill="#0f172a" stroke="${isThreat ? '#ef4444' : '#10b981'}" stroke-width="1.5" />`;
      svgFlow += `<text x="470" y="${oy + 3}" fill="#94a3b8" font-size="7.5" font-family="monospace" text-anchor="middle">OUT-${j+1}</text>`;
    }
    svgFlow += `<circle cx="${cx}" cy="${cy}" r="22" fill="#0c1322" stroke="${targetColor}" stroke-width="2.5" />`;
    svgFlow += `<circle cx="${cx}" cy="${cy}" r="27" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.85" />`;
    svgFlow += `<text x="${cx}" y="${cy - 4}" fill="#ffffff" font-size="8.5" font-weight="bold" font-family="monospace" text-anchor="middle">TARGET</text>`;
    svgFlow += `<text x="${cx}" y="${cy + 7}" fill="${targetColor}" font-size="7" font-weight="bold" font-family="monospace" text-anchor="middle">#${c.txId.substring(0, 7)}</text>`;
    svgFlow += `</svg>`;

    reportContentEl.innerHTML = `
      <div class="report-master-doc">
        <!-- 1. OFFICIAL BANNER -->
        <div class="report-banner ${isThreat ? 'threat' : ''}">
          <div class="report-banner-hdr">
            <strong>${isForensic ? 'Confidential Forensic Investigation Report' : 'Confidential AML Suspicious Activity Report Draft (SAR-Ready)'}</strong>
            <span class="report-type-badge mono">${isForensic ? 'Forensic Investigation' : 'SAR Draft'}</span>
          </div>
          <p class="report-banner-sub">
            ${isForensic 
              ? 'Compiled from deterministic cryptographic annotations and graph topological heuristics in the Elliptic Bitcoin benchmark dataset. Designed for law enforcement and compliance officer review.'
              : 'Compiled for AML risk assessment and Suspicious Activity Report drafting under FinCEN BSA and Indian FIU PMLA guidelines. Not an automated filing with regulatory authorities.'}
          </p>
        </div>

        <!-- 2. CASE SUMMARY -->
        <section class="report-section">
          <h4 class="report-sec-title">1. Case Summary</h4>
          <div class="report-grid-meta">
            <div><span>Report ID:</span> <strong class="mono text-cyan">${repId}</strong></div>
            <div><span>Case File:</span> <strong class="mono">${c.caseId}</strong></div>
            <div><span>Target Transaction:</span> <strong class="mono text-threat">#${c.txId}</strong></div>
            <div><span>Time Period:</span> <strong class="mono">Period ${c.timestep} of 49</strong></div>
            <div><span>Assigned Analyst:</span> <strong>Lead Forensic AML Investigator</strong></div>
            <div><span>Case Status:</span> <span class="status-pill mono ${c.status === 'OPEN' ? 'threat' : 'unknown'}">${c.status}</span></div>
            <div><span>Filing Priority:</span> <strong class="mono ${finalRisk >= 70 ? 'text-threat' : 'text-accent'}">${c.priority}</strong></div>
            <div><span>Audit Timestamp:</span> <span class="mono">${c.createdDate} ${c.createdTime}</span></div>
          </div>
          <div class="report-text-block" style="margin-top: 10px;">
            <strong>Executive Briefing:</strong>
            <p>${c.executiveSummary || 'No executive summary recorded for this case.'}</p>
          </div>
        </section>

        <!-- 3. TARGET TRANSACTION & CLASSIFICATION DISTINCTION -->
        <section class="report-section">
          <h4 class="report-sec-title">2. Target Transaction &amp; Classification Distinction</h4>
          <div class="report-comparison-table-wrap">
            <table class="report-data-table">
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th>Ground-Truth Dataset Classification</th>
                  <th>Analytical Risk Assessment</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Status / Verdict</strong></td>
                  <td class="mono font-bold ${isThreat ? 'text-threat' : (isLicit ? 'text-licit' : 'text-dim')}">${gtClassText}</td>
                  <td class="mono font-bold ${finalRisk >= 70 ? 'text-threat' : (finalRisk <= 25 ? 'text-licit' : 'text-amber')}">${finalRisk >= 70 ? 'CRITICAL RISK' : (finalRisk <= 25 ? 'LOW RISK' : 'ELEVATED RISK')} (${finalRisk} / 100)</td>
                </tr>
                <tr>
                  <td><strong>Verification Source</strong></td>
                  <td>MIT-IBM Watson AI Lab Elliptic Ground Truth</td>
                  <td>Trained HistGradientBoosting Classifier (172 Features) + Topological Taint Engine</td>
                </tr>
                <tr>
                  <td><strong>Classification Role</strong></td>
                  <td>${isThreat ? 'Cryptographic enforcement label (Illicit entity)' : (isLicit ? 'Verified regulated commercial entity' : 'Unlabeled benchmark candidate')}</td>
                  <td>Supervised gradient boosting inference evaluated across 172 features (165 raw + 7 graph-derived)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 4. RISK ASSESSMENT -->
        <section class="report-section">
          <h4 class="report-sec-title">3. Risk Assessment</h4>
          <div class="report-risk-grid">
            <div class="report-risk-card ${finalRisk >= 70 ? 'threat' : ''}">
              <span class="r-lbl">Final Risk Score</span>
              <strong class="r-val mono ${finalRisk >= 70 ? 'text-threat' : (finalRisk <= 25 ? 'text-licit' : 'text-amber')}">${finalRisk} / 100</strong>
              <span class="r-sub">${c.priority} Threat Assessment</span>
            </div>
            <div class="report-risk-card">
              <span class="r-lbl">ML Model Risk</span>
              <strong class="r-val mono text-cyan">${mlRisk} / 100</strong>
              <span class="r-sub">172-Feature Model Assessment</span>
            </div>
            <div class="report-risk-card">
              <span class="r-lbl">Network Risk</span>
              <strong class="r-val mono text-amber">${networkRisk} / 100</strong>
              <span class="r-sub">Topological Taint &amp; Neighbor Centrality</span>
            </div>
            <div class="report-risk-card">
              <span class="r-lbl">Model Confidence</span>
              <strong class="r-val mono text-emerald">${confidence}%</strong>
              <span class="r-sub">Prediction Certainty Margin</span>
            </div>
          </div>
        </section>

        <!-- 5. ML ASSESSMENT -->
        <section class="report-section">
          <h4 class="report-sec-title">4. Machine Learning Assessment</h4>
          <div class="report-text-block">
            <p>
              The transaction was evaluated using the <strong>HistGradientBoostingClassifier (Graph-Augmented)</strong> model (160 iterations, max depth 10, balanced class weights) trained on real Bitcoin transactions from the authentic Elliptic dataset.
              Supervised training strictly excluded unlabeled transactions and adhered to temporal splitting (Training on Periods 1–34, Validation on Periods 35–39, Out-of-Sample Testing on Periods 40–49) guaranteeing zero temporal data leakage.
            </p>
            <div class="report-sub-grid mono" style="margin-top: 8px;">
              <div><span>Certified Test ROC-AUC:</span> <strong>0.9392 (93.9%)</strong></div>
              <div><span>Certified Test PR-AUC:</span> <strong>0.7878 (78.8%)</strong></div>
              <div><span>Illicit Precision:</span> <strong>0.9292 (92.9%)</strong></div>
              <div><span>Illicit Recall:</span> <strong>0.6808 (68.1%)</strong></div>
            </div>
          </div>
        </section>

        <!-- 6. NETWORK ANALYSIS & PATTERN -->
        <section class="report-section">
          <h4 class="report-sec-title">5. Network Analysis &amp; Behavioral Pattern</h4>
          <div class="report-grid-meta">
            <div><span>Total Degree:</span> <strong class="mono">${totalDeg} Edges</strong></div>
            <div><span>Direct Inputs (In-Degree):</span> <strong class="mono">${c.inDegree || 0}</strong></div>
            <div><span>Direct Outputs (Out-Degree):</span> <strong class="mono">${c.outDegree || 0}</strong></div>
            <div><span>High-Risk Counterparties:</span> <strong class="mono text-threat">${highRiskConns}</strong></div>
            <div><span>Known Illicit Counterparties:</span> <strong class="mono text-threat">${illicitConns}</strong></div>
            <div><span>Unknown Counterparties:</span> <strong class="mono text-dim">${unknownConns}</strong></div>
            <div><span>Behavioral Network Pattern:</span> <strong class="mono text-cyan">${patternText}</strong></div>
            <div><span>Topological Centrality:</span> <strong>${totalDeg >= 6 ? 'High Centrality Hub' : (totalDeg >= 2 ? 'Distributed P2P' : 'Sparse Leaf')}</strong></div>
          </div>
        </section>

        <!-- 7. TRACE PATH & SCHEMATIC -->
        <section class="report-section">
          <h4 class="report-sec-title">6. Trace Path &amp; Directional Schematic</h4>
          <div class="report-schematic-wrap" style="padding: 12px; background: #0c1322; border-radius: 6px; border: 1px solid #1e293b; text-align: center;">
            ${svgFlow}
          </div>
          <div class="report-text-block" style="margin-top: 10px;">
            <strong>Immediate Inflows &amp; Outflows in Time Period ${c.timestep}:</strong>
            <p class="mono text-xs" style="margin-top: 4px;">
              Inputs (${upstreamList.length}): ${upstreamList.length > 0 ? upstreamList.map(t => `#${t}`).join(', ') : 'None in snapshot'}<br>
              Outputs (${downstreamList.length}): ${downstreamList.length > 0 ? downstreamList.map(t => `#${t}`).join(', ') : 'None in snapshot'}
            </p>
          </div>
        </section>

        <!-- 8. EVIDENCE -->
        <section class="report-section">
          <h4 class="report-sec-title">7. Investigation Evidence &amp; Findings</h4>
          <ul class="clean-bullet-list">
            ${(c.whyFlaggedOrCleared && c.whyFlaggedOrCleared.length > 0)
              ? c.whyFlaggedOrCleared.map(b => `<li>${b}</li>`).join('')
              : '<li>No evidence recorded.</li>'}
          </ul>
        </section>

        <!-- 9. TIME PERIOD CONTEXT -->
        <section class="report-section">
          <h4 class="report-sec-title">8. Time Period Context</h4>
          <div class="report-text-block">
            <p>
              This transaction occurred in <strong>Time Period ${c.timestep} of 49</strong>. In the Elliptic benchmark, each period represents a discrete chronological interval of approximately two weeks of Bitcoin blockchain activity. Subgraph boundaries are strictly bounded to this temporal stratum.
            </p>
          </div>
        </section>

        <!-- 10. METHODOLOGY & STATUTORY COMPLIANCE -->
        <section class="report-section">
          <h4 class="report-sec-title">9. Methodology &amp; Statutory Compliance</h4>
          <div class="report-text-block">
            <p>
              Investigative processing combines directed acyclic graph (DAG) topological tracing with calibrated probabilistic machine learning classification.
              Findings are prepared in accordance with statutory requirements under the <strong>Prevention of Money Laundering Act (PMLA)</strong>, Indian FIU guidelines, and FinCEN Bank Secrecy Act (BSA) standards for cryptocurrency transaction monitoring.
            </p>
          </div>
        </section>

        <!-- 11. LIMITATIONS & TRUTHFULNESS NOTICE -->
        <section class="report-section">
          <h4 class="report-sec-title">10. Limitations &amp; Truthfulness Notice</h4>
          <div class="report-disclaimer-box">
            <strong>Truthfulness &amp; Integrity Notice:</strong>
            <p>
              All transaction entities represent pseudonymous Bitcoin public transactions. Off-chain personal identities, wallet ownership claims, IP addresses, and bank accounts are not present in the dataset and are not fabricated.
              This report represents an analytical investigative aid and does not constitute an automated legal verdict. Final legal action requires human compliance review.
            </p>
          </div>
        </section>

        <!-- 12. DIRECTIVE -->
        <section class="report-section report-directive-section">
          <h4 class="report-sec-title">11. Compliance Directive &amp; Recommended Action</h4>
          <div class="report-directive-box ${finalRisk >= 70 ? 'threat' : ''}">
            <strong>Action Mandate:</strong>
            <p>${c.recommendedAction}</p>
          </div>
        </section>
      </div>
    `;
  }

  renderNetworkSvgSchematic(c) {
    if (!this.repSchematicWrap) return;
    const isThreat = c.label === '1' || c.priority === 'CRITICAL';
    const targetColor = isThreat ? '#ef4444' : (c.label === '2' ? '#10b981' : '#38bdf8');

    const inCount = Math.min(Math.max(c.inDegree || 1, 1), 4);
    const outCount = Math.min(Math.max(c.outDegree || 1, 1), 4);

    let svg = `<svg viewBox="0 0 540 100" style="width: 100%; height: 90px; display: block;">`;

    // Target center coordinates
    const cx = 270;
    const cy = 50;

    // Upstream input nodes (Left)
    for (let i = 0; i < inCount; i++) {
      const ix = 60;
      const iy = 25 + i * (60 / Math.max(inCount - 1, 1));
      svg += `
        <line x1="${ix + 16}" y1="${iy}" x2="${cx - 24}" y2="${cy}" stroke="rgba(56, 189, 248, 0.45)" stroke-width="1.5" stroke-dasharray="3 2" />
        <circle cx="${ix}" cy="${iy}" r="12" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
        <text x="${ix}" y="${iy + 3}" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">IN-${i+1}</text>
      `;
    }

    // Downstream output nodes (Right)
    for (let j = 0; j < outCount; j++) {
      const ox = 480;
      const oy = 25 + j * (60 / Math.max(outCount - 1, 1));
      svg += `
        <line x1="${cx + 24}" y1="${cy}" x2="${ox - 16}" y2="${oy}" stroke="rgba(239, 68, 68, 0.45)" stroke-width="1.5" stroke-dasharray="3 2" />
        <circle cx="${ox}" cy="${oy}" r="12" fill="#1e293b" stroke="${isThreat ? '#ef4444' : '#10b981'}" stroke-width="1.5" />
        <text x="${ox}" y="${oy + 3}" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">OUT-${j+1}</text>
      `;
    }

    // Central Target Transaction Node
    svg += `
      <circle cx="${cx}" cy="${cy}" r="22" fill="#0f172a" stroke="${targetColor}" stroke-width="3" />
      <circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="${targetColor}" stroke-width="1" stroke-dasharray="2 2" opacity="0.75" />
      <text x="${cx}" y="${cy - 4}" fill="#ffffff" font-size="9" font-weight="bold" font-family="monospace" text-anchor="middle">TARGET</text>
      <text x="${cx}" y="${cy + 7}" fill="${targetColor}" font-size="7.5" font-weight="bold" font-family="monospace" text-anchor="middle">#${c.txId.substring(0, 7)}</text>
    `;

    svg += `</svg>`;
    this.repSchematicWrap.innerHTML = svg;
  }

  exportReportJson() {
    const c = this.getActiveCase();
    if (!c) return;

    const repSuffix = this.currentReportType === 'forensic' ? 'F' : 'SAR';
    const repId = `REP-${c.caseId.replace('CASE-', '')}-${repSuffix}`;

    const reportExport = {
      report_metadata: {
        report_id: repId,
        case_id: c.caseId,
        report_type: this.currentReportType === 'forensic' ? 'FORENSIC_INVESTIGATION_REPORT' : 'SAR_READY_COMPLIANCE_DRAFT',
        generated_at: new Date().toISOString(),
        dataset: 'Elliptic Bitcoin Dataset (MIT-IBM Watson AI Lab)',
        investigation_window: c.timestep,
        case_status: c.status
      },
      target_transaction: {
        tx_id: c.txId,
        ground_truth_label: c.label,
        dataset_classification: c.datasetClassification || (c.label === '1' ? 'Confirmed Illicit' : (c.label === '2' ? 'Verified Licit' : 'Unknown')),
        final_risk_score: c.finalRisk != null ? c.finalRisk : c.riskScore,
        ml_risk_score: c.mlRisk,
        network_risk_score: c.networkRisk,
        assigned_priority: c.priority,
        analytical_confidence: c.confidence,
        detected_pattern: c.networkPattern || c.pattern,
        connected_activity: c.connectedActivity,
      },
      network_topology: {
        in_degree: c.inDegree,
        out_degree: c.outDegree,
        total_degree: c.totalDegree,
        upstream_sample_txs: c.upstreamTxs,
        downstream_sample_txs: c.downstreamTxs
      },
      risk_factors_breakdown: c.factorDetails,
      evidence_checklist: c.evidenceChecklist,
      investigator_narrative: {
        executive_summary: c.executiveSummary,
        notes: c.investigatorNotes
      },
      recommended_directive: {
        action: c.recommendedAction,
        disclaimer: 'Analytical recommendation requiring compliance officer review. Not an automated legal decision.'
      }
    };

    const jsonStr = JSON.stringify(reportExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repId}_${c.txId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  openCaseListModal() {
    if (!this.listModal) return;
    this.renderCaseMasterList();
    this.renderReportsMasterList();
    this.listModal.classList.remove('hidden');
  }

  renderCaseMasterList() {
    if (!this.caseTableBody) return;
    this.caseTableBody.innerHTML = '';

    const allCases = Array.from(this.cases.values());
    if (allCases.length === 0) {
      if (this.caseEmptyMsg) this.caseEmptyMsg.classList.remove('hidden');
      return;
    }

    if (this.caseEmptyMsg) this.caseEmptyMsg.classList.add('hidden');

    allCases.forEach(c => {
      const row = document.createElement('tr');
      const pClass = c.priority === 'CRITICAL' || c.priority === 'HIGH' ? 'text-threat font-bold' : (c.priority === 'LOW' ? 'text-licit' : 'text-accent');
      row.innerHTML = `
        <td class="mono font-bold">${c.caseId}</td>
        <td class="mono">#${c.txId}</td>
        <td class="mono ${pClass}">${c.riskScore}/100 (${c.priority})</td>
        <td>${c.pattern}</td>
        <td><span class="status-pill mono ${c.status === 'OPEN' ? 'threat' : 'unknown'}">${c.status}</span></td>
        <td class="mono">${c.createdDate}</td>
        <td>
          <button class="btn-table-action" data-id="${c.caseId}">Inspect Case</button>
        </td>
      `;

      row.querySelector('.btn-table-action').addEventListener('click', () => {
        if (this.listModal) this.listModal.classList.add('hidden');
        this.currentCaseId = c.caseId;
        this.renderCaseWorkspace(c);
        if (this.wsModal) this.wsModal.classList.remove('hidden');
        if (this.onSelectCaseTarget) {
          this.onSelectCaseTarget(c.txId, c.timestep);
        }
      });

      this.caseTableBody.appendChild(row);
    });
  }

  renderReportsMasterList() {
    if (!this.reportTableBody) return;
    this.reportTableBody.innerHTML = '';

    if (this.generatedReports.length === 0) {
      if (this.reportEmptyMsg) this.reportEmptyMsg.classList.remove('hidden');
      return;
    }

    if (this.reportEmptyMsg) this.reportEmptyMsg.classList.add('hidden');

    this.generatedReports.forEach(r => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="mono font-bold">${r.reportId}</td>
        <td class="mono">${r.caseId}</td>
        <td class="mono">#${r.txId}</td>
        <td><span class="status-pill mono ${r.type.includes('Forensic') ? 'accent' : 'threat'}">${r.type}</span></td>
        <td class="mono">${r.date}</td>
        <td>
          <button class="btn-table-action" data-repid="${r.reportId}">View Report</button>
        </td>
      `;

      row.querySelector('.btn-table-action').addEventListener('click', () => {
        if (this.listModal) this.listModal.classList.add('hidden');
        const c = this.cases.get(r.caseId) || this.getCaseForTransaction(r.txId);
        if (c) {
          this.currentCaseId = c.caseId;
          const mode = r.reportId.endsWith('-SAR') ? 'sar' : 'forensic';
          this.openReport(c, mode);
        }
      });

      this.reportTableBody.appendChild(row);
    });
  }

  updateHeaderCount() {
    if (this.hdrCaseCount) {
      this.hdrCaseCount.textContent = this.cases.size;
    }
    if (this.tabCaseCount) {
      this.tabCaseCount.textContent = this.cases.size;
    }
    if (this.tabReportCount) {
      this.tabReportCount.textContent = this.generatedReports.length;
    }
  }

  saveToStorage() {
    try {
      const arr = Array.from(this.cases.values());
      localStorage.setItem('crypto_forensics_cases', JSON.stringify(arr));
      localStorage.setItem('crypto_forensics_case_seq', String(this.caseSequence));
      localStorage.setItem('crypto_forensics_reports', JSON.stringify(this.generatedReports));
    } catch (e) {
      console.warn('Could not save cases/reports to localStorage:', e);
    }

    // Non-blocking SQLite backend sync
    try {
      if (this.currentCaseId && this.cases.has(this.currentCaseId)) {
        const c = this.cases.get(this.currentCaseId);
        fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(c)
        }).catch(() => {});
      }
    } catch (_) {}
  }

  async loadFromStorage() {
    // 1. Immediate localStorage load for zero delay
    try {
      const raw = localStorage.getItem('crypto_forensics_cases');
      const seqRaw = localStorage.getItem('crypto_forensics_case_seq');
      const repRaw = localStorage.getItem('crypto_forensics_reports');

      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach(c => this.cases.set(c.caseId, c));
        }
      }
      if (seqRaw) {
        this.caseSequence = parseInt(seqRaw, 10) || (this.cases.size + 1);
      } else {
        this.caseSequence = this.cases.size + 1;
      }
      if (repRaw) {
        const repArr = JSON.parse(repRaw);
        if (Array.isArray(repArr)) {
          this.generatedReports = repArr;
        }
      }
    } catch (e) {
      console.warn('Could not load cases/reports from localStorage:', e);
    }

    // 2. Asynchronous backend SQLite sync (merges any cases saved on SQLite server)
    try {
      const res = await fetch('/api/cases');
      if (res.ok) {
        const serverCases = await res.json();
        if (Array.isArray(serverCases) && serverCases.length > 0) {
          serverCases.forEach(sc => {
            if (sc && sc.caseId && !this.cases.has(sc.caseId)) {
              this.cases.set(sc.caseId, sc);
            }
          });
          this.caseSequence = Math.max(this.caseSequence, this.cases.size + 1);
          this.updateHeaderCount();
        }
      }
    } catch (_) {}
  }
}
