# PCCS Phase 1 Data Memo

## 参照元

- 有彩色データの主参照元
  - `https://tee-room.info/color/tone-v.html`
  - `https://tee-room.info/color/tone-b.html`
  - `https://tee-room.info/color/tone-s.html`
  - `https://tee-room.info/color/tone-dp.html`
  - `https://tee-room.info/color/tone-lt.html`
  - `https://tee-room.info/color/tone-sf.html`
  - `https://tee-room.info/color/tone-d.html`
  - `https://tee-room.info/color/tone-dk.html`
  - `https://tee-room.info/color/tone-p.html`
  - `https://tee-room.info/color/tone-ltg.html`
  - `https://tee-room.info/color/tone-g.html`
  - `https://tee-room.info/color/tone-dkg.html`
- 色相・PCCS 概念の補助参照
  - `https://tee-room.info/color/what02_5.html`
  - `https://www.musabi.ac.jp/wp-content/uploads/2022/11/20221118_02.pdf`

## 採用方針

- 描画座標用の値は `PCCS記号` から抽出した `pccsLightness` と `pccsSaturation` を使う。
- `munsellNotation` は情報表示用の補助データとして保持し、描画座標の計算元には使わない。
- 球の表示色は `hex` / `rgb` を使う。

## Phase 1 の対象点数

- 有彩色
  - `v` トーンは 24 色相すべて採用
  - その他 11 トーンは 12 色相代表のみ採用
  - 合計 `156` 点
- 無彩色
  - `W / ltGy / mGy / dkGy / Bk` の 5 点
- 今回の実データ点数は `161` 点

## 24 色相と 12 色相代表

- 24 色相は `src/data/pccsHues.ts` で固定配列として定義している。
- 角度は 360 度を 24 分割し、`15deg` 刻みで付与している。
- Phase 1 で採用する 12 色相代表は、参照元の `v` 以外のトーンページに揃っている偶数インデックス側:
  - `2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24`
- `representativeIndex12` はこの偶数側に対して `1..12` を割り当てている。
- Phase 2 以降に 24 色相へ拡張する前提で、主キーは `hueIndex24` を使う。

## PCCS 記号の扱い

- アプリ内では末尾 `s` を含む統一表記を保持する。
- 参照元に `21:bP-3.5-9` のような表記があっても、記載漏れとして `21:bP-3.5-9s` に補正する。
- 補正処理は `src/data/utils.ts` の `normalizePccsNotation()` にまとめている。
- 明度・彩度の抽出は `parsePccsNotation()` を使う。

## 無彩色データ

- `src/data/pccsAchromatic.ts` は以下を出典にしている。
  - `https://spark-a.com/design/ct-achromatic-color/`
- Phase 1 では同ページに掲載された無彩色群から、代表的な 5 色 `W / ltGy / mGy / dkGy / Bk` のみ採用した。
- 採用値は以下。
  - `W`: `n-9.5` / `N 9.5` / `#FFFFFF`
  - `ltGy`: `ltGy-8.5` / `N 8.5` / `#D6D6D6`
  - `mGy`: `mGy-6.5` / `N 6.5` / `#A1A1A1`
  - `dkGy`: `dkGy-3.5` / `N 3.5` / `#545454`
  - `Bk`: `Bk-1.5` / `N 1.5` / `#000000`
- 無彩色の `pccsSaturation` はすべて `0` として扱う。

## 実装メモ

- `pccsPoints.ts` は参照元ページから採用した `PCCS記号 / マンセル値 / HEX / RGB` を保持する。
- `hueIndex24` は `PCCS記号` の先頭番号を優先して扱う。
- 公開参照には hue code 表記ゆれがあるため、色相配列の主キーは `hueCode24` ではなく `hueIndex24` にしている。

## 今後の拡張想定

- Phase 2 以降では、`v` 以外のトーンも 24 色相へ増やせる構造にしている。
- その場合は `pccsPoints.ts` のソース行を 24 色相分に増やし、既存の `hueIndex24` ベース構造をそのまま使う。
- 無彩色は確定ソースに差し替える。
