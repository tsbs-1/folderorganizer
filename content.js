(function() {
  // 接続状態を追跡する変数
  let isInitialized = false;
  
  // メッセージリスナーを設定
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Gmailでメッセージを受信:', request);
    
    // コンテンツスクリプトが初期化されていない場合は初期化
    if (!isInitialized) {
      initialize();
    }
    
    if (request.action === 'createLabel') {
      try {
        createGmailLabel(request.companyName, request.emailDomain, function() {
          // ラベル作成後にフィルタ作成を実行
          createGmailFilter(request.companyName, request.emailDomain, function(success, message) {
            if (success) {
              sendResponse({success: true});
            } else {
              sendResponse({success: false, message: message || 'フィルタ作成中にエラーが発生しました'});
            }
          });
        });
      } catch (error) {
        console.error('ラベル作成エラー:', error);
        sendResponse({success: false, message: error.message || 'ラベル作成中にエラーが発生しました'});
      }
    } else if (request.action === 'removeLabel') {
      // ラベル削除機能
      // 注: 現在は実装されていません
      console.log('ラベル削除は現在実装されていません');
      sendResponse({success: false, message: '削除機能は実装されていません'});
    }
    
    return true; // 非同期レスポンス用
  });
  
  // Gmailのラベルを作成する関数
  function createGmailLabel(companyName, emailDomain, callback) {
    // Gmailの画面が完全に読み込まれていることを確認
    waitForGmailToLoad(function() {
      // ラベル作成用のボタンを探す
      const createLabelButton = findCreateLabelButton();
      
      if (createLabelButton) {
        // ラベル作成ボタンをクリック
        createLabelButton.click();
        
        // 少し待ってからラベル名を入力
        setTimeout(function() {
          const labelNameInput = document.querySelector('input[placeholder="ラベル名を入力"]') || 
                                document.querySelector('input[placeholder="Enter new label name"]');
          
          if (labelNameInput) {
            labelNameInput.value = companyName;
            
            // 入力イベントをトリガー
            const inputEvent = new Event('input', { bubbles: true });
            labelNameInput.dispatchEvent(inputEvent);
            
            // 作成ボタンをクリック
            setTimeout(function() {
              const createButton = [...document.querySelectorAll('button')].find(button => 
                button.textContent.includes('作成') || button.textContent.includes('Create')
              );
              
              if (createButton) {
                createButton.click();
                console.log(`ラベル "${companyName}" を作成しました`);
                // コールバックを呼び出し
                if (callback) setTimeout(callback, 1000);
              } else {
                throw new Error('ラベル作成ボタンが見つかりません');
              }
            }, 500);
          } else {
            throw new Error('ラベル名入力フィールドが見つかりません');
          }
        }, 1000);
      } else {
        console.warn('ラベル作成ボタンが見つかりませんでした');
        throw new Error('Gmailのラベル作成ボタンが見つかりません。Gmailの画面を開いてください。');
      }
    });
  }
  
  // Gmailのフィルタを作成する関数
  function createGmailFilter(companyName, emailDomain, callback) {
    // Gmailの画面が完全に読み込まれていることを確認
    waitForGmailToLoad(function() {
      // フィルタ作成ボタンを探し、クリック
      const filterButton = findCreateFilterButton();
      
      if (filterButton) {
        filterButton.click();
        
        // 少し待ってからフィルタ条件を入力
        setTimeout(function() {
          const fromInput = document.querySelector('input[placeholder="From"]') ||
                            document.querySelector('input[placeholder="差出人"]');
          
          if (fromInput) {
            fromInput.value = `@${emailDomain}`;
            
            // 入力イベントをトリガー
            const inputEvent = new Event('input', { bubbles: true });
            fromInput.dispatchEvent(inputEvent);
            
            // 次へボタンをクリック
            setTimeout(function() {
              const nextButton = [...document.querySelectorAll('button')].find(button => 
                button.textContent.includes('次へ') || button.textContent.includes('Next') ||
                button.textContent.includes('Create filter')
              );
              
              if (nextButton) {
                nextButton.click();
                
                // フィルタアクションを設定
                setTimeout(function() {
                  // ラベルを適用するチェックボックスを見つける
                  const applyLabelCheckbox = [...document.querySelectorAll('input[type="checkbox"]')].find(checkbox => {
                    const label = checkbox.closest('div').textContent;
                    return label.includes('ラベルを付ける') || label.includes('Apply label');
                  });
                  
                  if (applyLabelCheckbox && !applyLabelCheckbox.checked) {
                    applyLabelCheckbox.click();
                  }
                  
                  // ラベル選択ドロップダウンを開く
                  setTimeout(function() {
                    const labelDropdown = document.querySelector('[role="combobox"]');
                    if (labelDropdown) {
                      labelDropdown.click();
                      
                      // ラベルを選択
                      setTimeout(function() {
                        const labelOptions = [...document.querySelectorAll('[role="option"]')];
                        const companyLabel = labelOptions.find(option => 
                          option.textContent.trim() === companyName
                        );
                        
                        if (companyLabel) {
                          companyLabel.click();
                          
                          // フィルタ作成ボタンをクリック
                          setTimeout(function() {
                            const createFilterButton = [...document.querySelectorAll('button')].find(button => 
                              button.textContent.includes('フィルタを作成') || button.textContent.includes('Create filter')
                            );
                            
                            if (createFilterButton) {
                              createFilterButton.click();
                              console.log(`ドメイン "${emailDomain}" のフィルタを作成しました`);
                              if (callback) callback(true);
                            } else {
                              if (callback) callback(false, 'フィルタ作成ボタンが見つかりません');
                            }
                          }, 500);
                        } else {
                          console.warn(`ラベル "${companyName}" が見つかりませんでした`);
                          if (callback) callback(false, `ラベル "${companyName}" が見つかりません`);
                        }
                      }, 500);
                    } else {
                      if (callback) callback(false, 'ラベルドロップダウンが見つかりません');
                    }
                  }, 500);
                }, 1000);
              } else {
                if (callback) callback(false, '次へボタンが見つかりません');
              }
            }, 500);
          } else {
            if (callback) callback(false, '差出人入力フィールドが見つかりません');
          }
        }, 1000);
      } else {
        console.warn('フィルタ作成ボタンが見つかりませんでした');
        if (callback) callback(false, 'フィルタ作成ボタンが見つかりません');
      }
    });
  }
  
  // Gmailが完全に読み込まれるのを待つ関数
  function waitForGmailToLoad(callback) {
    // ロード状態を確認するための要素（例：Gmailのヘッダー）
    const checkForGmail = function() {
      // Gmailの読み込みを表す何らかの要素をチェック
      const gmailLoaded = document.querySelector('div[role="navigation"]') || 
                          document.querySelector('div[role="banner"]');
      
      if (gmailLoaded) {
        callback();
      } else {
        // まだ読み込まれていない場合は再試行
        setTimeout(checkForGmail, 500);
      }
    };
    
    checkForGmail();
  }
  
  // ラベル作成ボタンを探す関数
  function findCreateLabelButton() {
    // Gmailの言語設定に応じて異なるテキストをチェック
    return [...document.querySelectorAll('button')].find(button => {
      const text = button.textContent.trim();
      return text.includes('新しいラベルを作成') || 
             text.includes('Create new label') || 
             text.includes('ラベルを作成');
    });
  }
  
  // フィルタ作成ボタンを探す関数
  function findCreateFilterButton() {
    // Gmailのツールバーのボタンを探す
    const settingsMenu = document.querySelector('[aria-label="設定"]') || 
                         document.querySelector('[aria-label="Settings"]');
    
    if (settingsMenu) {
      // 設定メニューをクリック
      settingsMenu.click();
      
      // メニューが開くのを少し待つ
      return new Promise(resolve => {
        setTimeout(() => {
          // フィルタ設定のメニュー項目を探す
          const filterOption = [...document.querySelectorAll('div[role="menuitem"]')].find(item => 
            item.textContent.includes('フィルタと受信拒否設定') || 
            item.textContent.includes('Filters and Blocked Addresses')
          );
          
          if (filterOption) {
            resolve(filterOption);
          } else {
            // 設定メニューを閉じる
            document.body.click();
            resolve(null);
          }
        }, 500);
      });
    }
    
    // 従来の方法（後方互換性のため）
    const filterButtons = [...document.querySelectorAll('button')].filter(button => {
      const text = button.textContent.trim();
      return text.includes('フィルタ') || text.includes('Filter');
    });
    
    return filterButtons[0]; // 最初のフィルタ関連ボタンを返す
  }
  
  // 初期化関数
  function initialize() {
    console.log('Gmail Folder Organizer のコンテンツスクリプトが初期化されました');
    
    // バックグラウンドスクリプトとの接続を確立
    try {
      chrome.runtime.connect({ name: "gmail-content" });
      isInitialized = true;
    } catch (e) {
      console.error('バックグラウンドとの接続エラー:', e);
    }
    
    // ページの変更を監視（Gmailは単一ページアプリケーションなので）
    const observer = new MutationObserver(function(mutations) {
      // ページの変更時にGmailが読み込まれたか確認するなどの処理をここに追加できます
    });
    
    // ページ全体を監視
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  // DOMが読み込まれたら初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initialize, 1000); // Gmail UIがロードされるまで少し待つ
    });
  } else {
    setTimeout(initialize, 1000);
  }
})();