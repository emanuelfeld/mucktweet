(function () {
  'use strict'

  if (!!window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  let localStorage = window.browser.storage.local

  localStorage.get({
    'mucktweetLastUpdate': 0
  }, function (res) {
    console.log('Adding date to section title.')
    let title = document.getElementById('title')
    title.textContent += ' ' + new Date(res.mucktweetLastUpdate).toJSON().slice(0, 10)
  })

  window.addEventListener('hashchange', clickHashTab, false)

  function clickHashTab () {
    console.log('Setting location hash.')
    const sectionId = window.location.hash.split('#')[1]
    document.querySelector('.menu-item.' + sectionId).click()
  }

  window.onload = function () {
    const selectedMenuItem = document.querySelector('.menu-item[selected]')
    if (selectedMenuItem.classList.contains('updates')) {
      console.log('Polling background for updates.')
      getUpdates('user', formatUpdates)
      getUpdates('tweet', formatUpdates)
    }

    if (window.location.hash) {
      clickHashTab()
    }
  }

  document.onclick = function (evt) {
    let element = evt.srcElement
    if (element.classList.contains('menu-item') && element.hasAttribute('selected') === false) {
      console.log('Migrating to new section.')
      let prevSelectedMenuItem = document.querySelector('.menu-item[selected]')
      prevSelectedMenuItem.removeAttribute('selected')
      let prevSectionClass = prevSelectedMenuItem.id.split('-')[1]
      document.querySelector('section.' + prevSectionClass).style.display = 'none'

      // select and show new section, set hash
      element.setAttribute('selected', '')
      let sectionClass = element.id.split('-')[1]
      document.querySelector('section.' + sectionClass).style.display = 'block'
      window.location.hash = '#' + sectionClass
    } else if (evt.srcElement.id === 'user-data') {
      console.log('Requesting user data download.')
      window.browser.runtime.sendMessage({
        'type': 'download',
        'content': 'user'})
    } else if (evt.srcElement.id === 'tweet-data') {
      console.log('Requesting tweet data download.')
      window.browser.runtime.sendMessage({
        'type': 'download',
        'content': 'tweet'})
    }
  }

  function getUpdates (storeName, fn) {
    // stream in updates
    let port = window.browser.runtime.connect({'name': storeName})
    port.postMessage()
    port.onMessage.addListener(function (msg) {
      fn(storeName, msg['content'])
    })
  }

  function formatUpdates (storeName, content) {
    let contentDiv
    if (storeName === 'user') {
      contentDiv = formatUserRow(content)
    } else if (storeName === 'tweet') {
      contentDiv = formatTweetRow(content)
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

  function formatUserRow (content) {
    let contentDiv = document.createElement('div')
    contentDiv.className = 'row-item'
    contentDiv.textContent = 'User '
    let contentLink = document.createElement('a')
    contentLink.href = 'https://twitter.com/' + content.screenName
    contentLink.setAttribute('target', '_blank')
    contentLink.textContent = '@' + content.screenName
    contentDiv.appendChild(contentLink)
    return contentDiv
  }

  function formatTweetRow (content) {
    let contentDiv = document.createElement('div')
    contentDiv.className = 'row-item'
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
