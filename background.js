// バックグラウンドスクリプト
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('バックグラウンドスクリプトでメッセージを受信:', request);
  
  if (request.action === 'sendToGmail') {
    // Gmailタブを検索
    chrome.tabs.query({url: 'https://mail.google.com/*'}, function(tabs) {
      if (tabs.length > 0) {
        // Gmailタブが見つかった場合、そのタブにメッセージを送信
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