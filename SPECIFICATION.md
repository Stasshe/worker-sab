# Speed lab specification

## Purpose

境界付近を深くズームした 960 × 600 の Mandelbrot 画像を 4 経路で描画し、WASM 単体と Worker/SAB 単体の効果を分離して表示する。

## Execution paths

- Main thread JavaScript: 全 600 行を UI スレッドで順番に描画する。
- Main thread Rust/WASM: Rust の `render_row()` を UI スレッドで順番に実行する。
- Workers + SAB JavaScript: 各 Worker が共有キューを atomically claim し、RGBA ピクセルを共有画像バッファへ直接書き込む。
- Workers + SAB Rust/WASM: Worker 内で Rust の `render_row()` を呼び、WASM 線形メモリの 1 行を共有画像バッファへ書き込む。

## Requirements

- Worker パスは cross-origin isolated context でのみ有効にする。
- 4 経路は座標・反復回数・計算式・配色を共有する。
- 表示する時間はブラウザの `performance.now()` による実測値とする。
- UI はライトテーマ、日本語を基調とする。
- Rust/WASM は `pnpm run wasm` でコンパイルし、`pnpm dev` と `pnpm run build` の前に自動実行する。

## High-frequency communication comparison

- 3 波源からの最短距離を RGBA に変換するヒートマップを 2 × 2 px の 144,000 タイルで描く。
- `postMessage` 経路は各タイルを配布して RGBA を受け取る。
- SAB 経路は共有キューからタイル番号を atomically claim して共有画像へ直接書く。
