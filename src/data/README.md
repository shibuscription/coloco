# PCCS Data Memo

## 参照元
- 有彩色の RGB / HEX / CMYK
  - `https://tee-room.info/color/tone-v.html`
  - そのほか `tone-b.html` から `tone-dkg.html` までの同系列ページ
- 有彩色のマンセル記号と PCCS 記号内の明度
  - `https://kenchikushi999.com/pccs-conversion/`
- 無彩色 9 色
  - `https://spark-a.com/design/ct-achromatic-color/`

## 現在の採用方針
- 採用点数と構成は Phase 1 のまま維持している
  - `v` トーン: 24 色相
  - その他 11 トーン: 12 色相代表
  - 無彩色: 9 色
  - 合計 `165` 点
- 有彩色はハイブリッド方針
  - `munsellNotation`: `kenchikushi999.com`
  - `pccsNotation` 内の明度値: `kenchikushi999.com`
  - `rgb` / `hex` / `cmyk`: `tee-room.info`
- 無彩色は `spark-a` を source of truth とする
  - `pccsNotation`
  - `munsellNotation`
  - `rgb`
  - `hex`
  - `cmyk`

## 描画用と表示用
- 描画用
  - 色相
  - `pccsLightness`
  - `pccsSaturation`
- 表示用
  - `hex`
  - `rgb`
  - `cmyk`
  - `munsellNotation`

マンセル記号は情報表示用の補助データであり、座標計算そのものには使っていません。

## PCCS 記号の扱い
- アプリ内では末尾に `s` を含む統一表記を使う
- `pccsNotation` の明度値は、新参照元のマンセル明度に合わせて補正している
- RGB / HEX / CMYK の更新時でも、この明度補正は維持する

## CMYK
- 各色データは `cmyk` を持つ
- 形式は `{ c, m, y, k }`
- 色情報パネルでも CMYK を表示できるようにしている

## 無彩色データ
- 無彩色 9 色は `spark-a` を source of truth としている
- 参照元では白が `w`、黒が `BK` 表記だが、coloco 内では既存表記との整合を優先して `W` / `Bk` を使う
- 参照元表記は取り込み元情報として扱い、アプリ内の ID / 表示ラベルは `W` / `Bk` を採用している
- 対象:
  - `W`
  - `ltGy`
  - `Gy7.5`
  - `mGy`
  - `Gy5.5`
  - `Gy4.5`
  - `dkGy`
  - `Gy2.5`
  - `Bk`
- これらは PCCS 記号、マンセル記号、RGB、HEX、CMYK をまとめて `spark-a` ベースで採用している

## 主要ファイル
- [pccsPoints.ts](./pccsPoints.ts)
  - 有彩色 156 点の定義
- [pccsAchromatic.ts](./pccsAchromatic.ts)
  - 無彩色 9 点の定義
- [pccsDisplayColors.ts](./pccsDisplayColors.ts)
  - 表示色辞書
- [types.ts](./types.ts)
  - `CmykColor` を含む型定義

## 補足
- 旧参照元の RGB / CMYK は、教材として見たときの色味の印象を優先して採用している
- 新参照元のマンセル値と明度補正は、PCCS 表記との整合を優先して採用している
- 無彩色だけは別方針で、`spark-a` の定義を優先している
