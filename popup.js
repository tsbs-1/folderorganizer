document.addEventListener('DOMContentLoaded', function() {
    const addDomainButton = document.getElementById('addDomain');
    const companyNameInput = document.getElementById('companyName');
    const emailDomainInput = document.getElementById('emailDomain');
    const statusDiv = document.getElementById('status');
    const domainListDiv = document.getElementById('domainList');
    
    // 保存されたドメイン情報を読み込む
    loadDomains();
    
    // ドメイン追加ボタンのクリックイベント
    addDomainButton.addEventListener('click', function() {
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
      
      // ドメイン情報を保存
      saveDomain(companyName, emailDomain);
      
      // 入力フィールドをクリア
      companyNameInput.value = '';
      emailDomainInput.value = '';
      
      // Gmail タブにメッセージを送信
      chrome.tabs.query({url: 'https://mail.google.com/*'}, function(tabs) {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'createLabel',
            companyName: companyName,
            emailDomain: emailDomain
          });
        }
      });
    });
    
    // ドメイン情報を保存する関数
    function saveDomain(companyName, emailDomain) {
      chrome.storage.sync.get({domains: []}, function(data) {
        // すでに同じドメインが登録されていないかチェック
        const domainExists = data.domains.some(domain => domain.email === emailDomain);
        
        if (domainExists) {
          showStatus('このドメインは既に登録されています', 'error');
          return;
        }
        
        // 新しいドメインを追加
        const newDomains = [...data.domains, {company: companyName, email: emailDomain}];
        
        chrome.storage.sync.set({domains: newDomains}, function() {
          showStatus('ドメインを登録しました', 'success');
          loadDomains(); // ドメイン一覧を更新
        });
      });
    }
    
    // 保存されたドメイン情報を読み込む関数
    function loadDomains() {
      chrome.storage.sync.get({domains: []}, function(data) {
        domainListDiv.innerHTML = '';
        
        if (data.domains.length === 0) {
          domainListDiv.innerHTML = '<p>登録されたドメインはありません</p>';
          return;
        }
        
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
      chrome.storage.sync.get({domains: []}, function(data) {
        const removedDomain = data.domains[index];
        const newDomains = data.domains.filter((_, i) => i !== index);
        
        chrome.storage.sync.set({domains: newDomains}, function() {
          showStatus(`${removedDomain.company} (${removedDomain.email}) を削除しました`, 'success');
          loadDomains(); // ドメイン一覧を更新
          
          // Gmail タブにメッセージを送信
          chrome.tabs.query({url: 'https://mail.google.com/*'}, function(tabs) {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'removeLabel',
                companyName: removedDomain.company,
                emailDomain: removedDomain.email
              });
            }
          });
        });
      });
    }
    
    // ステータスメッセージを表示する関数
    function showStatus(message, type) {
      statusDiv.textContent = message;
      statusDiv.className = `status ${type}`;
      statusDiv.style.display = 'block';
      
      setTimeout(function() {
        statusDiv.style.display = 'none';
      }, 3000);
    }
    
    // ドメインのバリデーション
    function isValidDomain(domain) {
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
      return domainRegex.test(domain);
    }
  });