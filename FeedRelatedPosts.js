/*! FeedRelatedPosts.js v1 | MIT License | https://github.com/k08045kk/FeedRelatedPosts.js/blob/master/LICENSE */
/**
 * FeedRelatedPosts.js
 * Bloggerに関連記事を設置します。
 * 関連記事は、投稿のタイトルとラベル、概要を元に作成します。
 * 関連記事の関連度は、タイトルと概要を元にした`trigram`や`engramify`の一致度で判定します。
 * ソース下部に別記するサイトの関連記事設定、ページの関連記事設定を元に関連記事を配置します。
 * 設定は、[サイト設定]に[ページ設定]を上書きして利用します。
 * 本スクリプトの読込み（実行）は、関連記事設定より後に実行して下さい。
 * 使用方法として次の３つが考えられます。
 *   + 関連記事設定より後に`script`を配置する
 *   + 関連記事設定より後に`script async="1"`で読み込む
 *   + `script defer="1"`で読み込む
 * 対応：IE11+（Set, Map）
 * 関連：https://www.bugbugnow.net/2018/07/blogger_23.html
 * 補足：フィード読込みとフィード解析の変更で、Blogger以外にも対応も可能です。
 * @auther      toshi (https://github.com/k08045kk)
 * @version     1
 * @see         1.20200211 - add - 初版
 * @see         1.20200212 - update - engramify（英語分割）に対応
 * @see         1.20200213 - update - insertPositionId を Query に変更、自由度向上のため
 * @see         1.20200213 - update - htmlscd(), engramify() を最適化
 * @see         1.20200213 - update - 関連記事設定の構造を変更
 * @see         1.20200213 - update - ${score}, ${$} を出力
 * @see         1.20200213 - fix - 事前指定時にm=1のURLと重複することがある
 * @see         1.20200216 - update - pushPages, insertQueryに修正
 * @see         1.20200216 - update - enableを追加
 * @see         1.20200216 - fix - m=1ページでJSONロードに失敗する
 * @see         1.20200220 - update - dummy指定を追加
 * @see         1.20200221 - update - リファクタリング
 * @see         1.20200221 - update - 関連度が等しい場合、更新日が新しいものを優先する
 * @see         1.20200222 - fix - 事前指定が優先されないことがある
 * @see         1.20200222 - update - 最新投稿を使用可能とする
 * @see         1.20200304 - update - データ格納方式変更（グローバル変数からの入力を有効化）
 * @see         1.20200304 - update - 名称変更 BloggerRelatedPosts.js -> FeedRelatedPosts.js
 * @see         1.20200304 - update - excludedAnkerQuery追加
 * @see         1.20200305 - update - リファクタリング
 */
(function(root, factory) {
  if (!root.FeedRelatedPosts) {
    // 設定作成
    const obj = window.FeedRelatedPosts || function() {};
    const pages = (obj.pages = obj.pages || []);
    for (let i=0; i<2; i++) {
      const query = i == 0 
                  ? (obj.siteJsonQuery || '#related-posts-site-json') 
                  : (obj.pageJsonQuery || '#related-posts-page-json')
      const element = document.querySelector(query);
      try {
        const data = element && JSON.parse(element.textContent) || {};
        Array.prototype.push.apply(pages, data.pages || []);
        for (const key in data) {
          if (data.hasOwnProperty(key)) {
            obj[key] = data[key];
          }
        }
      } catch (e) {}
    }
    obj.pages = obj.pushPages === true ? pages : obj.pages;
    
    // 作成と実行
    root.FeedRelatedPosts = factory(obj, document);
    if (obj.run !== false) {
      root.FeedRelatedPosts.init();
    }
  }
})(this, function(_this, document) {
  "use strict";
  
  // スクリプト動的読み込み
  const loadScript = function(src) {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = src;
    const sc = document.getElementsByTagName('script')[0];
    sc.parentNode.insertBefore(script, sc);
  };
  
  // HTML特殊文字変換
  // see https://www.bugbugnow.net/2020/02/HTML-special-character-converter.html
  const htmlscd = (function() {
    const re = /&#(\d+);|&\w+;/g;
    const map = {'&nbsp;':' ','&lt;':'<','&gt;':'>','&amp;':'&','&quot;':'"','&apos;':"'"};
    return function(text) {
      return text.replace(re, function(match, p1) {
        if (match.charAt(1) == '#') {
          // 数値文字参照
          return String.fromCharCode(p1-0);
        } else if (map.hasOwnProperty(match)) {
          // 定義済み文字実体参照
          return map[match];
        }
        return match;
      });
    };
  })();
  
  // 英語（半角スペース区切り文字）を分割する
  // see https://www.bugbugnow.net/2020/02/English-simple-separation.html
  const engramify = function(text, set) {
    text = text.toLowerCase();
    set = set || new Set();
    //const re = /[A-Z]+[a-z]*|[A-Z]*[a-z]+|'[A-Z]*[a-z]*|[0-9]+|"|!|\?|-|:|;|,|\.|[^A-Za-z0-9'"!\?\-:;,\.\s]+/g;
    const re = /[a-z]+|'[a-z]*|[0-9]+|[^a-z0-9'"!\?\-:;,\.\s]+/g;
    let m;
    while ((m=re.exec(text)) !== null) {
      set.add(m[0]);
    }
    return set;
    // engramify("It's a gift for Mr. 太郎. 太郎さんへのgiftです。");
    // [ "it", "'s", "a", "gift", "for", "mr", "太郎", "太郎さんへの", "です。" ]
  };
  
  // 3文字づつに分解する
  const trigramify = function(text, set) {
    text = '  '+text.toLowerCase()+'  ';
    set = set || new Set();
    for (let i=text.length-2; i--; ) {
      set.add(text.substring(i, i+3));
    }
    return set;
  };
  
  // trigram, engramifyの関連度を計算する
  const relevance = function(set1, set2) {
    let count = 0;
    set2.forEach(function(value) {
      if (set1.has(value)) {
        count = count + 1;
      }
    });
    return count / (set1.size + set2.size - count);
    // count: 一致数
    // set1.size + set2.size - count: チェック数
    // return: 0-1 (0: 不一致, 1:一致(完全一致とは限らない))
    // 第二引数が小さい方が高速に動作する(set1.size > set2.size)
  };
  
  // 関連記事を書き込む
  const write = function(data) {
    const pages = [];
    data.pageMap.forEach(function(value) {
      if (value.score >= 0) {
        pages.push(value);
      }
    });
    pages.sort(function(a, b) {
      // 関連度が高い || 更新日が新しい
      return b.score - a.score || new Date(b.updated) - new Date(a.updated);
    });
    
    const max = Math.min(data.max, pages.length);
    if (data.min <= max) {
      const lines = [];
      let i = 0;
      for (; i<max; i++) {
        lines.push(data.format.replace(/\${(.*?)}/ig, function(match, p1) {
          let ret = '';
          switch (p1.toLowerCase()) {
          case '$': ret = '$'; break;
          //case 'set': ret = [...pages[i].set].join(' | ')); break;
          default:
            ret = pages[i].hasOwnProperty(p1) ? pages[i][p1] : '';
          }
          return ret;
        }));
      }
      if (data.min == -1) {
        for (; i<data.max; i++) {
          lines.push(data.dummy || '');
        }
      }
      const html = (data.prefix || '') + lines.join('') + (data.sufix || '');
      
      // 指定要素の直後に挿入
      const query = data.insertQuery || '#related-posts-site-json';
      document.querySelector(query).insertAdjacentHTML('afterend', html);
    }
    
    if (data.debug !== true) {
      // メモリ開放
      data.pageMap = null;
    }
    data.state = 'complate';
  };
  
  // フィードの要素を追加する
  _this.add = function(json) {
    const data = _this;
    if (data.state == 'loading') {
      // フィード解析処理
      try {
        for (let i=0; i<json.feed.entry.length; i++) {
          let entry = json.feed.entry[i];
          for (let k=0; k<entry.link.length; k++) {
            if (entry.link[k].rel == 'alternate') {
              if (data.url != entry.link[k].href && !data.pageMap.has(entry.link[k].href)) {
                const set = data.gramify(entry.link[k].title);
                if (data.useSummary === true && entry.summary && entry.summary.$t) {
                  data.gramify(entry.summary.$t, set);
                }
                data.pageMap.set(entry.link[k].href.split('?')[0], {
                  url: entry.link[k].href,
                  title: entry.link[k].title, 
                  //published: (entry.published ? entry.published.$t : ''),
                  updated: (entry.updated ? entry.updated.$t : ''), 
                  //summary: (entry.summary ? entry.summary.$t : ''),
                  //set: set,
                  thumbnail: (entry.media$thumbnail ? entry.media$thumbnail.url : ''),
                  score: relevance(data.set, set)
                });
              }
              break;
            }
          }
        }
      } catch (e) {
        //console.log('FeedRelatedPosts.add(): error.\n'+json);
      }
      
      data.count = data.count + 1;
      if (data.count >= data.limit) {
        write(data);
      }
    } else {
      // ありえない
    }
  };
  
  // 初期化
  _this.init = function() {
    var data = _this;
    if (data.state) {
      return;
    }
    
    data.state = 'init';
    data.url = data.url.split('?')[0];
    data.count = 0;
    data.limit = data.labels.length + (data.useLastPosts === true ? 1 : 0);
    data.pageMap = new Map();
    
    if (data.min == null) { data.min = 1; }
    if (data.max == null) { data.max = 5; }
    if (!data.homepageUrl) {
      const m = data.url.match(/^(.+?):\/\/(.+?):?(\d+)?(\/.*)?$/);
      data.homepageUrl = m[1]+'://'+m[2]+(m[3] ? ':'+m[3] : '')+'/';
    }
    data.homepageUrl = data.homepageUrl.split('?')[0];
    
    // セット作成
    data.gramify = data.useSetType == 'engramify' ? engramify : trigramify;
    data.set = data.gramify(data.title);
    
    // スニペットを追加設定
    if (data.useSnippet === true && data.snippet) {
      data.snippet = htmlscd(data.snippet);
      data.gramify(data.snippet, data.set);
    }
    
    // 事前指定
    for (let p=0; p<data.pages.length; p++) {
      if (data.pages[p].visible !== false) {
        data.pages[p].score = data.pages.length + 1 - p;
        data.pageMap.set(data.pages[p].url, data.pages[p]);
      }
    }
    
    if (data.pageMap.size < data.max) {
      // 除外URLを設定
      if (data.excludedAnkerQuery) {
        const ankers = document.querySelectorAll(data.excludedAnkerQuery);
        for (let a=0; a<ankers.length; a++) {
          data.pageMap.set(ankers[a].href, {score:-1});
        }
      }
      
      // Feed読込み
      const feed = data.homepageUrl+'feeds/posts/summary';
      const params = '?alt=json&callback=FeedRelatedPosts.add'
                   + (data.params ? '&'+data.params : '');
      const isMaxResults = /(^|&)max-results=/.test(data.params);
      if (data.limit == 0) {
        // ラベルなし時
        if (data.min <= data.pageMap.size) {
          write(data);
        }// else 表示なし
      } else if (data.labels.length == 1) {
        loadScript(feed+'/-/'+data.labels[0]+params+(isMaxResults ? '' : '&max-results=100'));
      } else if (data.labels.length == 2) {
        loadScript(feed+'/-/'+data.labels[0]+params+(isMaxResults ? '' : '&max-results=50'));
        loadScript(feed+'/-/'+data.labels[1]+params+(isMaxResults ? '' : '&max-results=50'));
      } else {
        for (let i=0; i<data.labels.length; i++) {
          // max-results=25(default)
          loadScript(feed+'/-/'+data.labels[i]+params)
        }
      }
      if (data.useLastPosts === true) {
        loadScript(feed+params);
      }
      // 例：https://www.bugbugnow.net/feeds/posts/summary/-/WSHLibrary?alt=json&callback=FeedRelatedPosts.add
      //     http://www.bugbugnow.net/feeds/posts/summary?alt=json&callback=FeedRelatedPosts.add
      // 補足：homepageUrlは、プレビュー画面動作用です
      // 補足：ラベルの複数指定方法もある（.../-/label1/label2?...）
      //       ただし、AND検索である（現状使いみちが思いつかなかったため、使用しない）
    } else {
      // 事前指定が規定数を満たした時
      write(data);
    }
    data.state = 'loading';
  };
  
  return _this;
});

/*<!--
// サイトの関連記事設定
// 下記の<script>をBlogウィジェット内に設定してください。
// ※JSONでコメントは使用不可です
<script type='application/json' id='related-posts-site-json'>
{
  "debug": false,
  "homepageUrl": "<data:blog.homepageUrl/>",
  "params": "orderby=updated",
  "labels": [<b:loop values='data:post.labels' var='label' index='i'><b:if cond='data:i != 0'>,</b:if>"<data:label.name.jsonEscaped/>"</b:loop>],
  "url": "<data:post.url/>",
  "title": "<data:post.title.jsonEscaped/>",
  "snippet": "<data:post.snippet.jsonEscaped/>",
       // or "<data:post.snippets.short.jsonEscaped/>"  // widget version 1 or 2
  "useSnippet": true,
  "useSummary": false,
  "gramify": "trigramify",
  "min": -1,
  "max": 5,
  "prefix": "<div role='navigation'><h2>Related Posts</h2><ul>",
  "sufix": "</ul></div>",
  "dummy": "<li>&amp;nbsp;</li>",
  "format": "<li data-score='${score}'><a href='${url}'>${title}</a></li>", 
}
</script>

// ページの関連記事設定
// 下記の<script>を投稿内に設定してください。
// ページ設定は、サイト設定を上書きます。（pagesのみ末尾追加します）
<script type='application/json' id='related-posts-page-json'>
{"pages":[
   {"visible": false, "url":"https://.../page1.html", "title":"title1"}
  ,{"visible": true,  "url":"https://.../page2.html", "title":"title2", "thumbnail":"thumbnail URL"}
  , ...
]}
</script>

プロパティ    | 必須 | 初期値                     | 説明                         | 備考
---           | ---  | ---                        | ---                          | ---
debug         | -    | false                      | デバッグ機能を有効にする
state         | -    | -                          | 状態                         | システム内部の変数
run           | -    | true                       | 実行する                     | 読込み直後にRelatedPosts.init();を呼び出します
pushPages     | -    | false                      | pagesを上位設定pagesの末尾に追加する
siteJsonQuery | -    | "#related-posts-site-json" | サイト設定JSONのクエリー
pageJsonQuery | -    | "#related-posts-page-json" | ページ設定JSONのクエリー
homepageUrl   | -    | ""                         | ホームページのURL            | プレビュー画面用
params        | -    | ""                         | feeds取得用の追加パラメータ
useLastPosts  | -    | false                      | 最新投稿を関連記事の対象にする
labels        | 必須 | -                          | 関連記事の設置投稿のラベル
url           | 必須 | -                          | 関連記事の設置投稿のURL
title         | 必須 | -                          | 関連記事の設置投稿のタイトル
snippet       | -    | ""                         | 関連記事の設置投稿のスニペット
useSnippet    | -    | false                      | snippetを使用する            | 関連度上昇目的
useSummary    | -    | false                      | summaryを使用する            | 関連度上昇目的
gramify       | -    | "trigramify"               | 文字列分割方式               | "trigramify"（3文字分割：日本語用）, "engramify"（英単語分割：英語用）が指定可能
min           | -    | 1                          | 関連記事の最小数             | 未満は表示しない（-1:dummyを使用してmaxまで表示）
max           | -    | 5                          | 関連記事の最大数             | 関連度上位表示する
excludedAnkerQuery | - | -                        | 除外アンカークエリー         | ページ内のリンクを除外する
insertQuery   | -    | "#related-posts-site-json" | 関連記事HTMLの挿入位置のクエリー
prefix        | -    | ""                         | 関連記事HTMLの接頭辞
sufix         | -    | ""                         | 関連記事HTMLの接尾辞
dummy         | -    | ""                         | 関連記事HTMLのダミー         | 書式は使用できない
format        | -    | ""                         | 関連記事HTMLの書式           | ${url}, ${title}, ${thumbnail}, ${score}, ${$} が使用できる
pages         | -    | []                         | 事前指定の関連記事設定       | 配列先頭から順に表示する。最大数（max）を超えて表示しない。設定数が最大数に満たない場合、余りを関連度順で表示する。
pages.visible | -    | true                       | 項目を表示する               | 未使用設定保存用
pages.url     | 必須 | -                          | ページURL                    | 関連記事に同一URLを表示しないが、http・https混在環境では重複する可能性がある
pages.title   | 必須 | -                          | ページタイトル
pages.thumbnail | -  | -                          | ページサムネイル画像URL
pages.score   | 不可 | -                          | 関連度                       | システム内部の変数

※<script>の記載が難しい場合、<div hidden>などで対応できないか検討ください

-->*/