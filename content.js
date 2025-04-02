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
        // 現在のURLをチェック
        const isInSettingsPage = window.location.href.includes('/settings/') || 
                                window.location.href.includes('#settings') ||
                                window.location.href.includes('#label');
        
        debugLog('現在のページ:', window.location.href, '設定ページ:', isInSettingsPage);
        
        // ラベル作成用のボタンを探す
        const createLabelButtonPromise = findCreateLabelButton();
        
        // Promiseの場合とそうでない場合に対応
        const processButton = (createLabelButton) => {
          if (createLabelButton) {
            debugLog('ラベル作成ボタンを見つけました:', createLabelButton);
            // ラベル作成ボタンをクリック
            createLabelButton.click();
            
            // 少し待ってからラベル名を入力
            setTimeout(function() {
              try {
                  // 多様なセレクタを試す
                  let labelNameInput = document.querySelector('input[placeholder="ラベル名を入力"]') || 
                                        document.querySelector('input[placeholder="Enter new label name"]') ||
                                        document.querySelector('input[placeholder*="label"]') ||
                                        document.querySelector('input[name="name"]'); // 設定ページの場合

                  // 上記のセレクタで見つからない場合、より広い範囲で検索
                  if (!labelNameInput) {
                    debugLog('標準のセレクタでフィールドが見つかりませんでした。代替の方法を試します');
                    
                    // 新しいラベルダイアログに表示されるすべての入力フィールドを取得
                    const allInputs = document.querySelectorAll('input[type="text"]');
                    debugLog('テキスト入力フィールド数:', allInputs.length);
                    
                    // 「新しいラベル」ダイアログ内の最初の入力フィールドを探す
                    const labelDialog = [...document.querySelectorAll('div[role="dialog"]')].find(dialog => 
                      dialog.textContent.includes('新しいラベル') || 
                      dialog.textContent.includes('New label')
                    );
                    
                    if (labelDialog) {
                      debugLog('ラベルダイアログを見つけました');
                      const dialogInputs = labelDialog.querySelectorAll('input');
                      if (dialogInputs.length > 0) {
                        labelNameInput = dialogInputs[0]; // 最初の入力フィールドを使用
                        debugLog('ダイアログ内の入力フィールドを見つけました:', labelNameInput);
                      }
                    } else {
                      // ダイアログが見つからない場合、ページ内の最初のテキスト入力を試す（最後の手段）
                      if (allInputs.length > 0) {
                        labelNameInput = allInputs[0];
                        debugLog('フォールバック: 最初のテキスト入力を使用します:', labelNameInput);
                      }
                    }
                  }
                
                debugLog('ラベル名入力フィールド:', labelNameInput);
                
                if (labelNameInput) {
                  labelNameInput.value = companyName;
                  
                  // 入力イベントをトリガー
                  const inputEvent = new Event('input', { bubbles: true });
                  labelNameInput.dispatchEvent(inputEvent);
                  const changeEvent = new Event('change', { bubbles: true });
                  labelNameInput.dispatchEvent(changeEvent);
                  
                  // 作成ボタンをクリック
                  setTimeout(function() {
                    // 設定ページ用と通常のGmail UI用のボタン検索（より広範囲に）
                    let createButton = [...document.querySelectorAll('button, div[role="button"]')].find(button => 
                      button.textContent.includes('作成') || 
                      button.textContent.includes('Create') ||
                      (isInSettingsPage && (button.textContent === '作成' || button.textContent === 'Create'))
                    );

                    // ボタンが見つからない場合、ダイアログ内でより直接的に検索
                    if (!createButton) {
                      debugLog('標準の方法で作成ボタンが見つかりませんでした。代替の方法を試します');
                      
                      // ダイアログ内の全てのボタンを取得
                      const labelDialog = [...document.querySelectorAll('div[role="dialog"]')].find(dialog => 
                        dialog.textContent.includes('新しいラベル') || 
                        dialog.textContent.includes('New label')
                      );
                      
                      if (labelDialog) {
                        // ダイアログ内のボタンを探す（最後のボタンが通常「作成」）
                        const dialogButtons = [...labelDialog.querySelectorAll('button')];
                        debugLog('ダイアログ内のボタン数:', dialogButtons.length);
                        
                        if (dialogButtons.length > 0) {
                          // 「作成」ボタンを探す、または最後のボタンを使用
                          createButton = dialogButtons.find(btn => 
                            btn.textContent === '作成' || 
                            btn.textContent === 'Create'
                          ) || dialogButtons[dialogButtons.length - 1];
                          
                          debugLog('ダイアログ内の作成ボタン:', createButton);
                        }
                      }
                    }
                    
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
                  }, 1000);
                } else {
                  debugLog('ラベル名入力フィールドが見つかりません');
                  if (callback) callback(false, 'ラベル名入力フィールドが見つかりません');
                }
              } catch (inputError) {
                console.error('ラベル名入力エラー:', inputError);
                if (callback) callback(false, 'ラベル名入力中にエラーが発生しました: ' + inputError.message);
              }
            }, 1500); // 少し長めの待機時間
          } else {
            debugLog('ラベル作成ボタンが見つかりませんでした');
            
            // 設定ページに移動して再試行
            if (!isInSettingsPage) {
              debugLog('設定ページに移動して再試行します');
              window.location.href = 'https://mail.google.com/mail/u/0/#settings/labels';
              
              // 少し待ってから再実行
              setTimeout(() => {
                createGmailLabel(companyName, emailDomain, callback);
              }, 2500);
              return;
            }
            
            if (callback) callback(false, 'Gmailのラベル作成ボタンが見つかりません。Gmail設定から「ラベル」タブを開いてください。');
          }
        };
        
        // ボタンがPromiseの場合は処理
        if (createLabelButtonPromise instanceof Promise) {
          createLabelButtonPromise.then(processButton);
        } else {
          processButton(createLabelButtonPromise);
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
    
    // 方法1: 設定またはラベル設定ページにある場合
    // URLをチェックして設定ページかどうか確認
    const isInSettingsPage = window.location.href.includes('/settings/') || 
                            window.location.href.includes('#settings') ||
                            window.location.href.includes('#label');
    
    if (isInSettingsPage) {
      debugLog('設定ページまたはラベル設定ページを検出しました');
      
      // 新しいラベル作成ボタンをテキストで探す
      const settingsButton = [...document.querySelectorAll('button, div[role="button"]')].find(button => {
        const text = button.textContent.trim();
        return text === '新しいラベルを作成' || 
               text === 'Create new label' || 
               text.includes('新しいラベル') ||
               text.includes('new label');
      });
      
      if (settingsButton) {
        debugLog('設定ページでラベル作成ボタンを見つけました:', settingsButton);
        return settingsButton;
      }
      
      // フォームや入力を探す
      const createLabelForm = document.querySelector('input[placeholder="ラベル名を入力"]') || 
                             document.querySelector('input[placeholder="Enter new label name"]');
      
      if (createLabelForm) {
        debugLog('既にラベル作成フォームが開かれています');
        return null; // 既にフォームが開いているのでボタンは不要
      }
    }
    
    // 方法2: 直接ボタンを探す (任意のページ)
    const directButton = [...document.querySelectorAll('button, div[role="button"]')].find(button => {
      const text = button.textContent.trim();
      return text.includes('新しいラベルを作成') || 
             text.includes('Create new label') || 
             text.includes('ラベルを作成');
    });
    
    if (directButton) {
      debugLog('直接ラベル作成ボタンを見つけました');
      return directButton;
    }
    
    // 方法3: サイドバーのラベルセクションを探す
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
          const createLabelBtn = [...document.querySelectorAll('button, div[role="button"]')].find(button => {
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
    
    // 方法4: 設定ページに移動して試す
    debugLog('他の方法でボタンが見つからないため、設定ページに移動します');
    // ラベル設定ページに移動
    window.location.href = 'https://mail.google.com/mail/u/0/#settings/labels';
    
    return new Promise(resolve => {
      // ページが読み込まれるのを待つ
      setTimeout(() => {
        const settingsButton = [...document.querySelectorAll('button, div[role="button"]')].find(button => {
          const text = button.textContent.trim();
          return text === '新しいラベルを作成' || 
                 text === 'Create new label' || 
                 text.includes('新しいラベル') ||
                 text.includes('new label');
        });
        
        debugLog('設定ページ移動後のボタン検索結果:', settingsButton);
        resolve(settingsButton);
      }, 2000); // ページ読み込みのために少し長めに待つ
    });
  }
  
// フィルタ作成ボタンを探す関数
function findCreateFilterButton() {
  debugLog('フィルタ作成ボタンを探しています...');
  
  return new Promise(resolve => {
    try {
      // 現在のURLを確認
      const currentUrl = window.location.href;
      const isInboxPage = currentUrl.includes('#inbox') || !currentUrl.includes('#settings');
      const isFilterPage = currentUrl.includes('#settings/filters');
      
      debugLog('現在の状態: インボックスページ=', isInboxPage, '、フィルタページ=', isFilterPage);
      
      // フィルタ設定ページにいる場合
      if (isFilterPage) {
        findCreateFilterButtonInSettingsPage(resolve);
        return;
      }
      
      // インボックスにいる場合は設定に移動
      if (isInboxPage) {
        debugLog('インボックスページから設定ページに移動します');
        // フィルタ設定ページに直接移動
        window.location.href = 'https://mail.google.com/mail/u/0/#settings/filters';
        
        // 画面遷移を待ってから再実行
        setTimeout(() => {
          // 遷移が完了したか確認
          if (window.location.href.includes('#settings/filters')) {
            debugLog('フィルタ設定ページへの遷移が完了しました');
            findCreateFilterButtonInSettingsPage(resolve);
          } else {
            debugLog('フィルタ設定ページへの遷移が完了していません、設定メニュー経由で試みます');
            findFilterViaSettingsMenu(resolve);
          }
        }, 3000); // ページ遷移に十分な時間を取る
        return;
      }
      
      // その他の場合は設定メニューを探す
      findFilterViaSettingsMenu(resolve);
    } catch (error) {
      console.error('フィルタボタン検索エラー:', error);
      resolve(null);
    }
  });
}

// フィルタ設定ページ内でボタンを探す補助関数
function findCreateFilterButtonInSettingsPage(resolveCallback) {
  debugLog('フィルタ設定ページ内でボタンを探しています');
  
  // 「新しいフィルタを作成」リンクを探す - 様々なセレクタを試す
  setTimeout(() => {
    // リンク、ボタン、span要素など幅広く検索
    const filterButtons = [
      ...document.querySelectorAll('a[href*="filter"]'),
      ...document.querySelectorAll('button'),
      ...document.querySelectorAll('span'),
      ...document.querySelectorAll('div[role="button"]')
    ];
    
    // テキストで選別
    const createFilterBtn = filterButtons.find(el => {
      const text = el.textContent.trim();
      return text === '新しいフィルタを作成' || 
             text === 'Create new filter' || 
             text.includes('新しいフィルタ') ||
             text.includes('Create filter') ||
             text.includes('new filter');
    });
    
    debugLog('フィルタ設定ページでのボタン検索結果:', createFilterBtn);
    
    if (createFilterBtn) {
      resolveCallback(createFilterBtn);
    } else {
      // 最後の手段: 任意の要素から探す
      const anyElement = [...document.querySelectorAll('*')].find(el => {
        const text = el.textContent.trim();
        return (text === '新しいフィルタを作成' || 
                text === 'Create new filter' ||
                text.includes('新しいフィルタ') ||
                text.includes('Create filter')) && 
              (el.onclick || el.tagName === 'A' || el.tagName === 'BUTTON' || 
               el.role === 'button' || el.style.cursor === 'pointer');
      });
      
      debugLog('最後の手段での検索結果:', anyElement);
      resolveCallback(anyElement || null);
    }
  }, 1000); // DOM要素の読み込みを待つ
}

// 設定メニュー経由でフィルタページに移動する補助関数
function findFilterViaSettingsMenu(resolveCallback) {
  debugLog('設定メニュー経由でフィルタ設定を探しています');
  
  // 設定メニューを探す
  const settingsMenu = document.querySelector('div[aria-label="設定"]') || 
                       document.querySelector('div[aria-label="Settings"]') ||
                       document.querySelector('div[aria-label*="ettings"]');
  
  if (settingsMenu) {
    debugLog('設定メニューを見つけました、クリックします');
    // 設定メニューをクリック
    settingsMenu.click();
    
    // メニューが開くのを待つ
    setTimeout(() => {
      // フィルタ設定のメニュー項目を探す
      const menuItems = [...document.querySelectorAll('div[role="menuitem"]')];
      debugLog('メニュー項目数:', menuItems.length);
      
      const filterOption = menuItems.find(item => 
        item.textContent.includes('フィルタと受信拒否設定') || 
        item.textContent.includes('Filters and Blocked Addresses') ||
        item.textContent.includes('フィルタ') ||
        item.textContent.includes('Filter')
      );
      
      debugLog('フィルタオプション検索結果:', filterOption);
      
      if (filterOption) {
        // オプションをクリックして設定ページに移動
        filterOption.click();
        
        // 画面遷移を待つ
        setTimeout(() => {
          findCreateFilterButtonInSettingsPage(resolveCallback);
        }, 2000);
      } else {
        // メニュー項目が見つからない場合は直接URLで移動
        document.body.click(); // メニューを閉じる
        window.location.href = 'https://mail.google.com/mail/u/0/#settings/filters';
        
        setTimeout(() => {
          findCreateFilterButtonInSettingsPage(resolveCallback);
        }, 3000);
      }
    }, 1000);
  } else {
    // 設定メニューが見つからない場合は直接URLで移動
    debugLog('設定メニューが見つかりませんでした、直接URLで移動します');
    window.location.href = 'https://mail.google.com/mail/u/0/#settings/filters';
    
    setTimeout(() => {
      findCreateFilterButtonInSettingsPage(resolveCallback);
    }, 3000);
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