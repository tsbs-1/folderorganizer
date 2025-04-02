// バックグラウンドスクリプト
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('バックグラウンドスクリプトでメッセージを受信:', request);
  
  // ping要求に応答
  if (request.action === 'ping') {
    console.log('ping要求を受信しました');
    sendResponse({success: true, message: 'pong'});
    return true;
  }
  
  if (request.action === 'sendToGmail') {
    // Gmailタブを検索
    chrome.tabs.query({url: 'https://mail.google.com/*'}, function(tabs) {
      if (tabs.length > 0) {
        // console.logでエラー解決のためのデバッグ情報を追加
        console.log('Gmailタブが見つかりました:', tabs[0].id, tabs[0].url);
        
        // 直接コンテンツスクリプトを挿入
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }).then(() => {
          console.log('コンテンツスクリプトが挿入されました');
          
          // 少し待ってからメッセージを送信（コンテンツスクリプトの初期化を待つ）
          setTimeout(() => {
            let action = 'createLabel';
            if (request.subAction === 'removeLabel') {
              action = 'removeLabel';
            }
            
            try {
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  action: action,
                  companyName: request.companyName,
                  emailDomain: request.emailDomain
                },
                function(response) {
                  // エラーオブジェクトの詳細をログに出力
                  if (chrome.runtime.lastError) {
                    console.error('タブとの通信エラーの詳細:', JSON.stringify(chrome.runtime.lastError));
                    sendResponse({
                      success: false, 
                      message: `Gmailページとの通信に失敗しました: ${chrome.runtime.lastError.message || '不明なエラー'}`
                    });
                  } else {
                    console.log('タブからのレスポンス:', response);
                    sendResponse(response || {success: true});
                  }
                }
              );
            } catch (err) {
              console.error('メッセージ送信中の例外:', err);
              sendResponse({
                success: false, 
                message: `メッセージ送信中にエラーが発生しました: ${err.message}`
              });
            }
          }, 1000); // タイムアウトを1秒に延長
        }).catch(err => {
          console.error('スクリプト挿入エラーの詳細:', err);
          sendResponse({
            success: false, 
            message: `コンテンツスクリプトの挿入に失敗しました: ${err.message}`
          });
        });
      } else {
        // Gmailタブが見つからない場合
        console.warn('Gmailタブが見つかりませんでした');
        sendResponse({
          success: false, 
          message: 'Gmailが開かれていません。Gmailを開いてから再試行してください。'
        });
      }
    });
    
    return true; // 非同期レスポンス用
  }
});

// 拡張機能がインストールまたは更新されたときの処理
chrome.runtime.onInstalled.addListener(function() {
  console.log('Gmail Folder Organizer がインストールされました');
  
  // 初期化時に既存のGmailタブにコンテンツスクリプトを挿入
  chrome.tabs.query({url: 'https://mail.google.com/*'}, function(tabs) {
    if (tabs.length > 0) {
      console.log('既存のGmailタブにコンテンツスクリプトを挿入します');
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      }).catch(err => {
        console.error('初期化時のスクリプト挿入エラー:', err);
      });
    }
  });
});