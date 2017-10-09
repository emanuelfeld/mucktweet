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

    localStorage.get([
      'lastUpdate',
      'recentStatistics',
      'totalStatistics',
      'recentUpdates'
    ], function (res) {
      formatRecentlyTitle(res.lastUpdate)
      formatStatistics(JSON.parse(res.totalStatistics))
      let recentUpdates = JSON.parse(res.recentUpdates)
      for (let i = 0; i < recentUpdates.length; i++) {
        let update = recentUpdates[i]
        let storeName = update.storeName
        let content = update.content
        formatUpdate(storeName, content)
      }
    })
  })

  // Navigation

  window.addEventListener('hashchange', clickHashTab, false)

  function clickHashTab () {
    let oldMenuItem = document.querySelector('[selected="true"]')
    let oldHash = oldMenuItem.parentElement.href.split('#')[1]
    oldMenuItem.setAttribute('selected', 'false')
    let oldSection = document.querySelector('section.' + oldHash)
    oldSection.style.display = 'none'

    let newHash = window.location.hash.split('#')[1]
    let newMenuItem = document.querySelector('.menu-item.' + newHash)
    newMenuItem.setAttribute('selected', 'true')
    let newSection = document.querySelector('section.' + newHash)
    newSection.style.display = 'block'
  }

  // Recently

  function formatRecentlyTitle (lastUpdate) {
    let title = document.getElementById('title')
    title.textContent += ' ' + new Date(lastUpdate).toJSON().slice(0, 10)
  }

  function formatUpdate (storeName, content) {
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

  // Download Data

  document.addEventListener('click', function (evt) {
    if (evt.target.id === 'user-data' || evt.target.id === 'tweet-data') {
      let storeName = evt.target.id.split('-')[0]
      console.log('Requesting ' + storeName + ' data download.')
      window.browser.runtime.sendMessage({
        'type': 'download',
        'content': storeName})
    }
  })

  // Statistics

  function formatStatistics (statistics) {
    let userReportCount = document.getElementById('user-reported-stats')
    userReportCount.textContent = statistics['user']['reported']
    let userSuspendedCount = document.getElementById('user-suspended-stats')
    userSuspendedCount.textContent = statistics['user']['suspended']
    let userDeletedCount = document.getElementById('user-deleted-stats')
    userDeletedCount.textContent = statistics['user']['deleted']
    let tweetReportCount = document.getElementById('tweet-reported-stats')
    tweetReportCount.textContent = statistics['tweet']['reported']
    let tweetDeletedCount = document.getElementById('tweet-deleted-stats')
    tweetDeletedCount.textContent = statistics['tweet']['deleted']
  }
})()
