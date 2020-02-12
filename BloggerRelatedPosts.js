/*! BloggerRelatedPosts.js v1 | MIT License | https://github.com/k08045kk/BloggerRelatedPosts.js/blob/master/LICENSE */
/**
 * BloggerRelatedPosts.js
 * Bloggerに関連記事を設置します。
 * 関連記事は、投稿のタイトルとラベルを元に作成します。
 * 関連記事の関連度は、タイトル文字列のtrigram一致度で判定します。
 * ソース下部に別記する#related-posts-json要素から、作成する設定JSONを元に関連記事を配置します。
 * ソース下部に別記する#related-posts-data-json要素から、関連記事内容を事前に指定することもできます。
 * 本スクリプトの読込み（実行）は、#related-posts-json要素より後で実施します。
 * そのため、使用方法として次の３つが考えられます。
 * + #related-posts-json要素より後に<script>を配置する
 * + #related-posts-json要素より後に<script async="1">で読み込む
 * + <script defer="1">で読込む
 * 対応：IE11+（Set/Mapがボトルネック）
 * 関連：https://www.bugbugnow.net/2018/07/blogger_23.html
 * @auther      toshi (https://github.com/k08045kk)
 * @version     1
 * @see         1.20200211 - add - 初版
 * @see         1.20200212 - update - engramify（英語分割）に対応
 */
(function(root, factory) {
  if (!root.BloggerRelatedPosts) {
    const document = root.document;
    const element = document.getElementById('related-posts-json');
    if (element) {
      root.BloggerRelatedPosts = factory(document);
      root.BloggerRelatedPosts.init(JSON.parse(element.textContent));
    }
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
  const htmlscc = (function() {
    const map = {'&nbsp;':' ','&lt;':'<','&gt;':'>','&amp;':'&','&quot;':'"','&apos;':"'",'&copy;':'©'};
    return function(src) {
      const re = /&#(\d+);|&\w+;|[^&]+|&/g;
      let text = '';
      let m;
      while ((m=re.exec(src)) !== null) {
        if (m[0].charAt(0) == '&') {
          if (m[0].length == 1) {
            // 構文エラー（エラー終了でも可）
            text = text + m[0];
          } else if (m[0].charAt(1) == '#') {
            // 数値文字参照
            text = text + String.fromCharCode(m[1]-0);
          } else if (map.hasOwnProperty(m[0])) {
            // 定義済み文字実体参照
            text = text + map[m[0]];
          } else {
            // 未定義文字実体参照（諦める）
            text = text + m[0];
          }
        } else {
          // 通常文字列
          text = text + m[0];
        }
      }
      return text;
    };
  })();
  
  // 英語（半角スペース区切り文字）を分割する
  // see https://www.bugbugnow.net/2020/02/English-simple-separation.html
  const engramify = function(text, set) {
    set = set || new Set();
    //const re = /[A-Za-z0-9]+|'[A-Za-z0-9]*|"|!|\?|-|:|;|,|\.|[^A-Za-z0-9'"!\?\-:;,\.\s]+/g;
    const re = /[A-Za-z0-9]+|'[A-Za-z0-9]*|[^A-Za-z0-9'"!\?\-:;,\.\s]+/g;
    let m;
    while ((m=re.exec(text)) !== null) {
      set.add(m[0]);
    }
    return set;
    // engramify("It's a gift for Mr. 太郎. 太郎さんへのgiftです。");
    // ["It", "'s", "a", "gift", "for", "Mr", "太郎", "太郎さんへの", "です。"]
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
                              .replace(/\${thumbnail}/ig, pages[i].thumbnail || ''));
      }
      const html = (data.prefix || '') + lines.join('') + (data.sufix || '');
      
      // 指定要素の直後に挿入
      const id = data.insertPositionId || 'related-posts-json';
      document.getElementById(id).insertAdjacentHTML('afterend', html);
    }
    
    if (data.debug !== true) {
      // メモリ開放
      data.pageMap = null;
    }
  };
  
  // フィードの要素を追加する
  _this.add = function(json) {
    if (_this._data.pageMap) {
      // フィード解析処理
      for (let i=0; i<json.feed.entry.length; i++) {
        let entry = json.feed.entry[i];
        for (let k=0; k<entry.link.length; k++) {
          if (entry.link[k].rel == 'alternate') {
            if (_this._data.url != entry.link[k].href && !_this._data.pageMap.has(entry.link[k].href)) {
              const set = _this._data.gramify(entry.link[k].title);
              if (_this._data.useSummary === true && entry.summary && entry.summary.$t) {
                _this._data.gramify(entry.summary.$t, set);
              }
              _this._data.pageMap.set(entry.link[k].href, {
                //set: set,
                url: entry.link[k].href,
                title: entry.link[k].title, 
                //summary: (entry.summary ? entry.summary.$t : ''),
                thumbnail: (entry.media$thumbnail ? entry.media$thumbnail.url : ''),
                score: compare(_this._data.set, set)
              });
            }
            break;
          }
        }
      }
      
      _this._data.count++;
      if (_this._data.count == _this._data.limit) {
        write(_this._data);
      }
    } else {
      // ありえない
    }
  };
  
  // 初期化
  _this.init = function(obj) {
    _this._data = obj;
    _this._data.url = _this._data.url.split('?')[0];
    _this._data.count = 0;
    _this._data.limit = _this._data.labels.length;
    _this._data.pageMap = new Map();
    
    if (_this._data.min == null) { _this._data.min = 1; }
    if (_this._data.max == null) { _this._data.max = 5; }
    if (!_this._data.homepageUrl) {
      const m = _this._data.url.match(/^(.+?):\/\/(.+?):?(\d+)?(\/.*)?$/);
      _this._data.homepageUrl = m[1]+'://'+m[2]+(m[3] ? ':'+m[3] : '')+'/';
    }
    
    // セット作成
    _this._data.gramify = _this._data.useSetType == 'engramify' ? engramify : trigramify;
    _this._data.set = _this._data.gramify(_this._data.title);
    
    // スニペットを追加設定
    if (_this._data.useSnippet === true && _this._data.snippet) {
      _this._data.snippet = htmlscc(_this._data.snippet);
      _this._data.gramify(_this._data.snippet, _this._data.set);
    }
    
    // 事前指定の関連記事
    const element = document.getElementById('related-posts-data-json');
    if (element) {
      try {
        const json = JSON.parse(element.textContent);
        for (let j=0; j<json.length; j++) {
          if (json[j].visible !== false) {
            json[j].score = _this._data.limit + 1 - j;
            _this._data.pageMap.set(json[j].url, json[j]);
          }
        }
      } catch (e) {
        //console.log('Processing of "#related-posts-data-json" data failed.');
        _this._data.pageMap = new Map();
      }
    }
    
    if (_this._data.pageMap.size < _this._data.max) {
      const feed = _this._data.homepageUrl+'feeds/posts/summary/-/';
      const params = '?alt=json-in-script&callback=BloggerRelatedPosts.add'
                   + (_this._data.params ? '&'+_this._data.params : '');
      const isMaxResults = _this._data.params && _this._data.params.indexOf('max-results=') >= 0;
      if (_this._data.limit == 0) {
        // ラベルなし（処理終了）
      } else if (_this._data.limit == 1) {
        loadScript(feed+_this._data.labels[0]+params+(isMaxResults ? '' : '&max-results=100'));
      } else if (_this._data.limit == 2) {
        loadScript(feed+_this._data.labels[0]+params+(isMaxResults ? '' : '&max-results=50'));
        loadScript(feed+_this._data.labels[1]+params+(isMaxResults ? '' : '&max-results=50'));
      } else {
        for (let i=0; i<_this._data.limit; i++) {
          // max-results=25(default)
          loadScript(feed+_this._data.labels[i]+params)
        }
      }
      // 例：https://www.bugbugnow.net/feeds/posts/summary/-/WSHLibrary?alt=json-in-script
      // 補足：homepageUrlは、プレビュー画面動作用です
      // 補足：ラベルの複数指定方法もある（.../-/label1/label2?...）
      //       ただし、AND検索である（現状使いみちが思いつかなかったため、使用しない）
    } else {
      write(_this._data);
    }
  };
  
  return _this;
  // 補足：フィード読込みとフィード解析の変更で、Blogger以外にも対応も可能です
});

/*<!--
// 関連記事の設定
// 下記の<script>をBlogウィジェット内に設定してください。
// JSON内容を変更することで、関連記事の出力を制御することができます。
// 補足：url, title, labels は、必須項目です
// 補足：JSONではコメントが使用できないため、コメントを削除して使用してください
<script type='application/json' id='related-posts-json'>
{
  "debug": false,                               // デバッグモード（default=false）
  "homepageUrl": "<data:blog.homepageUrl/>",    // ホームページのURL（default=urlのhomepageUrlを使用）
  "params": "orderby=updated",                  // feedsの追加パラメータ（default=''）
  "url": "<data:post.url/>",                    // 関連記事の設置投稿のURL
  "title": "<data:post.title.jsonEscaped/>",    // 関連記事の設置投稿のタイトル
  "snippet": "<data:post.snippet.jsonEscaped/>",// 関連記事の設置投稿のスニペット（default=''）
       // or "<data:post.snippets.short.jsonEscaped/>"  // widget version 1 or 2
  "useSnippet": true,                           // snippetを使用する（関連度上昇目的）（default=false）
  "useSummary": false,                          // summaryを使用する（関連度上昇目的）（default=false）
  "gramify": "trigramify",                      // 文字列分割方式（default='trigramify'）
       // or "engramify"  // 3文字分割（日本語環境用） or 英単語分割（英語環境用）
  "min": 1,                                     // 関連記事の最小数（未満は表示しない）（default=1）
  "max": 5,                                     // 関連記事の最大数（関連度上位表示する）（default=5）
  "insertPositionId": "related-posts-json",     // 挿入位置のID（指定要素の直後に挿入する）（default='related-posts-json'）
  "prefix": "<div role='navigation'><h2>Related Posts</h2><ul>", // 関連記事HTMLの接頭辞（default=''）
  "format": "<li><a href='${url}'>${title}</a></li>", // 関連記事HTMLの書式（${url}, ${title}を置換る）（default=''）
  "sufix": "</ul></div>",                       // 関連記事HTMLの接尾辞（default=''）
  "labels": [<b:loop values='data:post.labels' var='label' index='i'><b:if cond='data:i != 0'>,</b:if>"<data:label.name.jsonEscaped/>"</b:loop>]
                                                // 関連記事の設置投稿のラベル
}
</script>

// 事前指定の関連記事設定
// 下記の<script>を投稿内に設定してください。
// 最大数(max)以上設定している場合、配列の先頭から順に最大数分表示します。
// 最大数(max)未満設定している場合、配列の先頭から順に表示し、それ以降を関連度順に表示します。
// #related-posts-data-jsonの設定がページ内に存在しない場合、関連度順に表示します。
// <script>の記載が難しい場合、<div hidden>などで対応できないか検討ください。
// 補足：url, title は、必須項目です
// 補足：visible は、 default=true です
<script type='application/json' id='related-posts-data-json'>
[
   {"visible": false, "url": "https://.../page1.html", "title": "title1"}
  ,{"visible": true, "url": "https://.../page2.html", "title": "title2", "thumbnail": "thumbnail URL"}
  , ...
]
</script>
-->*/
