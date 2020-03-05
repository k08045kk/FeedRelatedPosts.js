FeedRelatedPosts.js
=====================

Place related articles on Blogger.



## Description
Related articles are created based on post titles, labels, and summaries. The relevance of related articles is determined by the matching of `trigram` and `engramify` based on the title and summary.  It is arranged based on site-related article settings and page-related article settings. Separately in README.md. Settings are used by overwriting [Site Settings] with [Page Settings]. Please read (execute) this script after the related article setting.

Bloggerに関連記事を設置します。
関連記事は、投稿のタイトルとラベル、概要を元に作成します。
関連記事の関連度は、タイトルと概要を元にした`trigram`や`engramify`の一致度で判定します。
サイト関連記事設定・ページ関連記事設定に基づいて配置されます。README.mdに別記します。
設定は、[サイト設定]に[ページ設定]を上書きして利用します。
本スクリプトの読込み（実行）は、関連記事設定より後に実行して下さい。


## Setting
サイトの関連記事設定
下記の`<script>`をBloggerのBlogウィジェット内に設定してください。
プロパティは、下記の表を参照して下さい。
```html
<script type='application/json' id='related-posts-site-json'>
{
  "debug": false,
  "homepageUrl": "<data:blog.homepageUrl/>",
  "labels": [<b:loop values='data:post.labels' var='label' index='i'><b:if cond='data:i != 0'>,</b:if>"<data:label.name.jsonEscaped/>"</b:loop>],
  "url": "<data:post.url/>",
  "title": "<data:post.title.jsonEscaped/>",
  "snippet": "<data:post.snippet.jsonEscaped/>",
  "useSnippet": true,
  "min": -1,
  "max": 5,
  "prefix": "<div role='navigation'><h2>Related Posts</h2><ul>",
  "sufix": "</ul></div>",
  "dummy": "<li>&amp;nbsp;</li>",
  "format": "<li data-score='${score}'><a href='${url}'>${title}</a></li>", 
}
</script>
```

---

ページの関連記事設定
下記の`<script>`を投稿内に設定してください。
※ページ側で制御しない場合、設置は不要です。
```html
<script type='application/json' id='related-posts-page-json'>
{"pages":[
   {"visible": false, "url":"https://.../page1.html", "title":"title1"}
  ,{"visible": true,  "url":"https://.../page2.html", "title":"title2", "thumbnail":"thumbnail URL"}
  , ...
]}
</script>
```

※`<script>`の記載が難しい場合、`<div hidden>`などで対応できないか検討ください。



## Properties
プロパティ    | 初期値                     | 説明                         | 備考
---           | ---                        | ---                          | ---
debug         | false                      | デバッグ機能を有効にする
state         | -                          | 状態                         | システム内部の変数
run           | true                       | 実行する                     | RelatedPosts.init();
pushPages     | false                      | pagesを上位設定pagesの末尾に追加する
siteJsonQuery | "#related-posts-site-json" | サイト設定JSONのクエリー
pageJsonQuery | "#related-posts-page-json" | ページ設定JSONのクエリー
homepageUrl   | ""                         | ホームページのURL            | プレビュー画面用
params        | ""                         | feeds取得用の追加パラメータ
useLastPosts  | false                      | 最新投稿を関連記事の対象にする
labels        | - (必須)                   | 関連記事の設置投稿のラベル
url           | - (必須)                   | 関連記事の設置投稿のURL
title         | - (必須)                   | 関連記事の設置投稿のタイトル
snippet       | ""                         | 関連記事の設置投稿のスニペット
useSnippet    | false                      | snippetを使用する            | 関連度上昇目的
useSummary    | false                      | summaryを使用する            | 関連度上昇目的
gramify       | "trigramify"               | 文字列分割方式               | "trigramify"（日本語用）<br/>"engramify"（英語用）
min           | 1                          | 関連記事の最小数             | 未満は表示しない<br/>-1:dummyでmaxまで表示
max           | 5                          | 関連記事の最大数             | 関連度上位表示する
excludedAnkerQuery | -                     | 除外アンカークエリー         | ページ内のリンクを除外する
insertQuery   | "#related-posts-site-json" | 関連記事HTMLの挿入位置のクエリー
prefix        | ""                         | 関連記事HTMLの接頭辞
sufix         | ""                         | 関連記事HTMLの接尾辞
dummy         | ""                         | 関連記事HTMLのダミー         | 書式は使用できない
format        | ""                         | 関連記事HTMLの書式
pages         | []                         | 事前指定の関連記事設定       | 配列先頭から表示する。<br/>maxを超えて表示しない。<br/>余りを関連度順で表示する。
pages.visible | true                       | 項目を表示する               | 未使用設定保存用
pages.url     | - (必須)                   | ページURL
pages.title   | - (必須)                   | ページタイトル
pages.thumbnail | -                        | ページサムネイル画像URL
pages.score   | -                          | 関連度                       | システム内部の変数



## License
[MIT](https://github.com/k08045kk/FeedRelatedPosts.js/blob/master/LICENSE)



## Author
[toshi](https://www.bugbugnow.net/p/profile.html)
