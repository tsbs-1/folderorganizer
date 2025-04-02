(function() {
  // メッセージリスナーを設定
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Gmailでメッセージを受信:', request);
    
    if (request.action === 'createLabel') {
      createGmailLabel(request.companyName, request.emailDomain);
      createGmailFilter(request.companyName, request.emailDomain);
      if (sendResponse) sendResponse({success: true});
    } else if (request.action === 'removeLabel') {
      // ラベル削除機能
      // 注: 現在は実装されていません
      console.log('ラベル削除は現在実装されていません');
      if (sendResponse) sendResponse({success: false, message: '削除機能は実装されていません'});
    }
    
    return true; // 非同期レスポンス用
  });
  
  // Gmailのラベルを作成する関数
  function createGmailLabel(companyName, emailDomain) {
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
            }
          }, 500);
        }
      }, 1000);
    } else {
      console.warn('ラベル作成ボタンが見つかりませんでした');
    }
  }
  
  // Gmailのフィルタを作成する関数
  function createGmailFilter(companyName, emailDomain) {
    // フィルタ作成ボタンをクリック
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
                          }
                        }, 500);
                      } else {
                        console.warn(`ラベル "${companyName}" が見つかりませんでした`);
                      }
                    }, 500);
                  }
                }, 500);
              }, 1000);
            }
          }, 500);
        }
      }, 1000);
    } else {
      console.warn('フィルタ作成ボタンが見つかりませんでした');
    }
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
    // Gmailの言語設定に応じて異なるテキストをチェック
    const filterButtons = [...document.querySelectorAll('button')].filter(button => {
      const text = button.textContent.trim();
      return text.includes('フィルタ') || text.includes('Filter');
    });
    
    return filterButtons[0]; // 最初のフィルタ関連ボタンを返す
  }
  
  // 初期化関数
  function initialize() {
    console.log('Gmail Folder Organizer のコンテンツスクリプトが初期化されました');
  }
  
  // DOMが読み込まれたら初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();