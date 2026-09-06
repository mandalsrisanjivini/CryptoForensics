export class CommandTelemetry {
  constructor() {
    this.hdrTotal = document.getElementById('hdr-total-txs');
    this.hdrThreat = document.getElementById('hdr-threat-txs');

    // Overview modal fields
    this.ovTotal = document.getElementById('ov-total-val');
    this.ovIllicit = document.getElementById('ov-illicit-val');
    this.ovLicit = document.getElementById('ov-licit-val');
    this.ovUnknown = document.getElementById('ov-unknown-val');
    this.ovEdges = document.getElementById('ov-edges-val');
  }

  async loadSummary() {
    try {
      const res = await fetch('/api/metrics/summary');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.render(data);
      return data;
    } catch (err) {
      console.warn('Telemetry load fallback:', err);
      this.render({
        total_transactions: 203769,
        illicit_transactions: 4545,
        licit_transactions: 42019,
        unknown_transactions: 157205,
        total_edges: 234355,
      });
    }
  }

  render(data) {
    if (this.hdrTotal) this.hdrTotal.textContent = `${data.total_transactions.toLocaleString()} Txs`;
    if (this.hdrThreat) this.hdrThreat.textContent = `${data.illicit_transactions.toLocaleString()} Flagged`;

    if (this.ovTotal) this.ovTotal.textContent = data.total_transactions.toLocaleString();
    if (this.ovIllicit) this.ovIllicit.textContent = data.illicit_transactions.toLocaleString();
    if (this.ovLicit) this.ovLicit.textContent = data.licit_transactions.toLocaleString();
    if (this.ovUnknown) this.ovUnknown.textContent = data.unknown_transactions.toLocaleString();
    if (this.ovEdges) this.ovEdges.textContent = data.total_edges.toLocaleString();
  }
}
