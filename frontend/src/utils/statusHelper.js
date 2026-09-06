/**
 * UNIFIED FORENSIC STATUS & RISK MAPPING (SIH 26146)
 * Single source of truth for transaction colors, forensic statuses, and visual hierarchy.
 *
 * Rules:
 * - Verified Illicit (Ground Truth Class 1) = Crimson (#ef4444 / 0xef4444)
 * - High Risk (AI Predicted / High Taint) = Orange (#f97316 / 0xf97316)
 * - Moderate / Review = Amber (#f59e0b / 0xf59e0b)
 * - Verified Licit (Ground Truth Class 2) = Emerald (#10b981 / 0x10b981)
 * - Unlabeled / Baseline = Slate (#64748b / 0x64748b)
 * - Active Target / Selection = Cyan (#38bdf8 / 0x38bdf8)
 */

export const STATUS_COLORS = {
  illicit: { hex: 0xef4444, css: '#ef4444', label: 'Verified Illicit', badgeClass: 'threat' },
  high: { hex: 0xf97316, css: '#f97316', label: 'High Risk (AI Flagged)', badgeClass: 'high' },
  review: { hex: 0xf59e0b, css: '#f59e0b', label: 'Moderate Risk', badgeClass: 'review' },
  licit: { hex: 0x10b981, css: '#10b981', label: 'Verified Licit', badgeClass: 'licit' },
  unknown: { hex: 0x64748b, css: '#64748b', label: 'Unlabeled Baseline', badgeClass: 'unknown' },
  selected: { hex: 0x38bdf8, css: '#38bdf8', label: 'Selected Target', badgeClass: 'selected' }
};

export function getTransactionStatus(item) {
  if (!item) return { key: 'unknown', isGroundTruth: false, groundTruthText: 'Unlabeled', ...STATUS_COLORS.unknown };

  const rawLabel = String(item.label || item.dataset_class || '').trim().toLowerCase();
  const rawRisk = item.risk_score != null 
    ? (item.risk_score <= 1.0 ? Math.round(item.risk_score * 100) : Math.round(item.risk_score)) 
    : (item.illicit_probability != null ? Math.round(item.illicit_probability * 100) : null);
  const level = String(item.threat_level || item.risk_level || '').trim().toUpperCase();

  // 1. Ground Truth Illicit (Class 1)
  if (rawLabel === '1' || rawLabel === 'illicit') {
    return {
      key: 'illicit',
      isGroundTruth: true,
      groundTruthText: 'Verified Illicit (Class 1)',
      ...STATUS_COLORS.illicit
    };
  }

  // 2. Ground Truth Licit (Class 2)
  if (rawLabel === '2' || rawLabel === 'licit') {
    return {
      key: 'licit',
      isGroundTruth: true,
      groundTruthText: 'Verified Licit (Class 2)',
      ...STATUS_COLORS.licit
    };
  }

  // 3. Unlabeled Nodes (Evaluated via Real ML Model & Topological Taint)
  if (level === 'CRITICAL' || level === 'HIGH' || (rawRisk != null && rawRisk >= 65)) {
    return {
      key: 'high',
      isGroundTruth: false,
      groundTruthText: 'Unlabeled Node (ML Predicted High Risk)',
      ...STATUS_COLORS.high
    };
  }

  if (level === 'MEDIUM' || level === 'MODERATE' || level === 'ELEVATED' || level === 'REVIEW' || (rawRisk != null && rawRisk >= 35)) {
    return {
      key: 'review',
      isGroundTruth: false,
      groundTruthText: 'Unlabeled Node (ML Moderate Anomaly)',
      ...STATUS_COLORS.review
    };
  }

  return {
    key: 'unknown',
    isGroundTruth: false,
    groundTruthText: 'Unlabeled Node (Normal Baseline)',
    ...STATUS_COLORS.unknown
  };
}

export function getNodeBaseRadius(statusKey) {
  switch (statusKey) {
    case 'illicit': return 2.6;
    case 'high': return 2.3;
    case 'review': return 2.0;
    case 'licit': return 1.9;
    case 'unknown':
    default: return 1.5;
  }
}
