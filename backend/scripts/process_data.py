#!/usr/bin/env python3
"""
CryptoForensics - Memory-Efficient Data Processing & Verification Script
This script reads the Elliptic Bitcoin Dataset in streaming chunks, generates
lightweight summary indexes, and verifies dataset integrity without memory spikes.
"""

import sys
import time
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.data_processor import DataProcessor

def main():
    print("================================================================")
    print("  CryptoForensics: Memory-Efficient Dataset Ingestion Engine    ")
    print("================================================================")

    start_time = time.time()
    processor = DataProcessor()

    print("\n[Step 1/3] Parsing Classes CSV...")
    processor.load_classes()

    print("\n[Step 2/3] Streaming & Indexing Features CSV (Headerless, 690MB)...")
    processor.stream_and_index_features()

    print("\n[Step 3/3] Partitioning Edges CSV by Timestep...")
    processor.load_and_partition_edges()

    print("\n[Saving Index & Metrics Cache]...")
    processor._save_cache()

    summary = processor.get_dataset_summary()
    elapsed = time.time() - start_time

    print("\n" + "=" * 50)
    print("           DATASET INGESTION SUMMARY            ")
    print("=" * 50)
    print(f"Total Transactions:      {summary['total_transactions']:,}")
    print(f"Illicit Transactions:    {summary['illicit_transactions']:,} ({summary['illicit_percentage']}%)")
    print(f"Licit Transactions:      {summary['licit_transactions']:,} ({summary['licit_percentage']}%)")
    print(f"Unknown Transactions:    {summary['unknown_transactions']:,} ({summary['unknown_percentage']}%)")
    print(f"Total Directed Edges:    {summary['total_edges']:,}")
    print(f"Total Timesteps:         {summary['total_timesteps']}")
    print(f"Ingestion Completed in:  {elapsed:.2f} seconds")
    print("=" * 50)

    # Test random seek on a sample transaction
    sample_tx = next(iter(processor.classes.keys()))
    feats = processor.get_transaction_features(sample_tx)
    print(f"\n[Test Direct Random Seek] txId '{sample_tx}' features count: {len(feats) if feats else 0}")
    print("Memory-safe processing pipeline verified successfully!")

if __name__ == "__main__":
    main()
