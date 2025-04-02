// バックグラウンドスクリプト
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('バックグラウンドスクリプトでメッセージを受信:', request);
    
    if (request.action === 'sendToGmail') {
      // Gmailタブを検索
      chrome.tabs.query({url: 'https://mail.google.com/*'}, function(tabs) {
        if (tabs.length > 0) {
          // Gmailタブが見つかった場合、そのタブにメッセージを送信
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'createLabel',
            companyName: request.companyName,
            emailDomain: request.emailDomain
          }, function(response) {
            // レスポンスをポップアップに転送
            sendResponse(response);
          });
        } else {
          // Gmailタブが見つからない場合
          sendResponse({success: false, message: 'Gmailが開かれていません'});
        }
      });
      
      return true; // 非同期レスポンス用
    }
  });
  
  // 拡張機能がインストールまたは更新されたときの処理
  chrome.runtime.onInstalled.addListener(function() {
    console.log('Gmail Folder Organizer がインストールされました');
  });