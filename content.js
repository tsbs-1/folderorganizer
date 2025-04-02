(function() {
  // デバッグ用のフラグ
  const DEBUG = true;
  
  // 接続状態を追跡する変数
  let isInitialized = false;
  
  // デバッグログ関数
  function debugLog(...args) {
    if (DEBUG) {
      console.log('[Gmail Organizer]', ...args);
    }
  }
  
  // メッセージリスナーを設定
  function setupMessageListener() {
    try {
      // 既存のリスナーを削除（重複防止）
      chrome.runtime.onMessage.removeListener(messageHandler);
      // 新しいリスナーを追加
      chrome.runtime.onMessage.addListener(messageHandler);
      debugLog('メッセージリスナーが設定されました');
      return true;
    } catch (error) {
      console.error('メッセージリスナー設定エラー:', error);
      return false;
    }
  }
  
  // メッセージハンドラー関数
  function messageHandler(request, sender, sendResponse) {
    debugLog('Gmailでメッセージを受信:', request);
    
    // コンテンツスクリプトが初期化されていない場合は初期化
    if (!isInitialized) {
      initialize();
    }
    
    try {
      if (request.action === 'createLabel') {
        debugLog('ラベル作成リクエストを処理します:', request.companyName, request.emailDomain);
        
        // ラベル作成を試みる
        try {
          createGmailLabel(request.companyName, request.emailDomain, function(labelSuccess, labelMessage) {
            debugLog('ラベル作成結果:', labelSuccess, labelMessage);
            
            if (!labelSuccess) {
              sendResponse({success: false, message: labelMessage || 'ラベル作成に失敗しました'});
              return;
            }
            
            // ラベル作成成功後にフィルタ作成
            try {
              createGmailFilter(request.companyName, request.emailDomain, function(filterSuccess, filterMessage) {
                debugLog('フィルタ作成結果:', filterSuccess, filterMessage);
                
                if (filterSuccess) {
                  sendResponse({success: true, message: 'ラベルとフィルタを作成しました'});
                } else {
                  sendResponse({success: false, message: filterMessage || 'フィルタ作成中にエラーが発生しました'});
                }
              });
            } catch (filterError) {
              console.error('フィルタ作成エラー:', filterError);
              sendResponse({success: false, message: filterError.message || 'フィルタ作成中に例外が発生しました'});
            }
          });
        } catch (labelError) {
          console.error('ラベル作成エラー:', labelError);
          sendResponse({success: false, message: labelError.message || 'ラベル作成中に例外が発生しました'});
        }
      } else if (request.action === 'removeLabel') {
        // ラベル削除機能
        debugLog('ラベル削除リクエストを受信しました（未実装）');
        sendResponse({success: false, message: '削除機能は実装されていません'});
      } else {
        // 不明なアクション
        debugLog('不明なアクションを受信:', request.action);
        sendResponse({success: false, message: '不明なアクションです: ' + request.action});
      }
    } catch (e) {
      console.error('メッセージ処理中の例外:', e);
      sendResponse({success: false, message: '処理中にエラーが発生しました: ' + e.message});
    }
    
    return true; // 非同期レスポンス用
  }
  
  // Gmailのラベルを作成する関数
  function createGmailLabel(companyName, emailDomain, callback) {
    debugLog('ラベル作成を開始します:', companyName);
    
    // Gmailの画面が完全に読み込まれていることを確認
    waitForGmailToLoad(function() {
      debugLog('Gmail UIが読み込まれました。ラベル作成を続行します');
      
      try {
        // ラベル作成用のボタンを探す
        const createLabelButton = findCreateLabelButton();
        
        if (createLabelButton) {
          debugLog('ラベル作成ボタンを見つけました:', createLabelButton);
          // ラベル作成ボタンをクリック
          createLabelButton.click();
          
          // 少し待ってからラベル名を入力
          setTimeout(function() {
            try {
              const labelNameInput = document.querySelector('input[placeholder="ラベル名を入力"]') || 
                                    document.querySelector('input[placeholder="Enter new label name"]') ||
                                    document.querySelector('input[placeholder*="label"]');
              
              debugLog('ラベル名入力フィールド:', labelNameInput);
              
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
                  
                  debugLog('ラベル作成確定ボタン:', createButton);
                  
                  if (createButton) {
                    createButton.click();
                    debugLog(`ラベル "${companyName}" を作成しました`);
                    // コールバックを呼び出し
                    if (callback) setTimeout(() => callback(true, `ラベル "${companyName}" を作成しました`), 1000);
                  } else {
                    debugLog('ラベル作成確定ボタンが見つかりません');
                    if (callback) callback(false, 'ラベル作成確定ボタンが見つかりません');
                  }
                }, 500);
              } else {
                debugLog('ラベル名入力フィールドが見つかりません');
                if (callback) callback(false, 'ラベル名入力フィールドが見つかりません');
              }
            } catch (inputError) {
              console.error('ラベル名入力エラー:', inputError);
              if (callback) callback(false, 'ラベル名入力中にエラーが発生しました: ' + inputError.message);
            }
          }, 1000);
        } else {
          debugLog('ラベル作成ボタンが見つかりませんでした');
          if (callback) callback(false, 'Gmailのラベル作成ボタンが見つかりません。Gmailの左サイドバーからラベルメニューを開いてください。');
        }
      } catch (error) {
        console.error('ラベル作成処理中のエラー:', error);
        if (callback) callback(false, 'ラベル作成処理中にエラーが発生しました: ' + error.message);
      }
    });
  }
  
  // Gmailのフィルタを作成する関数
  function createGmailFilter(companyName, emailDomain, callback) {
    debugLog('フィルタ作成を開始します:', emailDomain);
    
    // Gmailの画面が完全に読み込まれていることを確認
    waitForGmailToLoad(function() {
      debugLog('Gmail UIが読み込まれました。フィルタ作成を続行します');
      
      try {
        // フィルタ作成ボタンを探す
        const filterButton = findCreateFilterButton();
        debugLog('フィルタボタン検索結果:', filterButton);
        
        if (filterButton) {
          filterButton.click();
          debugLog('フィルタボタンをクリックしました');
          
          // 少し待ってからフィルタ条件を入力
          setTimeout(function() {
            try {
              const fromInput = document.querySelector('input[placeholder="From"]') ||
                               document.querySelector('input[placeholder="差出人"]') ||
                               document.querySelector('input[aria-label*="From"]');
              
              debugLog('差出人入力フィールド:', fromInput);
              
              if (fromInput) {
                fromInput.value = `@${emailDomain}`;
                
                // 入力イベントをトリガー
                const inputEvent = new Event('input', { bubbles: true });
                fromInput.dispatchEvent(inputEvent);
                
                // 次へボタンをクリック
                setTimeout(function() {
                  try {
                    const nextButton = [...document.querySelectorAll('button')].find(button => 
                      button.textContent.includes('次へ') || button.textContent.includes('Next') ||
                      button.textContent.includes('Create filter')
                    );
                    
                    debugLog('次へボタン:', nextButton);
                    
                    if (nextButton) {
                      nextButton.click();
                      debugLog('次へボタンをクリックしました');
                      
                      // フィルタアクションを設定
                      setTimeout(function() {
                        try {
                          // ラベルを適用するチェックボックスを見つける
                          const applyLabelCheckbox = [...document.querySelectorAll('input[type="checkbox"]')].find(checkbox => {
                            const label = checkbox.closest('div').textContent;
                            return label.includes('ラベルを付ける') || label.includes('Apply label');
                          });
                          
                          debugLog('ラベル適用チェックボックス:', applyLabelCheckbox);
                          
                          if (applyLabelCheckbox && !applyLabelCheckbox.checked) {
                            applyLabelCheckbox.click();
                            debugLog('ラベル適用チェックボックスをクリックしました');
                          }
                          
                          // ラベル選択ドロップダウンを開く
                          setTimeout(function() {
                            try {
                              const labelDropdown = document.querySelector('[role="combobox"]');
                              debugLog('ラベルドロップダウン:', labelDropdown);
                              
                              if (labelDropdown) {
                                labelDropdown.click();
                                debugLog('ラベルドロップダウンをクリックしました');
                                
                                // ラベルを選択
                                setTimeout(function() {
                                  try {
                                    const labelOptions = [...document.querySelectorAll('[role="option"]')];
                                    const companyLabel = labelOptions.find(option => 
                                      option.textContent.trim() === companyName
                                    );
                                    
                                    debugLog('ラベルオプション数:', labelOptions.length);
                                    debugLog('ラベル検索結果:', companyLabel);
                                    
                                    if (companyLabel) {
                                      companyLabel.click();
                                      debugLog(`ラベル "${companyName}" を選択しました`);
                                      
                                      // フィルタ作成ボタンをクリック
                                      setTimeout(function() {
                                        try {
                                          const createFilterButton = [...document.querySelectorAll('button')].find(button => 
                                            button.textContent.includes('フィルタを作成') || button.textContent.includes('Create filter')
                                          );
                                          
                                          debugLog('フィルタ作成ボタン:', createFilterButton);
                                          
                                          if (createFilterButton) {
                                            createFilterButton.click();
                                            debugLog(`ドメイン "${emailDomain}" のフィルタを作成しました`);
                                            if (callback) callback(true, `ドメイン "${emailDomain}" のフィルタを作成しました`);
                                          } else {
                                            debugLog('フィルタ作成ボタンが見つかりません');
                                            if (callback) callback(false, 'フィルタ作成ボタンが見つかりません');
                                          }
                                        } catch (btnError) {
                                          console.error('フィルタ作成ボタンエラー:', btnError);
                                          if (callback) callback(false, 'フィルタ作成ボタン処理中にエラーが発生しました: ' + btnError.message);
                                        }
                                      }, 500);
                                    } else {
                                      debugLog(`ラベル "${companyName}" が見つかりませんでした`);
                                      if (callback) callback(false, `ラベル "${companyName}" が見つかりません。ラベルが作成されているか確認してください。`);
                                    }
                                  } catch (optionError) {
                                    console.error('ラベルオプション選択エラー:', optionError);
                                    if (callback) callback(false, 'ラベル選択中にエラーが発生しました: ' + optionError.message);
                                  }
                                }, 500);
                              } else {
                                debugLog('ラベルドロップダウンが見つかりません');
                                if (callback) callback(false, 'ラベルドロップダウンが見つかりません');
                              }
                            } catch (dropdownError) {
                              console.error('ドロップダウンエラー:', dropdownError);
                              if (callback) callback(false, 'ドロップダウン処理中にエラーが発生しました: ' + dropdownError.message);
                            }
                          }, 500);
                        } catch (checkboxError) {
                          console.error('チェックボックスエラー:', checkboxError);
                          if (callback) callback(false, 'チェックボックス処理中にエラーが発生しました: ' + checkboxError.message);
                        }
                      }, 1000);
                    } else {
                      debugLog('次へボタンが見つかりません');
                      if (callback) callback(false, '次へボタンが見つかりません');
                    }
                  } catch (nextError) {
                    console.error('次へボタンエラー:', nextError);
                    if (callback) callback(false, '次へボタン処理中にエラーが発生しました: ' + nextError.message);
                  }
                }, 500);
              } else {
                debugLog('差出人入力フィールドが見つかりません');
                if (callback) callback(false, '差出人入力フィールドが見つかりません');
              }
            } catch (inputError) {
              console.error('差出人入力エラー:', inputError);
              if (callback) callback(false, '差出人入力中にエラーが発生しました: ' + inputError.message);
            }
          }, 1000);
        } else {
          debugLog('フィルタ作成ボタンが見つかりませんでした');
          if (callback) callback(false, 'フィルタ作成ボタンが見つかりません。Gmailの設定メニューを開いてください。');
        }
      } catch (error) {
        console.error('フィルタ作成処理中のエラー:', error);
        if (callback) callback(false, 'フィルタ作成処理中にエラーが発生しました: ' + error.message);
      }
    });
  }
  
  // Gmailが完全に読み込まれるのを待つ関数
  function waitForGmailToLoad(callback) {
    debugLog('Gmailの読み込みを待機中...');
    
    // ロード状態を確認するための要素
    const checkForGmail = function() {
      // Gmailの読み込みを表す何らかの要素をチェック（複数の候補を用意）
      const gmailLoaded = document.querySelector('div[role="navigation"]') || 
                          document.querySelector('div[role="banner"]') ||
                          document.querySelector('div[aria-label="Main menu"]');
      
      if (gmailLoaded) {
        debugLog('Gmail UIが読み込まれました');
        callback();
      } else {
        // まだ読み込まれていない場合は再試行
        debugLog('Gmail UIがまだ読み込まれていません、再試行します...');
        setTimeout(checkForGmail, 500);
      }
    };
    
    checkForGmail();
  }
  
  // ラベル作成ボタンを探す関数
  function findCreateLabelButton() {
    debugLog('ラベル作成ボタンを探しています...');
    
    // 方法1: 直接ボタンを探す
    const directButton = [...document.querySelectorAll('button')].find(button => {
      const text = button.textContent.trim();
      return text.includes('新しいラベルを作成') || 
             text.includes('Create new label') || 
             text.includes('ラベルを作成');
    });
    
    if (directButton) {
      debugLog('直接ラベル作成ボタンを見つけました');
      return directButton;
    }
    
    // 方法2: サイドバーのラベルセクションを探す
    const sidebarItems = [...document.querySelectorAll('div[role="navigation"] div[role="tree"] div[role="treeitem"]')];
    const labelItem = sidebarItems.find(item => 
      item.textContent.includes('ラベル') || item.textContent.includes('Labels')
    );
    
    if (labelItem) {
      debugLog('サイドバーのラベルセクションを見つけました');
      // クリックしてメニューを開く
      labelItem.click();
      
      // 少し待ってからボタンを探す
      return new Promise(resolve => {
        setTimeout(() => {
          const createLabelBtn = [...document.querySelectorAll('button')].find(button => {
            const text = button.textContent.trim();
            return text.includes('新しいラベルを作成') || 
                   text.includes('Create new label') || 
                   text.includes('ラベルを作成');
          });
          
          debugLog('ラベルメニューを開いた後のボタン検索結果:', createLabelBtn);
          resolve(createLabelBtn);
        }, 500);
      });
    }
    
    // どちらの方法でも見つからない場合
    debugLog('ラベル作成ボタンが見つかりませんでした');
    return null;
  }
  
  // フィルタ作成ボタンを探す関数
  function findCreateFilterButton() {
    debugLog('フィルタ作成ボタンを探しています...');
    
    try {
      // 方法1: 設定メニューを探す
      const settingsMenu = document.querySelector('div[aria-label="設定"]') || 
                           document.querySelector('div[aria-label="Settings"]') ||
                           document.querySelector('div[aria-label*="ettings"]');
      
      if (settingsMenu) {
        debugLog('設定メニューを見つけました');
        // 設定メニューをクリック
        settingsMenu.click();
        
        // メニューが開くのを少し待つ
        return new Promise(resolve => {
          setTimeout(() => {
            // フィルタ設定のメニュー項目を探す
            const menuItems = [...document.querySelectorAll('div[role="menuitem"]')];
            debugLog('メニュー項目数:', menuItems.length);
            
            const filterOption = menuItems.find(item => 
              item.textContent.includes('フィルタと受信拒否設定') || 
              item.textContent.includes('Filters and Blocked Addresses') ||
              item.textContent.includes('Filter')
            );
            
            debugLog('フィルタオプション検索結果:', filterOption);
            
            if (filterOption) {
              resolve(filterOption);
            } else {
              // 設定メニューを閉じる
              document.body.click();
              // 従来の方法を試す
              const filterButtons = fallbackFindFilterButtons();
              resolve(filterButtons[0] || null);
            }
          }, 500);
        });
      } else {
        debugLog('設定メニューが見つかりませんでした、従来の方法を試します');
        // 従来の方法を試す
        const filterButtons = fallbackFindFilterButtons();
        return filterButtons[0] || null;
      }
    } catch (error) {
      console.error('フィルタボタン検索エラー:', error);
      return null;
    }
  }
  
  // フィルタボタンを探す従来の方法
  function fallbackFindFilterButtons() {
    debugLog('従来の方法でフィルタボタンを探しています...');
    
    // テキストでボタンを探す
    const filterButtons = [...document.querySelectorAll('button')].filter(button => {
      const text = button.textContent.trim();
      return text.includes('フィルタ') || text.includes('Filter');
    });
    
    debugLog('従来の方法で見つかったフィルタボタン:', filterButtons.length);
    return filterButtons;
  }
  
  // 初期化関数
  function initialize() {
    debugLog('Gmail Folder Organizer のコンテンツスクリプトを初期化しています...');
    
    // メッセージリスナーを設定
    const listenerSetup = setupMessageListener();
    
    // バックグラウンドスクリプトとの接続を確立
    try {
      const port = chrome.runtime.connect({ name: "gmail-content" });
      port.onDisconnect.addListener(function() {
        debugLog('バックグラウンドとの接続が切断されました');
        // 再接続を試みる
        setTimeout(() => {
          debugLog('バックグラウンドとの再接続を試みます');
          initialize();
        }, 1000);
      });
      
      isInitialized = true;
      debugLog('コンテンツスクリプトが初期化されました');
    } catch (e) {
      console.error('バックグラウンドとの接続エラー:', e);
    }
    
    // ページの変更を監視（Gmailは単一ページアプリケーションなので）
    const observer = new MutationObserver(function(mutations) {
      // このコメントを残して実装を省略
    });
    
    // ページ全体を監視
    observer.observe(document.body, { childList: true, subtree: true });
    
    return isInitialized;
  }
  
  // コンテンツスクリプトの実行開始
  debugLog('コンテンツスクリプトの読み込みを開始しました');
  
  // DOMが読み込まれたら初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      debugLog('DOMContentLoaded イベントが発生しました');
      setTimeout(initialize, 1000); // Gmail UIがロードされるまで少し待つ
    });
  } else {
    debugLog('DOMは既に読み込まれています、初期化を開始します');
    setTimeout(initialize, 1000);
  }
  
  // 外部からアクセス可能なインターフェースを提供（デバッグ用）
  window.gmailOrganizer = {
    initialize: initialize,
    findCreateLabelButton: findCreateLabelButton,
    findCreateFilterButton: findCreateFilterButton,
    createGmailLabel: createGmailLabel,
    createGmailFilter: createGmailFilter
  };
})();