# Worker + SAB speed lab

Vite の開発用デモ。重い同一計算を、メインスレッドの直列処理と Web Workers + SharedArrayBuffer の並列処理で比較する。

```sh
pnpm install
pnpm dev
```

Vite の開発サーバーは `Cross-Origin-Opener-Policy` と `Cross-Origin-Embedder-Policy` を設定する。これにより `SharedArrayBuffer` が有効になる。

Worker 側は共有メモリ内のタスクカーソルを `Atomics.add()` で取得し、同じ計算結果を共有出力領域へ書き込む。メインスレッドはアニメーションフレームごとに完了数を読むだけなので、進捗表示を維持できる。
