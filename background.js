// バックグラウンドスクリプト
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('バックグラウンドスクリプトでメッセージを受信:', request);
  
  if (request.action === 'sendToGmail') {
    // Gmailタブを検索
    chrome.tabs.query({url: 'https://mail.google.com/*'}, function(tabs) {
      if (tabs.length > 0) {
        // Gmailタブが見つかった場合、最初にコンテンツスクリプトが適切に挿入されているか確認
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: () => {
            return typeof chrome.runtime.onMessage !== 'undefined';
          }
        }).then(results => {
          if (results[0] && results[0].result) {
            // コンテンツスクリプトは動作中なのでメッセージを送信
            let action = 'createLabel';
            if (request.subAction === 'removeLabel') {
              action = 'removeLabel';
            }
            
            chrome.tabs.sendMessage(tabs[0].id, {
              action: action,
              companyName: request.companyName,
              emailDomain: request.emailDomain
            }, function(response) {
              // レスポンスをポップアップに転送
              if (chrome.runtime.lastError) {
                console.error('タブとの通信エラー:', chrome.runtime.lastError);
                sendResponse({success: false, message: 'Gmailページとの通信に失敗しました。ページを再読み込みしてください。'});
              } else {
                sendResponse(response || {success: true});
              }
            });
          } else {
            // コンテンツスクリプトが見つからない場合、手動で挿入
            console.log('コンテンツスクリプトを挿入します');
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['content.js']
            }).then(() => {
              // 少し待ってからメッセージを送信
              setTimeout(() => {
                let action = 'createLabel';
                if (request.subAction === 'removeLabel') {
                  action = 'removeLabel';
                }
                
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: action,
                  companyName: request.companyName,
                  emailDomain: request.emailDomain
                }, function(response) {
                  if (chrome.runtime.lastError) {
                    console.error('タブとの通信エラー:', chrome.runtime.lastError);
                    sendResponse({success: false, message: 'Gmailページとの通信に失敗しました。ページを再読み込みしてください。'});
                  } else {
                    sendResponse(response || {success: true});
                  }
                });
              }, 500);
            }).catch(err => {
              console.error('スクリプト挿入エラー:', err);
              sendResponse({success: false, message: 'コンテンツスクリプトの挿入に失敗しました。ページを再読み込みしてください。'});
            });
          }
        }).catch(err => {
          console.error('スクリプト実行チェックエラー:', err);
          sendResponse({success: false, message: 'Gmailページのチェックに失敗しました。ページを再読み込みしてください。'});
        });
      } else {
        // Gmailタブが見つからない場合
        sendResponse({success: false, message: 'Gmailが開かれていません。Gmailを開いてから再試行してください。'});
      }
    });
    
    return true; // 非同期レスポンス用
  }
});

// 拡張機能がインストールまたは更新されたときの処理
chrome.runtime.onInstalled.addListener(function() {
  console.log('Gmail Folder Organizer がインストールされました');
});