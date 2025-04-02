document.addEventListener('DOMContentLoaded', function() {
  const addDomainButton = document.getElementById('addDomain');
  const companyNameInput = document.getElementById('companyName');
  const emailDomainInput = document.getElementById('emailDomain');
  const statusDiv = document.getElementById('status');
  const domainListDiv = document.getElementById('domainList');
  
  // デバッグ用のフラグ
  const DEBUG = true;
  
  // デバッグログ関数
  function debugLog(...args) {
    if (DEBUG) {
      console.log('[Gmail Organizer Popup]', ...args);
    }
  }
  
  // 保存されたドメイン情報を読み込む
  loadDomains();
  debugLog('ポップアップが初期化されました');
  
  // 拡張機能の準備状態を確認
  checkExtensionStatus();
  
  // ドメイン追加ボタンのクリックイベント
  addDomainButton.addEventListener('click', function() {
    debugLog('追加ボタンがクリックされました');
    
    const companyName = companyNameInput.value.trim();
    const emailDomain = emailDomainInput.value.trim();
    
    if (companyName === '' || emailDomain === '') {
      showStatus('会社名とメールドメインを入力してください', 'error');
      return;
    }
    
    // ドメインのバリデーション
    if (!isValidDomain(emailDomain)) {
      showStatus('有効なドメイン形式を入力してください', 'error');
      return;
    }
    
    // 処理中の状態を表示
    showStatus('処理中...', 'processing');
    
    // Gmailタブが開いているか確認
    chrome.tabs.query({url: 'https://mail.google.com/*'}, function(tabs) {
      if (tabs.length === 0) {
        showStatus('Gmailが開かれていません。Gmailを開いた状態で再度お試しください。', 'error');
        return;
      }
      
      debugLog('Gmailタブが見つかりました:', tabs[0].id);
      
      // ドメイン情報を保存
      saveDomain(companyName, emailDomain, function(saveSuccess) {
        if (!saveSuccess) {
          // 保存に失敗した場合はここで終了
          return;
        }
        
        // バックグラウンドスクリプトにメッセージを送信
        debugLog('バックグラウンドにメッセージを送信します');
        
        try {
          chrome.runtime.sendMessage({
            action: 'sendToGmail',
            companyName: companyName,
            emailDomain: emailDomain
          }, function(response) {
            debugLog('バックグラウンドからのレスポンス:', response);
            
            if (chrome.runtime.lastError) {
              console.error('通信エラー:', chrome.runtime.lastError);
              showStatus('通信エラーが発生しました: ' + chrome.runtime.lastError.message, 'error');
              return;
            }
            
            if (response && response.success) {
              showStatus('ラベルとフィルタを作成しました', 'success');
              // 成功したら入力フィールドをクリア
              companyNameInput.value = '';
              emailDomainInput.value = '';
            } else {
              const errorMsg = response ? response.message : 'ラベル作成に失敗しました';
              showStatus(errorMsg, 'error');
            }
          });
        } catch (e) {
          console.error('メッセージ送信エラー:', e);
          showStatus('メッセージ送信中にエラーが発生しました: ' + e.message, 'error');
        }
      });
    });
  });
  
  // 拡張機能の状態をチェックする関数
  function checkExtensionStatus() {
    debugLog('拡張機能の状態をチェックしています...');
    
    try {
      // バックグラウンドとの通信をテスト
      chrome.runtime.sendMessage({action: 'ping'}, function(response) {
        if (chrome.runtime.lastError) {
          console.warn('バックグラウンドとの通信テストに失敗しました:', chrome.runtime.lastError);
          showStatus('拡張機能の状態が不安定です。ブラウザを再起動してください。', 'error', 5000);
        } else {
          debugLog('バックグラウンドとの通信テスト成功');
        }
      });
      
      // Gmailタブの存在を確認
      chrome.tabs.query({url: 'https://mail.google.com/*'}, function(tabs) {
        if (tabs.length === 0) {
          showStatus('Gmailが開かれていません。別のタブでGmailを開いてください。', 'warning', 5000);
        } else {
          debugLog('Gmailタブが見つかりました:', tabs[0].id);
        }
      });
    } catch (e) {
      console.error('拡張機能状態チェックエラー:', e);
    }
  }
  
  // ドメイン情報を保存する関数
  function saveDomain(companyName, emailDomain, callback) {
    debugLog('ドメイン情報を保存します:', companyName, emailDomain);
    
    chrome.storage.sync.get({domains: []}, function(data) {
      // すでに同じドメインが登録されていないかチェック
      const domainExists = data.domains.some(domain => domain.email === emailDomain);
      
      if (domainExists) {
        showStatus('このドメインは既に登録されています', 'error');
        if (callback) callback(false);
        return;
      }
      
      // 新しいドメインを追加
      const newDomains = [...data.domains, {company: companyName, email: emailDomain}];
      
      chrome.storage.sync.set({domains: newDomains}, function() {
        if (chrome.runtime.lastError) {
          console.error('ドメイン保存エラー:', chrome.runtime.lastError);
          showStatus('ドメイン情報の保存に失敗しました: ' + chrome.runtime.lastError.message, 'error');
          if (callback) callback(false);
          return;
        }
        
        debugLog('ドメイン情報が保存されました');
        showStatus('ドメインを登録しました', 'success');
        loadDomains(); // ドメイン一覧を更新
        if (callback) callback(true);
      });
    });
  }
  
  // 保存されたドメイン情報を読み込む関数
  function loadDomains() {
    debugLog('保存されたドメイン情報を読み込みます');
    
    chrome.storage.sync.get({domains: []}, function(data) {
      if (chrome.runtime.lastError) {
        console.error('ドメイン読み込みエラー:', chrome.runtime.lastError);
        domainListDiv.innerHTML = '<p>ドメイン情報の読み込みに失敗しました</p>';
        return;
      }
      
      domainListDiv.innerHTML = '';
      
      if (data.domains.length === 0) {
        domainListDiv.innerHTML = '<p>登録されたドメインはありません</p>';
        return;
      }
      
      debugLog('ドメイン情報が読み込まれました:', data.domains.length);
      
      data.domains.forEach(function(domain, index) {
        const domainItem = document.createElement('div');
        domainItem.className = 'domain-item';
        
        const domainInfo = document.createElement('div');
        
        const domainName = document.createElement('div');
        domainName.className = 'domain-name';
        domainName.textContent = domain.company;
        
        const domainEmail = document.createElement('div');
        domainEmail.className = 'domain-email';
        domainEmail.textContent = domain.email;
        
        domainInfo.appendChild(domainName);
        domainInfo.appendChild(domainEmail);
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-btn';
        removeButton.textContent = '削除';
        removeButton.dataset.index = index;
        removeButton.addEventListener('click', function() {
          removeDomain(index);
        });
        
        domainItem.appendChild(domainInfo);
        domainItem.appendChild(removeButton);
        
        domainListDiv.appendChild(domainItem);
      });
    });
  }
  
  // ドメインを削除する関数
  function removeDomain(index) {
    debugLog('ドメインを削除します:', index);
    
    chrome.storage.sync.get({domains: []}, function(data) {
      if (chrome.runtime.lastError) {
        console.error('ドメイン読み込みエラー:', chrome.runtime.lastError);
        showStatus('ドメイン情報の読み込みに失敗しました', 'error');
        return;
      }
      
      if (index >= data.domains.length) {
        showStatus('無効なドメインインデックスです', 'error');
        return;
      }
      
      const removedDomain = data.domains[index];
      const newDomains = data.domains.filter((_, i) => i !== index);
      
      chrome.storage.sync.set({domains: newDomains}, function() {
        if (chrome.runtime.lastError) {
          console.error('ドメイン削除エラー:', chrome.runtime.lastError);
          showStatus('ドメイン情報の削除に失敗しました', 'error');
          return;
        }
        
        debugLog('ドメインが削除されました:', removedDomain);
        showStatus(`${removedDomain.company} (${removedDomain.email}) を削除しました`, 'success');
        loadDomains(); // ドメイン一覧を更新
        
        // バックグラウンドスクリプトにメッセージを送信
        try {
          chrome.runtime.sendMessage({
            action: 'sendToGmail',
            companyName: removedDomain.company,
            emailDomain: removedDomain.email,
            subAction: 'removeLabel'
          }, function(response) {
            // 削除のレスポンスは無視してもOK
            if (chrome.runtime.lastError) {
              console.error('削除通信エラー:', chrome.runtime.lastError);
              // ここではユーザーに表示せず、サイレントに失敗を許容
            }
          });
        } catch (e) {
          console.error('削除メッセージ送信エラー:', e);
          // ユーザーに表示せず、サイレントに失敗を許容
        }
      });
    });
  }
  
  // ステータスメッセージを表示する関数
  function showStatus(message, type, duration = 3000) {
    debugLog('ステータス表示:', message, type);
    
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    if (type !== 'processing') {
      setTimeout(function() {
        statusDiv.style.display = 'none';
      }, duration);
    }
  }
  
  // ドメインのバリデーション
  function isValidDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    return domainRegex.test(domain);
  }
});