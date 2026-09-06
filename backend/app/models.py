from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class NodeModel(BaseModel):
    id: str
    label: str  # '1' (illicit), '2' (licit), 'unknown'
    timestep: int
    degree: int = 0
    in_degree: int = 0
    out_degree: int = 0
    risk_level: str = "LOW"  # 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'
    color: str = "#8b5cf6"
    role: Optional[str] = "standard"  # 'target', 'source', 'destination', 'hub', 'mule'
    taint_score: Optional[float] = 0.0
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None

class EdgeModel(BaseModel):
    source: str
    target: str
    value: float = 1.0
    is_tainted: Optional[bool] = False
    direction: Optional[str] = "forward"

class GraphResponse(BaseModel):
    timestep: int
    total_nodes: int
    total_edges: int
    rendered_nodes: int
    rendered_edges: int
    nodes: List[NodeModel]
    links: List[EdgeModel]
    illicit_count: int
    licit_count: int
    unknown_count: int

class TimestepSummary(BaseModel):
    timestep: int
    total_txs: int
    illicit_txs: int
    licit_txs: int
    unknown_txs: int
    edges_count: int

class DatasetSummary(BaseModel):
    total_transactions: int
    illicit_transactions: int
    licit_transactions: int
    unknown_transactions: int
    total_edges: int
    total_timesteps: int
    illicit_percentage: float
    licit_percentage: float
    unknown_percentage: float

class HotspotModel(BaseModel):
    timestep: int
    title: str
    threat_count: int
    total_count: int
    description: str
    risk_level: str

class PriorityTargetModel(BaseModel):
    tx_id: str
    timestep: int
    label: str
    risk_score: int
    risk_level: str
    pattern: str
    key_factor: str

class CommandCenterIntel(BaseModel):
    summary: DatasetSummary
    timesteps: List[TimestepSummary]
    hotspots: List[HotspotModel]
    top_priority_targets: List[PriorityTargetModel]
    analytical_insights: List[str]

class FactorDetail(BaseModel):
    name: str
    weight_pct: int
    rating: str
    explanation: str
    why_matters: str

class NetworkCorrelationStatus(BaseModel):
    layer: str = "Network / P2P Transport Layer"
    is_available_in_dataset: bool = False
    status: str = "SIMULATED_PROBE_SLOT"
    official_requirement: str = "SIH Problem Statement 26146 requires correlation with IP/Port/Timing telemetry."
    dataset_limitation: str = "The benchmark Elliptic Bitcoin dataset provides on-chain DAG topology and 165 normalized mathematical features, without raw IPv4/IPv6 address headers."
    extensibility_note: str = "Probe slot is architecturally prepared to bind live Bitcoin Core node bitcoind peer p2p connection records."

class AiAnalysisResult(BaseModel):
    pattern_detected: str
    threat_level: str  # 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'
    risk_score: float  # 0.0 to 1.0 (normalized)
    illicit_probability: float  # 0.0 to 1.0 (from ML model)
    confidence: float  # 0.0 to 1.0
    confidence_reason: Optional[str] = "High structural and feature signal"
    classification_source: str = "GROUND_TRUTH_ELLIPTIC"  # 'GROUND_TRUTH_ELLIPTIC' | 'ML_INFERENCE'
    reasons: List[str]
    risk_factor_breakdown: Optional[Dict[str, str]] = None
    factor_details: Optional[List[FactorDetail]] = None
    executive_summary: Optional[str] = None
    why_flagged_or_cleared: Optional[List[str]] = None
    evidence_chain: Optional[List[str]] = None
    related_suspects: List[str] = []
    recommended_action: str
    model_version: str = "RandomForest_HistGradient_Ensemble_v2.0"
    dominant_features: Optional[List[Dict[str, Any]]] = None
    network_layer_status: Optional[NetworkCorrelationStatus] = None
    # Real ML Risk Engine extensions
    ml_risk_score: int = 50  # 0 to 100
    network_risk_score: int = 50  # 0 to 100
    final_risk_score: int = 50  # 0 to 100
    predicted_class: str = "Unknown / Insufficient Evidence"  # 'Illicit' | 'Licit' | 'Unknown / Insufficient Evidence'
    model_confidence: float = 0.95
    model_status: str = "TRAINED_GRADIENT_BOOST"
    model_name: str = "HistGradientBoostingClassifier (Graph-Augmented)"
    ground_truth_classification: str = "Unknown"
    top_contributing_features: Optional[List[Dict[str, Any]]] = None
    why_this_score: Optional[List[str]] = None
    factors_increasing_risk: Optional[List[str]] = None
    factors_reducing_risk: Optional[List[str]] = None
    network_evidence: Optional[Dict[str, Any]] = None
    explanation_factors: Optional[Dict[str, Any]] = None
    method_transparency: Optional[Dict[str, str]] = None

class TransactionDetail(BaseModel):
    tx_id: str
    timestep: int
    label: str
    risk_level: str
    in_degree: int
    out_degree: int
    total_degree: int
    features_count: int
    sample_features: Dict[str, float]
    upstream_txs: List[str]
    downstream_txs: List[str]
    ai_analysis: Optional[AiAnalysisResult] = None
    network_layer_correlation: Optional[NetworkCorrelationStatus] = None
    ml_risk_score: Optional[int] = None
    network_risk_score: Optional[int] = None
    final_risk_score: Optional[int] = None
    ground_truth_class: Optional[str] = None
    connected_activity: Optional[Dict[str, Any]] = None
    network_pattern: Optional[str] = None
    factors_increasing_risk: Optional[List[str]] = None
    factors_reducing_risk: Optional[List[str]] = None
    network_evidence: Optional[Dict[str, Any]] = None

class PredictionRequest(BaseModel):
    tx_id: Optional[str] = None
    txId: Optional[str] = None
    transaction_id: Optional[str] = None
    features: Optional[List[float]] = None

    @property
    def target_tx_id(self) -> Optional[str]:
        return self.transaction_id or self.tx_id or self.txId

class PredictionResponse(BaseModel):
    transaction_id: Optional[str] = None
    tx_id: Optional[str] = None
    ml_risk_score: int = 50
    predicted_class: str
    probability: float = 0.0
    confidence: float
    risk_score: float
    illicit_probability: float = 0.0
    feature_count: int = 172
    model_name: str = "HistGradientBoostingClassifier (Graph-Augmented)"
    model_version: str = "v2.2.0-forensic-gradient-boost"
    classification_source: str = "ML_INFERENCE"
    pattern_detected: str
    threat_level: str
    reasons: List[str]
    risk_factor_breakdown: Optional[Dict[str, str]] = None
    factor_details: Optional[List[FactorDetail]] = None
    executive_summary: Optional[str] = None
    why_flagged_or_cleared: Optional[List[str]] = None
    evidence_chain: Optional[List[str]] = None
    related_suspects: List[str]
    recommended_action: str
    explanation: Dict[str, Any]
    dominant_features: Optional[List[Dict[str, Any]]] = None
    network_layer_correlation: Optional[NetworkCorrelationStatus] = None
    # Real ML Risk Engine extensions
    network_risk_score: int = 50
    final_risk_score: int = 50
    model_confidence: float = 0.95
    model_status: str = "TRAINED_GRADIENT_BOOST"
    ground_truth_classification: str = "Unknown"
    top_contributing_features: Optional[List[Dict[str, Any]]] = None
    why_this_score: Optional[List[str]] = None
    factors_increasing_risk: Optional[List[str]] = None
    factors_reducing_risk: Optional[List[str]] = None
    network_evidence: Optional[Dict[str, Any]] = None
    explanation_factors: Optional[Dict[str, Any]] = None
    method_transparency: Optional[Dict[str, str]] = None

class DiscoveryCandidate(BaseModel):
    tx_id: str
    timestep: int
    label: str
    dataset_class: str  # 'Illicit', 'Licit', 'Unknown'
    risk_score: int  # 0 to 100
    risk_level: str  # 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'
    illicit_probability: float
    pattern: str
    in_degree: int
    out_degree: int
    total_degree: int
    candidate_reason: str
    discovery_category: str  # 'GROUND_TRUTH_ILLICIT', 'HIGH_ML_ANOMALY', 'PEELING_CHAIN', 'MIXER_FAN_OUT', 'HIGH_DEGREE_HUB'

class DiscoveryResponse(BaseModel):
    total_candidates: int
    filtered_count: int
    timestep: Optional[int] = None
    candidates: List[DiscoveryCandidate]

class TraceNode(BaseModel):
    id: str
    label: str
    timestep: int
    distance: int
    taint_score: float
    flow_direction: str  # 'TARGET', 'UPSTREAM_SOURCE', 'DOWNSTREAM_OUTPUT'
    in_degree: int = 0
    out_degree: int = 0
    risk_level: str
    color: str

class TraceLink(BaseModel):
    source: str
    target: str
    value: float = 1.0
    flow_type: str  # 'INFLOW', 'OUTFLOW'

class TraceResponse(BaseModel):
    target_tx: str
    depth: int
    total_nodes: int
    total_links: int
    nodes: List[TraceNode]
    links: List[TraceLink]
    target_node: Optional[TraceNode] = None
    upstream_count: int = 0
    downstream_count: int = 0
    max_taint: float = 1.0

class TimelinePeriodAnalytics(BaseModel):
    timestep: int
    total_txs: int
    illicit_txs: int
    licit_txs: int
    unknown_txs: int
    transaction_count: Optional[int] = None
    illicit_count: Optional[int] = None
    licit_count: Optional[int] = None
    unknown_count: Optional[int] = None
    illicit_rate_pct: float
    edges_count: int
    avg_degree: float
    avg_risk_score: int = 50
    high_risk_tx_count: int = 0
    network_activity_level: str = "NORMAL"
    is_hotspot: bool = False
    hotspot_tag: Optional[str] = None
    hotspot_narrative: Optional[str] = None

class TimelineAnalyticsResponse(BaseModel):
    total_timesteps: int
    periods: List[TimelinePeriodAnalytics]
    global_illicit_rate_pct: float
    hotspots: List[HotspotModel]

class ModelInfoResponse(BaseModel):
    model_name: str
    model_version: str = "v2.2.0-forensic-gradient-boost"
    model_family: str
    architecture: str
    dataset: str
    features_count: int
    raw_features_count: int = 165
    graph_features_count: int = 7
    training_split: str
    validation_split: Optional[str] = "Timesteps 35-39 (5,486 samples)"
    test_split: str
    accuracy: float
    precision_illicit: float
    recall_illicit: float
    f1_illicit: float
    roc_auc: float
    pr_auc: float
    class_balance: Dict[str, Any]
    feature_importance_top10: List[Dict[str, Any]]
    top_features: Optional[List[Dict[str, Any]]] = None
    validation_metrics: Optional[Dict[str, Any]] = None
    test_metrics: Optional[Dict[str, Any]] = None
    confusion_matrix: Optional[List[List[int]]] = None
    truthfulness_notice: str

class DatasetProvenanceResponse(BaseModel):
    dataset_name: str
    origin: str
    total_nodes: int
    total_edges: int
    total_timesteps: int
    features_per_node: int
    classes: Dict[str, Any]
    feature_categories: Dict[str, str]
    ground_truth_methodology: str
    network_layer_boundary: str
