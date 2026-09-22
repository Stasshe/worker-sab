# Speed lab specification

## Purpose

同じ CPU 集約計算を直列実行と共有メモリを使う並列実行で比較し、処理時間と UI 応答性の差を表示する。

## Execution paths

- Main thread: 全タスクを UI スレッドで順番に実行する。
- Workers + SAB: `SharedArrayBuffer` 内のタスクカーソルを各 Worker が atomically claim して実行する。完了数と各タスクの結果も同じバッファへ保存する。

## Requirements

- Worker パスは cross-origin isolated context でのみ有効にする。
- 両パスはタスク数・反復数・計算式を共有する。
- 表示する時間はブラウザの `performance.now()` による実測値とする。
