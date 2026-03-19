# 合法的な動画コンテンツソース

Doumotiに追加できる**合法的なコンテンツソース**の一覧です。

## 1. Blender Foundation オープンソース映画

Blender財団が制作したオープンソース映画は、クリエイティブ・コモンズライセンスで配布されており、自由に使用できます。

### 利用可能作品

| タイトル            | 年        | 時間  | ライセンス |
| ------------------- | --------- | ----- | ---------- |
| Elephants Dream     | 2006      | 11分  | CC-BY      |
| Big Buck Bunny      | 2008      | 10分  | CC-BY      |
| Sintel              | 2010      | 15分  | CC-BY      |
| Tears of Steel      | 2012      | 12分  | CC-BY      |
| Cosmos Laundromat   | 2015      | 12分  | CC-BY      |
| Glass Half          | 2015      | 3分   | CC-BY      |
| Caminandes シリーズ | 2013-2016 | 2-3分 | CC-BY      |
| Agent 327           | 2017      | 4分   | CC-BY      |
| Hero                | 2018      | 8分   | CC-BY      |
| Spring              | 2019      | 8分   | CC-BY      |
| Coffee Run          | 2020      | 3分   | CC-BY      |
| Sprite Fright       | 2021      | 10分  | CC-BY      |

**公式サイト**: https://studio.blender.org/films/

## 2. Internet Archive (archive.org)

パブリックドメインの映画、ドキュメンタリー、テレビ番組などを提供しています。

### 主要コレクション

- **Feature Films**: https://archive.org/details/feature_films
- **Silent Films**: https://archive.org/details/silent_films
- **Classic TV**: https://archive.org/details/classic_tv
- **Animation**: https://archive.org/details/animationandcartoons

### パブリックドメイン映画の例

- Night of the Living Dead (1968)
- Charade (1963)
- The General (1926)
- Nosferatu (1922)
- Plan 9 from Outer Space (1959)

## 3. Pexels / Pixabay

商用利用可能な無料ストック動画を提供しています。

- **Pexels**: https://www.pexels.com/videos/
- **Pixabay**: https://pixabay.com/videos/

### ライセンス

- 無料で商用利用可能
- 帰属表示不要（推奨）
- 再配布可能

## 4. Vimeo Creative Commons

クリエイティブ・コモンズライセンスの動画を検索できます。

**検索URL**: https://vimeo.com/search?type=clip&license=by

## 5. NASA / ESA

宇宙関連の映像はパブリックドメインとして利用可能です。

- **NASA Video Gallery**: https://www.nasa.gov/multimedia/videogallery/
- **ESA Videos**: https://www.esa.int/ESA_Multimedia/Videos

## torrent_tasks.json への追加方法

```json
{
  "magnet": "magnet:?xt=urn:btih:INFOHASH...",
  "title": "動画タイトル（日本語）",
  "description": "動画の説明（日本語）",
  "thumbnail_url": "https://example.com/thumbnail.jpg",
  "minimum_required_tier": "NORMAL",
  "duration_seconds": 600
}
```

### マグネットリンクの取得方法

1. Internet Archive で動画を検索
2. 「TORRENT」リンクをクリック
3. マグネットリンクまたは.torrentファイルをダウンロード

## 注意事項

- 必ずライセンスを確認してから使用してください
- パブリックドメインまたはCC-BYライセンスの作品を優先してください
- 商用利用の場合は、各ライセンスの条件を遵守してください
