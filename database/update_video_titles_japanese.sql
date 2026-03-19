-- 既存の動画タイトルを日本語に更新

-- Sintel を日本語タイトルに更新
UPDATE videos SET
  title = 'シンテル - ドラゴンと少女の物語',
  description = 'オープンソース映画プロジェクト。少女シンテルとドラゴンの感動的な冒険ストーリー。'
WHERE title LIKE '%Sintel%';

-- Big Buck Bunny を日本語タイトルに更新
UPDATE videos SET
  title = 'ビッグ・バック・バニー - 巨大ウサギの冒険',
  description = 'Blender財団制作のオープンソースアニメーション。巨大なウサギが森の仲間と繰り広げるコミカルな物語。'
WHERE title LIKE '%Big Buck Bunny%';
