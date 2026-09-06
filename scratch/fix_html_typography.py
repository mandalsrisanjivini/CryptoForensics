import re

def polish_html():
    file_path = 'frontend/index.html'
    content = open(file_path, encoding='utf-8').read()

    replacements = [
        # Headings & Titles
        ('FORENSIC AML INVESTIGATION CASES', 'Forensic AML Investigation Cases'),
        ('49-PERIOD BITCOIN THREAT TIMELINE', '49-Period Bitcoin Threat Timeline'),
        ('49-PERIOD REAL ACTIVITY &amp; THREAT DENSITY', '49-Period Threat Activity & Density'),
        ('DISCOVER SUSPICIOUS ACTIVITY', 'Discover Suspicious Activity'),
        ('TRANSACTION NETWORK', '3D Transaction Network'),
        ('FORENSIC AUDIT &amp; SAR REPORTS', 'Forensic Audit & SAR Reports'),
        ('ELLIPTIC BITCOIN TRANSACTION BENCHMARK', 'Elliptic Bitcoin Transaction Benchmark'),
        ('BITCOIN FORENSIC PIPELINE &amp; TECHNOLOGY STACK', 'Bitcoin Forensic Pipeline & Technology Stack'),
        ('FRONTEND WORKSTATION', 'Frontend Workstation'),
        ('BACKEND &amp; PERSISTENCE', 'Backend & Persistence'),
        ('DATA &amp; MACHINE LEARNING', 'Data & Machine Learning Engine'),
        ('SUSPICIOUS TRANSACTIONS', 'Suspicious Transactions'),
        ('END-TO-END DATA &amp; INTELLIGENCE PIPELINE', 'End-to-End Data & Intelligence Pipeline'),
        ('ACTIVE CASE FILES', 'Active Case Files'),
        ('TOP HIGH-RISK PERIODS IN DATASET', 'Top High-Risk Periods in Dataset'),
        ('LOOKUP SPECIFIC TRANSACTION', 'Lookup Specific Transaction'),
        ('LIVE DATASET (AUTHENTIC BENCHMARK)', 'Live Dataset Benchmark'),
        ('LIVE DATASET TRIAGE', 'Live Dataset Triage'),
        ('203,769 TRANSACTIONS EVALUATED', '203,769 Transactions Evaluated'),
        ('RECOMMENDED TARGETS', 'Recommended Targets'),
        ('SEARCH BY TRANSACTION ID', 'Search by Transaction ID'),
        ('INVESTIGATION WORKFLOW', 'Investigation Workflow'),
        ('DISCOVER &amp; SELECT', 'Discover & Select'),
        ('UNDERSTAND &amp; VERIFY', 'Understand & Verify'),
        ('TRACE FUND FLOW', 'Trace Fund Flow'),
        ('EVIDENCE &amp; CASE REPORT', 'Evidence & Case Report'),
        ('SELECTED TARGET', 'Selected Target'),
        ('TARGET TRANSACTION', 'Target Transaction'),
        ('DATASET CLASSIFICATION', 'Dataset Classification'),
        ('AI RISK ASSESSMENT', 'AI Risk Assessment'),
        ('FINAL RISK', 'Final Risk'),
        ('ML RISK', 'ML Risk'),
        ('NETWORK RISK', 'Network Risk'),
        ('CONFIDENCE', 'Confidence'),
        ('WHY THIS SCORE', 'Why This Score'),
        ('TOP CONTRIBUTING MODEL FEATURES', 'Top Contributing Model Features'),
        ('PRIMARY ACTIONS', 'Primary Actions'),
        ('CASE MANAGEMENT // AUDIT EVIDENCE LOCKER', 'Case Management · Audit Evidence Locker'),
        ('REGULATORY COMPLIANCE // SAR DOCUMENTATION', 'Regulatory Compliance · SAR Documentation'),
        ('DATASET PROVENANCE // MIT-IBM BENCHMARK', 'Dataset Provenance · MIT-IBM Benchmark'),
        ('SYSTEM ARCHITECTURE // PRODUCTION PIPELINE', 'System Architecture · Production Pipeline'),
        ('TOTAL TRANSACTIONS', 'Total Transactions'),
        ('DIRECTED PAYMENT EDGES', 'Directed Payment Edges'),
        ('TIME WINDOWS', 'Time Periods'),
        ('GROUND-TRUTH ILLICIT', 'Ground-Truth Illicit'),
        ('GROUND-TRUTH LICIT', 'Ground-Truth Licit'),
        ('UNLABELED SPACE', 'Unlabeled Transactions'),
        ('PERIOD INTELLIGENCE', 'Period Intelligence'),
        ('PERIOD COMPARISON', 'Period Comparison'),
        ('TEMPORAL FORENSIC INTELLIGENCE', 'Temporal Forensic Intelligence'),
        ('CRITICAL THREATS', 'Critical Threats'),
        ('HIGH RISK ENTITIES', 'High-Risk Entities'),
        ('REVIEW CANDIDATES', 'Review Candidates'),
        ('EMERGING PATTERNS', 'Emerging Patterns'),
        ('OFFLINE ML MODEL SPECIFICATIONS', 'Offline ML Model Specifications'),

        # Remove improper mono class on non-technical UI elements
        ('class="model-badge-tag mono"', 'class="model-badge-tag"'),
        ('class="mono" id="inv-card-assessment-val"', 'id="inv-card-assessment-val"'),
        ('class="delta-val mono" id="tp-delta-txs"', 'class="delta-val" id="tp-delta-txs"'),
        ('class="delta-val mono text-threat" id="tp-delta-illicit"', 'class="delta-val text-threat" id="tp-delta-illicit"'),
        ('class="delta-val mono" id="tp-delta-risk"', 'class="delta-val" id="tp-delta-risk"'),
        ('class="pm-val mono" id="tp-activity-level"', 'class="pm-val" id="tp-activity-level"'),
    ]

    for old, new in replacements:
        content = content.replace(old, new)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("frontend/index.html polished successfully!")

if __name__ == "__main__":
    polish_html()
