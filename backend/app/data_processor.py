import csv
import json
import os
from collections import defaultdict, Counter
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

from .config import (
    CLASSES_FILE,
    EDGELIST_FILE,
    FEATURES_FILE,
    CACHE_DIR,
    SUMMARY_CACHE_FILE,
    TIMESTEPS_CACHE_FILE,
)

class DataProcessor:
    """
    Memory-efficient streaming data processor for the Elliptic Bitcoin Dataset.
    Does NOT load the entire 690MB features file into RAM.
    """

    def __init__(self):
        self.classes: Dict[str, str] = {}               # txId -> '1' | '2' | 'unknown'
        self.tx_timesteps: Dict[str, int] = {}          # txId -> timestep (1..49)
        self.timestep_txs: Dict[int, List[str]] = defaultdict(list)  # timestep -> list of txIds
        self.timestep_edges: Dict[int, List[Tuple[str, str]]] = defaultdict(list) # timestep -> list of (tx1, tx2)
        self.feature_offsets: Dict[str, int] = {}       # txId -> byte offset in features.csv for fast seek
        self.in_neighbors: Dict[str, List[str]] = defaultdict(list)   # txId -> list of upstream txIds (inputs)
        self.out_neighbors: Dict[str, List[str]] = defaultdict(list)  # txId -> list of downstream txIds (outputs)
        self.is_indexed: bool = False

    def load_classes(self) -> Dict[str, str]:
        """Loads transaction labels from classes.csv (~3.3MB)."""
        print("[DataProcessor] Loading classes from CSV...")
        classes_map = {}
        with open(CLASSES_FILE, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)  # Skip header: txId, class
            for row in reader:
                if row:
                    classes_map[row[0]] = row[1]
        self.classes = classes_map
        print(f"[DataProcessor] Loaded {len(self.classes)} class labels.")
        return self.classes

    def stream_and_index_features(self) -> None:
        """
        Streams features.csv line-by-line to record timesteps and byte offsets.
        Does NOT store feature arrays in memory.
        """
        print("[DataProcessor] Indexing features.csv via streaming (0.7GB without RAM bloat)...")
        self.tx_timesteps.clear()
        self.timestep_txs.clear()
        self.feature_offsets.clear()

        with open(FEATURES_FILE, "r", encoding="utf-8") as f:
            while True:
                offset = f.tell()
                line = f.readline()
                if not line:
                    break
                # Only parse the first two comma-separated tokens (txId, timestep)
                parts = line.split(",", 2)
                if len(parts) >= 2:
                    tx_id = parts[0]
                    try:
                        timestep = int(parts[1])
                        self.tx_timesteps[tx_id] = timestep
                        self.timestep_txs[timestep].append(tx_id)
                        self.feature_offsets[tx_id] = offset
                    except ValueError:
                        continue

        print(f"[DataProcessor] Indexed {len(self.tx_timesteps)} transactions across {len(self.timestep_txs)} timesteps.")

    def load_and_partition_edges(self) -> None:
        """
        Loads edgelist.csv (~4.5MB) and partitions edges by timestep and node adjacency.
        """
        print("[DataProcessor] Partitioning edges by timestep & building adjacency...")
        self.timestep_edges.clear()
        self.in_neighbors.clear()
        self.out_neighbors.clear()
        with open(EDGELIST_FILE, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)  # Skip header: txId1, txId2
            for row in reader:
                if len(row) >= 2:
                    tx1, tx2 = row[0], row[1]
                    # Record adjacency
                    self.out_neighbors[tx1].append(tx2)
                    self.in_neighbors[tx2].append(tx1)

                    # Lookup timestep from tx1
                    ts = self.tx_timesteps.get(tx1)
                    if ts is not None:
                        self.timestep_edges[ts].append((tx1, tx2))

        total_edges = sum(len(edges) for edges in self.timestep_edges.values())
        print(f"[DataProcessor] Partitioned {total_edges} edges across {len(self.timestep_edges)} timesteps.")

    def build_or_load_index(self, force_rebuild: bool = False) -> None:
        """Builds all lightweight indices."""
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

        if not self.classes:
            self.load_classes()

        if not self.tx_timesteps:
            self.stream_and_index_features()

        if not self.timestep_edges:
            self.load_and_partition_edges()

        self.is_indexed = True
        self._save_cache()

    def _save_cache(self) -> None:
        """Saves lightweight JSON summaries to CACHE_DIR."""
        try:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            summary = self.get_dataset_summary()
            with open(SUMMARY_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(summary, f, indent=2)

            timesteps = self.get_timesteps_summary()
            with open(TIMESTEPS_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(timesteps, f, indent=2)
            print("[DataProcessor] Cached summary statistics successfully.")
        except Exception as e:
            print(f"[DataProcessor] Warning: Could not write cache: {e}")

    def get_dataset_summary(self) -> Dict[str, Any]:
        """Calculates global metrics across the entire dataset."""
        total_txs = len(self.classes)
        class_counts = Counter(self.classes.values())
        illicit = class_counts.get("1", 0)
        licit = class_counts.get("2", 0)
        unknown = class_counts.get("unknown", 0)
        total_edges = sum(len(e) for e in self.timestep_edges.values())
        total_steps = len(self.timestep_txs) if self.timestep_txs else 49

        return {
            "total_transactions": total_txs,
            "illicit_transactions": illicit,
            "licit_transactions": licit,
            "unknown_transactions": unknown,
            "total_edges": total_edges,
            "total_timesteps": total_steps,
            "illicit_percentage": round((illicit / total_txs * 100) if total_txs else 0, 2),
            "licit_percentage": round((licit / total_txs * 100) if total_txs else 0, 2),
            "unknown_percentage": round((unknown / total_txs * 100) if total_txs else 0, 2),
        }

    def get_timesteps_summary(self) -> List[Dict[str, Any]]:
        """Generates stats per timestep (1 to 49)."""
        summary_list = []
        all_steps = sorted(self.timestep_txs.keys()) if self.timestep_txs else range(1, 50)
        for ts in all_steps:
            txs = self.timestep_txs.get(ts, [])
            c_counts = Counter(self.classes.get(tx, "unknown") for tx in txs)
            summary_list.append({
                "timestep": ts,
                "total_txs": len(txs),
                "illicit_txs": c_counts.get("1", 0),
                "licit_txs": c_counts.get("2", 0),
                "unknown_txs": c_counts.get("unknown", 0),
                "edges_count": len(self.timestep_edges.get(ts, [])),
            })
        return summary_list

    def get_transaction_features(self, tx_id: str) -> Optional[List[float]]:
        """
        Seeks directly to the transaction line in features.csv using stored byte offset.
        Reads only 1 line into RAM!
        """
        offset = self.feature_offsets.get(tx_id)
        if offset is None:
            return None

        with open(FEATURES_FILE, "r", encoding="utf-8") as f:
            f.seek(offset)
            line = f.readline()
            if not line:
                return None
            parts = line.strip().split(",")
            if len(parts) > 2:
                try:
                    return [float(x) for x in parts[2:]]
                except ValueError:
                    return None
        return None
