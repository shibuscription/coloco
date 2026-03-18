# PCCS Data Memo

## 参照元
- 現在の有彩色・無彩色データの source of truth
  - `https://kenchikushi999.com/pccs-conversion/`

## 採用方針
- Phase 1 の採用点数と構成は維持する
  - `v` トーン: 24 色相
  - その他 11 トーン: 12 色相代表
  - 無彩色: 5 点
  - 合計: `161` 点
- 各採用点の中身は、新しい参照元の値へ更新する
  - `munsellNotation`
  - `rgb`
  - `hex`
  - `cmyk`
- 描画座標の元は引き続き `PCCS記号` から抽出した `pccsLightness` / `pccsSaturation`
- マンセル値は表示用補助データとして保持し、座標計算には使わない

## PCCS記号の補正ルール
- 末尾の彩度記号は引き続き `s` 付きの統一表記を使う
- 今回は新しい参照元の `Munsell` 明度を優先し、`PCCS記号` 内の明度値もそれに合わせて補正している
- つまり、`PCCS記号` は
  - 色相コード: 従来の採用構成を維持
  - 彩度値: 従来の採用構成を維持
  - 明度値: 新しい参照元のマンセル明度へ更新
 という扱いにしている

## CMYK について
- 各色データに `cmyk` を追加している
- 形式は `{ c, m, y, k }`
- `pccsPoints.ts` と `pccsAchromatic.ts` の両方で保持し、`pccsDisplayColors.ts` にも含めている

## 無彩色データ
- 無彩色は引き続き代表 5 点のみ採用する
  - `W`
  - `ltGy`
  - `mGy`
  - `dkGy`
  - `Bk`
- 参照元上のグレースケール値との対応は以下
  - `W` ← `Gy-9.5`
  - `ltGy` ← `Gy-8.5`
  - `mGy` ← `Gy-6.5`
  - `dkGy` ← `Gy-3.5`
  - `Bk` ← `Gy-1.5`

## 実装メモ
- `pccsPoints.ts`
  - 現在アプリで採用している 156 点のみを保持
  - 新しい参照元の `Munsell / RGB / CMYK / HEX` に全面更新
- `pccsAchromatic.ts`
  - 代表 5 点のみ保持
  - 新しい参照元の `Munsell / RGB / CMYK / HEX` に更新
- `types.ts`
  - `CmykColor` を追加
  - 有彩色・無彩色・表示色の型に `cmyk` を追加
