# Mandelbrot: Worker + SAB + Rust/WASM

Vite の開発用デモ。境界付近を深くズームした 960 × 600 の Mandelbrot 画像を、4 経路で実測比較する。

- メインスレッド JavaScript
- メインスレッド Rust/WASM
- Worker + SharedArrayBuffer JavaScript
- Worker + SharedArrayBuffer + Rust/WASM

```sh
pnpm install
pnpm dev
```

Vite の開発サーバーは `Cross-Origin-Opener-Policy` と `Cross-Origin-Embedder-Policy` を設定する。これにより `SharedArrayBuffer` が有効になる。

`pnpm dev` と `pnpm run build` は先に Rust の `wasm/` クレートを `wasm32-unknown-unknown` へコンパイルする。成果物は Vite の public asset として配信される。

Worker は共有メモリ内の行番号を `Atomics.add()` で取得する。JavaScript 経路は RGBA ピクセルを SAB へ直接書き込む。WASM 経路は Rust の `render_row()` で行を計算し、WASM メモリから SAB の画像バッファへ書き込む。メインスレッド WASM は同じ Rust カーネルを Worker なしで実行するため、WASM 自体と並列化を別々に比較できる。

通信頻度の計測は、3 波源の距離から RGBA を作るヒートマップを 2 × 2 px の 144,000 タイルで描く。`postMessage` は各結果を Transferable で返し、SAB は共有画像バッファへ直接書き込む。
