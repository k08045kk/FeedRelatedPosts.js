/*! BloggerRelatedPosts.js v1 | MIT License | https://github.com/k08045kk/BloggerRelatedPosts.js/blob/master/LICENSE */
/**
 * BloggerRelatedPosts.js
 * Bloggerに関連記事を設置します。
 * 関連記事は、投稿のタイトルとラベルを元に作成します。
 * 関連記事の関連度は、タイトル文字列のtrigram一致度で判定します。
 * ソース下部に別記するサイトの関連記事設定、ページの関連記事設定を元に関連記事を配置します。
 * サイトの関連記事設定をページの関連記事設定で上書きして利用します。（pagesのみ末尾追加します）
 * 本スクリプトの読込み（実行）は、関連記事設定より後に実行して下さい。
 * 使用方法として次の３つが考えられます。
 * + 関連記事設定より後に`script`を配置する
 * + 関連記事設定より後に`script async="1"`で読み込む
 * + `script defer="1"`で読み込む
 * 対応：IE11+（Set/Mapがボトルネック）
 * 関連：https://www.bugbugnow.net/2018/07/blogger_23.html
 * @auther      toshi (https://github.com/k08045kk)
 * @version     1
 * @see         1.20200211 - add - 初版
 * @see         1.20200212 - update - engramify（英語分割）に対応
 * @see         1.20200213 - update - insertPositionId を Query に変更、自由度向上のため
 * @see         1.20200213 - update - htmlscd(), engramify() を最適化
 * @see         1.20200213 - update - 関連記事設定の構造を変更
 * @see         1.20200213 - update - ${score}, ${$} を出力
 * @see         1.20200213 - fix - 事前指定時にm=1のURLと重複することがある
 */
(function(root, factory) {
  if (!root.BloggerRelatedPosts) {
    const data = {};//window.BloggerRelatedPosts && window.BloggerRelatedPosts._data || {};
    const query1 = data.siteJsonQuery || '#related-posts-site-json';
    const element1 = document.querySelector(query1);
    const data1 = element1 && JSON.parse(element1.textContent) || {};
    const query2 = data1.pageJsonQuery || '#related-posts-page-json';
    const element2 = document.querySelector(query2);
    
    // 設定JSON作成（pagesのみ末尾追加）
    let data2 = {};
    try {
      data2 = element2 && JSON.parse(element2.textContent) || {};
    } catch (e) {}
    const pages = data.pages || [];
    Array.prototype.push.apply(pages, data1.pages || []);
    Array.prototype.push.apply(pages, data2.pages || []);
    for (const key in data1) {
      if (data1.hasOwnProperty(key)) {
        data[key] = data1[key];
      }
    }
    for (const key in data2) {
      if (data2.hasOwnProperty(key)) {
        data[key] = data2[key];
      }
    }
    data.pages = pages;
    
    root.BloggerRelatedPosts = factory(document);
    root.BloggerRelatedPosts.init(data);
  }
})(this, function(document) {
  "use strict";
  
  const _this = function() {};
  
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
    const map = {'&nbsp;':' ','&lt;':'<','&gt;':'>','&amp;':'&','&quot;':'"','&apos;':"'"};  //'
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
    text = text + '   ';
    set = set || new Set();
    for (let i=text.length-2; i--; ) {
      set.add(text.substring(i, i+3));
    }
    return set;
  };
  
  // trigramを比較する
  const compare = function(set1, set2) {
    let count = 0;
    set1.forEach(function(value) {
      if (set2.has(value)) {
        count = count + 1;
      }
    });
    return count / (set1.size + set2.size - count);
    // count: 一致数
    // set1.size + set2.size - count: チェック数
    // return: 0-1 (0: 不一致, 1:一致(完全一致とは限らない))
  };
  
  // 関連記事を書き込む
  const write = function(data) {
    const pages = [];
    data.pageMap.forEach(function(value) {
      pages.push(value);
    });
    pages.sort(function(a, b) { return b.score - a.score; });
    
    const max = Math.min(data.max, pages.length);
    if (max >= data.min) {
      const lines = [];
      for (let i=0; i<max; i++) {
        lines.push(data.format.replace(/\${url}/ig, pages[i].url)
                              .replace(/\${title}/ig, pages[i].title)
                              //.replace(/\${summary}/ig, pages[i].summary)
                              //.replace(/\${set}/ig, [...pages[i].set].join(' | '))
                              .replace(/\${thumbnail}/ig, pages[i].thumbnail || '')
                              .replace(/\${score}/ig, pages[i].score)
                              .replace(/\${\$}/ig, '$'));
      }
      const html = (data.prefix || '') + lines.join('') + (data.sufix || '');
      
      // 指定要素の直後に挿入
      const query = data.insertPositionQuery || '#related-posts-site-json';
      document.querySelector(query).insertAdjacentHTML('afterend', html);
    }
    
    if (data.debug !== true) {
      // メモリ開放
      data.pageMap = null;
    }
  };
  
  // フィードの要素を追加する
  _this.add = function(json) {
    const data = _this._data;
    if (data.pageMap) {
      // フィード解析処理
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
                //summary: (entry.summary ? entry.summary.$t : ''),
                //set: set,
                thumbnail: (entry.media$thumbnail ? entry.media$thumbnail.url : ''),
                score: compare(data.set, set)
              });
            }
            break;
          }
        }
      }
      
      data.count++;
      if (data.count == data.limit) {
        write(data);
      }
    } else {
      // ありえない
    }
  };
  
  // 初期化
  _this.init = function(data) {
    _this._data = data;
    data.url = data.url.split('?')[0];
    data.count = 0;
    data.limit = data.labels.length;
    data.pageMap = new Map();
    
    if (data.min == null) { data.min = 1; }
    if (data.max == null) { data.max = 5; }
    if (!data.homepageUrl) {
      const m = data.url.match(/^(.+?):\/\/(.+?):?(\d+)?(\/.*)?$/);
      data.homepageUrl = m[1]+'://'+m[2]+(m[3] ? ':'+m[3] : '')+'/';
    }
    
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
        data.pages[p].score = data.limit + 1 - p;
        data.pageMap.set(data.pages[p].url, data.pages[p]);
      }
    }
    
    if (data.pageMap.size < data.max) {
      const feed = data.homepageUrl+'feeds/posts/summary/-/';
      const params = '?alt=json-in-script&callback=BloggerRelatedPosts.add'
                   + (data.params ? '&'+data.params : '');
      const isMaxResults = data.params && data.params.indexOf('max-results=') >= 0;
      if (data.limit == 0) {
        // ラベルなし（処理終了）
      } else if (data.limit == 1) {
        loadScript(feed+data.labels[0]+params+(isMaxResults ? '' : '&max-results=100'));
      } else if (data.limit == 2) {
        loadScript(feed+data.labels[0]+params+(isMaxResults ? '' : '&max-results=50'));
        loadScript(feed+data.labels[1]+params+(isMaxResults ? '' : '&max-results=50'));
      } else {
        for (let i=0; i<data.limit; i++) {
          // max-results=25(default)
          loadScript(feed+data.labels[i]+params)
        }
      }
      // 例：https://www.bugbugnow.net/feeds/posts/summary/-/WSHLibrary?alt=json-in-script
      // 補足：homepageUrlは、プレビュー画面動作用です
      // 補足：ラベルの複数指定方法もある（.../-/label1/label2?...）
      //       ただし、AND検索である（現状使いみちが思いつかなかったため、使用しない）
    } else {
      write(data);
    }
  };
  
  return _this;
  // 補足：フィード読込みとフィード解析の変更で、Blogger以外にも対応も可能です
});

/*<!--
// サイトの関連記事設定
// 下記の<script>をBlogウィジェット内に設定してください。
<script type='application/json' id='related-posts-site-json'>
{
  "debug": false,
  "pageJsonQuery": "#related-posts-page-json",
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
  "min": 1,
  "max": 5,
  "insertPositionQuery": "#related-posts-site-json",
  "prefix": "<div role='navigation'><h2>Related Posts</h2><ul>",
  "sufix": "</ul></div>",
  "format": "<li data-score='${score}'><a href='${url}'>${title}</a></li>", 
  "pages": [
     {"visible":false, "url":"https://.../page1.html", "title":"title1"}
    ,{"visible":true, "url":"https://.../page2.html", "title":"title2"}
    , ...
  ]
}
</script>

// ページの関連記事設定
// 下記の<script>を投稿内に設定してください。
// ページ設定は、サイト設定を上書きます。（pagesのみ末尾追加します）
<script type='application/json' id='related-posts-page-json'>
{
  "max": 5,
  "pages": [
     {"visible": false, "url":"https://.../page1.html", "title":"title1"}
    ,{"visible": true, "url":"https://.../page2.html", "title":"title2", "thumbnail":"thumbnail URL"}
    , ...
  ]
}
</script>

json          | 必須 | 初期値                     | 説明                         | 備考
---           | ---  | ---                        | ---                          | ---
debug         | -    | false                      | デバッグ機能を有効にする
siteJsonQuery | -    | "#related-posts-site-json" | サイト設定JSONのクエリー
pageJsonQuery | -    | "#related-posts-page-json" | ページ設定JSONのクエリー
homepageUrl   | -    | ""                         | ホームページのURL            | プレビュー画面用
params        | -    | ""                         | feeds取得用の追加パラメータ
labels        | 必須 | -                          | 関連記事の設置投稿のラベル
url           | 必須 | -                          | 関連記事の設置投稿のURL
title         | 必須 | -                          | 関連記事の設置投稿のタイトル
snippet       | -    | ""                         | 関連記事の設置投稿のスニペット
useSnippet    | -    | false                      | snippetを使用する            | 関連度上昇目的
useSummary    | -    | false                      | summaryを使用する            | 関連度上昇目的
gramify       | -    | "trigramify"               | 文字列分割方式               | "trigramify"（3文字分割：日本語用）, "engramify"（英単語分割：英語用）が指定可能
min           | -    | 1                          | 関連記事の最小数             | 未満は表示しない
max           | -    | 5                          | 関連記事の最大数             | 関連度上位表示する
insertPositionQuery | - | "#related-posts-site-json" | 関連記事HTMLの挿入位置のクエリー
prefix        | -    | ""                         | 関連記事HTMLの接頭辞
sufix         | -    | ""                         | 関連記事HTMLの接尾辞
format        | -    | ""                         | 関連記事HTMLの書式           | ${url}, ${title}, ${thumbnail}, ${score}, ${$} が使用できる
pages         | -    | []                         | 事前指定の関連記事設定       | 配列先頭から順に表示する。最大数（max）を超えて表示しない。設定数が最大数に満たない場合、余りを関連度順で表示する。
pages.visible | -    | true                       | 項目を表示する               | 未使用設定保存用
pages.url     | 必須 | -                          | ページURL                    | 関連記事に同一URLを表示しないが、http・https混在環境では重複する可能性がある
pages.title   | 必須 | -                          | ページタイトル
pages.thumbnail | -  | -                          | ページサムネイル画像URL
pages.score   | -    | -                          | 関連度                       | BloggerRelatedPosts.js内部で計算する

※<script>の記載が難しい場合、<div hidden>などで対応できないか検討ください

-->*/
