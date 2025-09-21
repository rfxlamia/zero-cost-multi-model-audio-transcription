# Gold Audio Fixtures

Place curated reference clips here subdivided by profile:
- `clean/`: studio-quality recordings (e.g., formal news, casual conversations).
- `noisy/`: background noise scenarios (cafe, street) around 10 dB SNR.
- `code-switch/`: Indonesian with English or domain-specific terminology.

Each file should be 16 kHz mono WAV/WebM with paired ground-truth transcript JSON under `tests/fixtures/audio/gold/transcripts/`. See `sample.json` for the expected schema (`reference` string plus `candidates` map per stage).
