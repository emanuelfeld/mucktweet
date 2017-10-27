(function () {
  'use strict'

  if (!!window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  let localStorage = window.browser.storage.local

  window.addEventListener('load', function (evt) {
    if (window.location.hash) {
      clickHashTab()
    }

    if (window.location.hash === 'updates') {
      window.browser.runtime.sendMessage({
        'type': 'clearBadge'
      })
    }

    localStorage.get({
      'lastUpdate': Date.now(),
      'totalStatistics': '{}',
      'recentUserUpdates': '{}',
      'recentTweetUpdates': '{}'
    }, function (res) {
      formatLastUpdateTitle(res.lastUpdate)
      formatStatistics(JSON.parse(res.totalStatistics))
      addUpdates(JSON.parse(res.recentUserUpdates), 'user')
      addUpdates(JSON.parse(res.recentTweetUpdates), 'tweet')
    })
  })

  function addUpdates (data, storeName) {
    for (let i = 0; i < Object.keys(data).length; i++) {
      let id = Object.keys(data)[i]
      let content = data[id]
      formatUpdate(content, storeName)
    }
  }

  // Navigation

  window.addEventListener('hashchange', clickHashTab, false)

  function clickHashTab () {
    let oldMenuItem = document.querySelector('.menu-item[selected="true"]')
    let oldHash = oldMenuItem.id.split('-')[1]
    let oldSection = document.querySelector('section.' + oldHash)
    oldMenuItem.setAttribute('selected', 'false')
    oldSection.setAttribute('selected', 'false')

    let newHash = window.location.hash.split('#')[1]
    let newMenuItem = document.querySelector('.menu-item.' + newHash)
    let newSection = document.querySelector('section.' + newHash)
    newMenuItem.setAttribute('selected', 'true')
    newSection.setAttribute('selected', 'true')
  }

  // Recently

  function formatLastUpdateTitle (lastUpdate) {
    let title = document.getElementById('title')
    title.textContent += ' ' + new Date(lastUpdate).toJSON().slice(0, 10)
  }

  function formatUpdate (content, storeName) {
    let contentDiv = formatRow(content, storeName)
    let containerDiv = document.getElementById(content.status)
    containerDiv.querySelector('.default').style.display = 'none'
    containerDiv.append(contentDiv)
  }

  function formatRow (content, storeName) {
    let contentLink = document.createElement('a')
    let contentDiv = document.createElement('div')
    contentDiv.className = 'row-item'
    contentLink.setAttribute('target', '_blank')

    if (storeName === 'user') {
      contentLink.href = 'https://twitter.com/' + content.screenName
      contentLink.textContent = '@' + content.screenName
      contentDiv.textContent = 'User '
    } else if (storeName === 'tweet') {
      let screenName = content.permalinkPath.split('/')[1]
      contentLink.href = 'https://twitter.com' + content.permalinkPath
      contentLink.textContent = new Date(content.postDate)
      contentDiv.textContent = 'Tweet by @' + screenName + ' posted '
    }
    contentDiv.appendChild(contentLink)
    return contentDiv
  }

  // Download Data

  document.addEventListener('click', function (evt) {
    if (evt.target.classList.contains('download-button')) {
      let storeName = evt.target.id.split('-')[0]
      let fileFormat = evt.target.id.split('-')[2]
      window.browser.runtime.sendMessage({
        'type': 'download',
        'content': {
          'storeName': storeName,
          'fileFormat': fileFormat
        }
      })
    }
  })

  // Statistics

  function formatStatistics (statistics) {
    if (Object.keys(statistics).length > 0) {
      document.getElementById('user-reported-stats').textContent = statistics['user']['reported']
      document.getElementById('user-suspended-stats').textContent = statistics['user']['suspended']
      document.getElementById('user-deleted-stats').textContent = statistics['user']['deleted']
      document.getElementById('tweet-reported-stats').textContent = statistics['tweet']['reported']
      document.getElementById('tweet-deleted-stats').textContent = statistics['tweet']['deleted']
    }
  }
})()
