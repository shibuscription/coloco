# PCCS Data Memo

## 参照元
- 有彩色の表示色参照元
  - `https://tee-room.info/color/tone-v.html`
  - そのほか `tone-b.html` から `tone-dkg.html` までの同系列ページ
- 有彩色の構造参照元
  - `https://kenchikushi999.com/pccs-conversion/`
- 無彩色の参照元
  - `https://spark-a.com/design/ct-achromatic-color/`

## 現在の採用方針
- 採用点数と構成は Phase 1 のまま維持
  - `v` トーン: 24 色相
  - その他 11 トーン: 12 色相代表
  - 無彩色: 5 点
  - 合計 `161` 点
- 今回の色データはハイブリッド方針
  - 有彩色の `munsellNotation`: 新参照先を維持
  - 有彩色の `pccsNotation` 内の明度値: 新参照先ベースを維持
  - 有彩色の `rgb` / `hex` / `cmyk`: 旧参照先ベース
  - 無彩色の `pccsNotation` / `munsellNotation` / `rgb` / `hex` / `cmyk`: spark-a ベース

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

マンセル記号は情報表示用の補助データであり、座標計算には使いません。

## PCCS 記号の扱い
- アプリ内では末尾 `s` 付きの統一表記を使います
- `pccsNotation` の明度値は、新参照先のマンセル明度に合わせて補正済みです
- 今回の RGB / HEX / CMYK 差し替えでは、この明度補正は巻き戻していません

## CMYK について
- 各色データに `cmyk` を追加しています
- 形式は `{ c, m, y, k }`
- 色情報パネルや表示色辞書でも同じ値を参照します

## 無彩色データ
- 無彩色 5 点の構成自体は現行のままです
- 無彩色だけは `spark-a` を source of truth としています
  - `W`
  - `ltGy`
  - `mGy`
  - `dkGy`
  - `Bk`
- 採用している無彩色値
  - `W` → `n-9.5` / `N 9.5` / `#FFFFFF`
  - `ltGy` → `n-8.5` / `N 8.5` / `#D6D6D6`
  - `mGy` → `n-6.5` / `N 6.5` / `#A1A1A1`
  - `dkGy` → `n-3.5` / `N 3.5` / `#545454`
  - `Bk` → `n-1.5` / `N 1.5` / `#000000`

## 今回の更新内容
- [pccsPoints.ts](./pccsPoints.ts)
  - 有彩色 156 点の `rgb` / `hex` / `cmyk` を旧参照先ベースへ差し替え
  - `munsellNotation` は新参照先のまま維持
  - `pccsNotation` 内の明度値も新参照先ベースのまま維持
- [types.ts](./types.ts)
  - `CmykColor` を利用
- [pccsDisplayColors.ts](./pccsDisplayColors.ts)
  - `cmyk` を含む表示色辞書を利用
- [pccsAchromatic.ts](./pccsAchromatic.ts)
  - 無彩色 5 点の `pccsNotation` / `munsellNotation` / `rgb` / `hex` / `cmyk` を spark-a ベースへ更新

## 補足
- 旧参照先は RGB / CMYK を「知覚的に近しい任意の値」として掲載しているため、有彩色の表示色や画像解析の印象調整を優先する用途に向いています
- 新参照先は有彩色のマンセル対応と明度の扱いを優先しています
- spark-a は無彩色の PCCS 記号とマンセル表記を含めたまとまりが自然なので、無彩色だけは別系統で採用しています
- そのため、coloco では「構造理解に効く値」と「見た目や表記に効く値」を分けて使っています
