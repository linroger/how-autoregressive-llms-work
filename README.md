# How Autoregressive LLMs Work

An interactive, bilingual (EN / 中) explainer of how modern autoregressive large language models work — from the 2017 Transformer architecture to 2026's reasoning agents.

**Live site:** https://linroger.github.io/how-autoregressive-llms-work/

## What's inside

- **27 sections** across 6 parts: Foundations (Transformer mechanics), Pretraining & Scaling, Alignment & Reasoning, Efficiency, Memory & Modality, and the 2025–2026 Frontier
- **28 interactive D3 visualizations**: tokenization, attention heatmaps, multi-head, RoPE rotation, transformer block forward pass, sampling (temperature/top-p), scaling laws, in-context learning, chain-of-thought, RLHF pipeline, DPO derivation, Constitutional AI, GRPO reasoning emergence, MoE routing, KV cache (MHA/GQA/MLA), FlashAttention tiling, FP4 quantization, LoRA, long-context timeline, RAG, CLIP, Mamba/SSM, agents + MCP, master timeline
- **Bilingual:** every visible string switches between English and Simplified Chinese via the EN/中 toggle (361 i18n keys × 2 languages, perfect parity)
- **Mobile-responsive** with a drawer nav at ≤860px

## Inspired by

The visual theme and structure follow [how-diffusion-llms-work](https://linroger.github.io/how-diffusion-llms-work/) — a companion explainer on diffusion language models.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Tech

- Plain HTML + CSS + vanilla JS — no build step
- [D3.js v7](https://d3js.org/) for visualizations
- [KaTeX](https://katex.org/) for math
- Inter, Source Serif 4, JetBrains Mono, Noto Sans/Serif SC fonts via Google Fonts

## License

MIT
