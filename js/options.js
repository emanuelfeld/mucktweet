(function () {
  'use strict'

  if (window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  let localStorage = window.browser.storage.local

  localStorage.get({
    'mucktweetLastUpdate': 0
  }, function (res) {
    console.log(res.mucktweetLastUpdate)
    let title = document.getElementById('title')
    title.textContent += ' ' + new Date(res.mucktweetLastUpdate).toJSON().slice(0, 10)
  })

  window.onload = function () {
    let selectedMenuItem = document.querySelector('.menu-item[selected]')
    if (selectedMenuItem.id === 'menu-dashboard') {
      getUpdates('user', formatUpdates)
      getUpdates('tweet', formatUpdates)
    }
  }

  document.onclick = function (evt) {
    if (evt.srcElement.classList.contains('menu-item') && evt.srcElement.hasAttribute('selected') === false) {
      let oldSelectedMenuItem = document.querySelector('.menu-item[selected]')
      oldSelectedMenuItem.removeAttribute('selected')
      let oldSectionClass = oldSelectedMenuItem.id.split('-')[1]
      document.querySelector('div.' + oldSectionClass).style.display = 'none'

      evt.srcElement.setAttribute('selected', '')
      let sectionClass = evt.srcElement.id.split('-')[1]
      document.querySelector('div.' + sectionClass).style.display = 'block'
    } else if (evt.srcElement.id === 'user-data') {
      window.browser.runtime.sendMessage({
        'type': 'download', 
        'content': 'user'})
    } else if (evt.srcElement.id === 'tweet-data') {
      window.browser.runtime.sendMessage({
        'type': 'download', 
        'content': 'tweet'})
  
    }
  }

  function formatUpdates (storeName, content) {
      let contentDiv
      if (storeName === 'user') {
        contentDiv = formatUserUpdate(content)
      } else if (storeName === 'tweet') {
        contentDiv = formatTweetUpdate(content)
      }

      let containerDiv
      if (content.status === 'suspended') {
        containerDiv = document.getElementById('suspended')
      } else if (content.status === 'deleted') {
        containerDiv = document.getElementById('deleted')
      } else if (content.status === 'available') {
        containerDiv = document.getElementById('available')
      }
      containerDiv.querySelector('.default').style.display = 'none'
      containerDiv.append(contentDiv)
  }

  function getUpdates (storeName, fn) {
    let port = chrome.runtime.connect({'name': storeName})
    port.postMessage()
    port.onMessage.addListener(function (msg) {
      fn(storeName, msg['content'])
    })
  }

  function formatUserUpdate (content) {
    let contentDiv = document.createElement('div')
    contentDiv.className = 'meta'
    contentDiv.textContent = 'User '
    let contentLink = document.createElement('a')
    contentLink.href = 'https://twitter.com/' + content.screenName
    contentLink.setAttribute('target', '_blank')
    contentLink.className = 'url'
    contentLink.textContent = '@' + content.screenName
    contentDiv.appendChild(contentLink)
    return contentDiv
  }

  function formatTweetUpdate (content) {
    let contentDiv = document.createElement('div')
    contentDiv.className = 'meta'
    let screenName = content.permalinkPath.split('/')[1]
    let contentLink = document.createElement('a')
    contentLink.href = 'https://twitter.com' + content.permalinkPath
    contentLink.setAttribute('target', '_blank')
    contentLink.textContent = Date(content.postDate)
    contentDiv.textContent = 'Tweet by @' + screenName + ' posted at '
    contentDiv.append(contentLink)
    return contentDiv
  }
})()
