(function () {
  'use strict'

  const DEBUG = false
  const DB_NAME = DEBUG ? 'mucktweet-db-test' : 'mucktweet-db'
  const DB_VERSION = 1
  const DB_USER_STORE_NAME = 'user'
  const DB_TWEET_STORE_NAME = 'tweet'
  const UPDATE_WAIT = DEBUG ? 1000 : 8.64e+7

  if (!!window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  let db
  let localStorage = window.browser.storage.local

  let badgeCounter
  let lastUpdate
  let recentUpdates
  let totalStatistics
  let recentStatistics

  const STATS_DEFAULT = JSON.stringify({
    'user': {
      'reported': 0,
      'suspended': 0,
      'deleted': 0
    },
    'tweet': {
      'reported': 0,
      'deleted': 0
    }
  })

  const LOCAL_STORAGE_DEFAULT = {
    'recentUpdates': '[]',
    'lastUpdate': Date.now(),
    'recentStatistics': STATS_DEFAULT,
    'totalStatistics': STATS_DEFAULT,
    'badgeCounter': 0
  }

  function resetLocalStorage () {
    console.log('Calling reset locale storage')
    localStorage.set({
    'recentUpdates': '[]',
    'lastUpdate': Date.now(),
    'recentStatistics': STATS_DEFAULT,
    'badgeCounter': 0
    }, function () {
      recentUpdates = []
      lastUpdate = Date.now()
      recentStatistics = JSON.parse(STATS_DEFAULT)
      badgeCounter = 0
      updateBadge() 
    })
  }

  localStorage.get({
    'recentUpdates': '[]',
    'lastUpdate': Date.now(),
    'recentStatistics': STATS_DEFAULT,
    'totalStatistics': STATS_DEFAULT,
    'badgeCounter': 0
  }, function (res) {
    recentUpdates = JSON.parse(res.recentUpdates)
    recentStatistics = JSON.parse(res.recentStatistics)
    totalStatistics = JSON.parse(res.totalStatistics)
    lastUpdate = res.lastUpdate
    badgeCounter = res.badgeCounter
    openDb()
  })

  // Event listeners and message handlers

  if (DEBUG === false) {
    window.browser.runtime.onInstalled.addListener(function () {
      let url = window.browser.extension.getURL('dashboard.html')
      window.browser.tabs.update({
        'active': true,
        'url': url + '#about'})
    })
  }

  window.browser.runtime.onMessage.addListener(handleMessage)

  function handleMessage (request, sender, sendResponse) {
    let type = request.type
    let content = request.content
    if (type === 'update') {
      getUpdates()
      sendResponse({'content': 'ok'})
    } else if (type === 'popup') {
      let url = window.browser.extension.getURL('dashboard.html')
      sendResponse({'content': url + '#' + content})
    } else if (type === 'report') {
      addReportToStore(content)
      sendResponse({'content': 'ok'})
    } else if (type === 'download') {
      getAllItemsInStore(request.content)
    }
  }

  // General DB functions

  function openDb () {
    console.log('Opening MuckTweet DB.')
    let req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = function (evt) {
      console.log('Upgrading MuckTweet DB.')
      db = this.result

      if (!db.objectStoreNames.contains('user')) {
        console.log('Making the user object store.')
        let objectStore = db.createObjectStore('user',
          { keyPath: 'id' })
        objectStore.createIndex('status', 'status')
        objectStore.createIndex('hasUpdate', 'hasUpdate')
      }

      if (!db.objectStoreNames.contains('tweet')) {
        console.log('Making the tweet object store.')
        let objectStore = db.createObjectStore('tweet',
          { keyPath: 'id' })
        objectStore.createIndex('status', 'status')
        objectStore.createIndex('userTweets', 'userId')
        objectStore.createIndex('hasUpdate', 'hasUpdate')
      }
    }

    req.onsuccess = function (evt) {
      console.log('Opened MuckTweet DB.')
      db = this.result
      getUpdates()
    }

    req.onerror = function (evt) {
      console.error('Failed to open MuckTweet DB.')
      console.error(this.error)
    }
  }

  function addToDb (entry, storeName) {
    console.log('Adding ID ' + entry['id'] + ' to ' + storeName + ' store.')
    let store = getObjectStore(storeName, 'readwrite')
    let req = store.put(entry)

    req.onsuccess = function (evt) {
      console.log('Successfully added ID ' + entry['id'] + ' to ' + storeName + ' store.')
    }

    req.onerror = function (evt) {
      console.error('Failed to add ID ' + entry['id'] + ' to ' + storeName + ' store.')
      console.error(this.error)
    }
  }

  function queryDb (key, storeName, callback) {
    console.log('Querying ' + storeName + ' store for ID ' + key + '.')
    let store = getObjectStore(storeName, 'readwrite')
    let req = store.get(key)

    req.onsuccess = function (evt) {
      callback(evt.target.result)
    }

    req.onerror = function (evt) {
      console.error('Failed to query ' + storeName + ' store for ID ' + key + '.')
      console.error(this.error)
    }
  }

  function getObjectStore (storeName, mode) {
    let tx = db.transaction(storeName, mode)
    return tx.objectStore(storeName)
  }

  // Download DB

  function getAllItemsInStore (storeName) {
    let tx = db.transaction(storeName, 'readonly')
    let store = tx.objectStore(storeName)
    let req = store.openCursor()
    let out = []
    req.onsuccess = function (evt) {
      let cursor = evt.target.result
      if (cursor) {
        out.push(cursor.value)
        cursor.continue()
      }
    }

    req.onerror = function (evt) {
      console.error('Failed to prepare ' + storeName + ' for download.')
      console.error(this.error)
    }

    tx.oncomplete = function () {
      downloadData(out, storeName)
    }
  }

  function downloadData (content, filename) {
    let dataStr = 'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(content, null, 4))
    let tempAnchor = document.createElement('a')
    tempAnchor.setAttribute('href', dataStr)
    tempAnchor.setAttribute('download', filename + '.json')
    tempAnchor.click()
  }

  // UI functions

  function updateBadge () {
    console.log('Updating badge to ', badgeCounter)
    window.browser.browserAction.setBadgeText({
      text: badgeCounter.toString()
    })
  }

  // Update functions

  function addReportToStore (content) { 
    console.log(content)
    if (Object.keys(content.userData).length > 0) {
      queryDb(content.userData['id'], DB_USER_STORE_NAME, handleUserReport)
    }

    if (Object.keys(content.tweetData).length > 0) {
      queryDb(content.tweetData['id'], DB_TWEET_STORE_NAME, handleTweetReport)
    }

    function handleUserReport (entry) {
      if (entry === undefined) {
        console.log('Adding user.', content, entry)
        totalStatistics[DB_USER_STORE_NAME]['reported']++
        localStorage.set({
          'totalStatistics': JSON.stringify(totalStatistics)})
        addToDb(content.userData, DB_USER_STORE_NAME)
      } else {
        console.warn('User already reported. Updating.')
        entry['userReportCount']++
        entry['hasUpdate'] = 0
        addToDb(entry, DB_USER_STORE_NAME)
      }
    }

    function handleTweetReport (entry) {
      if (entry === undefined) {
        console.log('Adding tweet.', content, entry)
        addToDb(content.tweetData, DB_TWEET_STORE_NAME)
        totalStatistics[DB_TWEET_STORE_NAME]['reported']++
        localStorage.set({
          'totalStatistics': JSON.stringify(totalStatistics)})
      } else {
        console.warn('Tweet already reported.')
      }      
    }
  }

  function getUpdates (force = false) {
    console.log('calling get updates')
    if (DEBUG === true || force === true || lastUpdate === 0 ||
      (Date.now() > lastUpdate + UPDATE_WAIT)) {
        resetLocalStorage()
        updateTweetStore()
        updateUserStore()        
    }
  }

  function updateItemInStore (value, newStatus, storeName) {
    value.status = newStatus
    value.hasUpdate = 0
    value.updateDate = Date.now()
    addToDb(value, storeName)
    updateBadge(badgeCounter++)

    recentStatistics[storeName][value.status] += 1
    totalStatistics[storeName][value.status] += 1

    addToRecentUpdates(value, storeName)

    localStorage.set({
      'recentStatistics': JSON.stringify(recentStatistics),
      'totalStatistics': JSON.stringify(totalStatistics),
      'badgeCounter': badgeCounter
    })
  }

  function addToRecentUpdates (value, storeName) {
    console.log('adding', value, 'to recent updates')
    recentUpdates.push({'storeName': storeName, 'content': value})
    localStorage.set({
      'recentUpdates': JSON.stringify(recentUpdates)
    })
  }

  function updateUserStore () {
    console.log('calling update user store')
    let tx = db.transaction(DB_USER_STORE_NAME, 'readwrite')
    let store = tx.objectStore(DB_USER_STORE_NAME)
    let index = store.index('status')
    let req = index.openCursor()

    req.onsuccess = function (evt) {
      if (evt.target.result) {
        let value = evt.target.result.value
        if(value.updateDate === null) {
        fetch('https://twitter.com/intent/user?user_id=' + value.id)
            .then(function (res) {
              console.log(res)
              if (res.url === 'https://twitter.com/account/suspended' || DEBUG) {
                updateItemInStore(value, 'suspended', DB_USER_STORE_NAME)
              } else if (res.status === 404) {
                updateItemInStore(value, 'deleted', DB_USER_STORE_NAME)
              } else {
                addToRecentUpdates(value, DB_USER_STORE_NAME)
              }
            })
      } else {
        value.hasUpdate = 0
        addToDb(value, DB_USER_STORE_NAME)
      }
      evt.target.result.continue()
    }

    req.onerror = function (evt) {
      console.error('Failed to update ' + DB_USER_STORE_NAME + ' store.')
      console.error(this.error)
    }
  }
}

  function updateTweetStore () {
    let tx = db.transaction(DB_TWEET_STORE_NAME, 'readwrite')
    let store = tx.objectStore(DB_TWEET_STORE_NAME)
    let index = store.index('status')
    let req = index.openCursor('available')

    req.onsuccess = function (evt) {
      let cursor = evt.target.result
      if (cursor && cursor.value.updateDate === null) {
        let value = cursor.value
        fetch('https://twitter.com' + value.permalinkPath)
          .then(function (res) {
            if (res.status === 404) {
              updateItemInStore(value, 'deleted', DB_TWEET_STORE_NAME)
            } else {
              addToRecentUpdates(value, DB_TWEET_STORE_NAME)
            }
          })
        cursor.continue()
      } else if (cursor) {
        let value = cursor.value
        value.hasUpdate = 0
        addToDb(value, DB_TWEET_STORE_NAME)
        cursor.continue()
      }
    }

    req.onerror = function (evt) {
      console.error('Failed to update ' + DB_TWEET_STORE_NAME + ' store.')
      console.error(this.error)
    }
  }
})()
