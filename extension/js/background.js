(function () {
  'use strict'

  if (!!window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  const DEBUG = false
  const DB_NAME = DEBUG ? 'mucktweet-db-test' : 'mucktweet-db'
  const DB_VERSION = 2
  const DB_USER_STORE_NAME = 'user'
  const DB_TWEET_STORE_NAME = 'tweet'
  const UPDATE_WAIT = DEBUG ? 10000 : 8.64e+7

  let db
  let localStorage = window.browser.storage.local

  let badgeCounter
  let lastUpdate
  let recentUserUpdates
  let recentTweetUpdates
  let totalStatistics

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

  // Restore local storage variables, badge counter
  localStorage.get({
    'recentUserUpdates': '{}',
    'recentTweetUpdates': '{}',
    'lastUpdate': Date.now(),
    'totalStatistics': STATS_DEFAULT,
    'badgeCounter': 0
  }, function (res) {
    recentUserUpdates = JSON.parse(res.recentUserUpdates)
    recentTweetUpdates = JSON.parse(res.recentTweetUpdates)
    totalStatistics = JSON.parse(res.totalStatistics)
    lastUpdate = res.lastUpdate
    badgeCounter = res.badgeCounter
    updateBadge()
    openDb()
  })

  // MESSAGE HANDLERS

  // Open dashboard on first install
  if (DEBUG === false) {
    window.browser.runtime.onInstalled.addListener(function (details) {
      if (details.reason === 'install') {
        let url = window.browser.extension.getURL('dashboard.html')
        window.open(url + '#about')
      }
    })
  }

  // Handle messages from content/dashboard/popup scripts
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
      // Add each new report to the recent updates list as 'available'
      addReportToStore(content)
      sendResponse({'content': 'ok'})
    } else if (type === 'download') {
      getAllItemsInStore(content.storeName, content.fileFormat)
    }
  }

  // General DB functions

  function openDb () {
    console.log('Opening MuckTweet DB')
    let req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = function (evt) {
      console.log('Upgrading MuckTweet DB to version', DB_VERSION)
      db = this.result

      if (!db.objectStoreNames.contains('user')) {
        console.log('Making the User object store')
        let objectStore = db.createObjectStore('user',
          { keyPath: 'id' })
        objectStore.createIndex('status', 'status')
      }

      if (!db.objectStoreNames.contains('tweet')) {
        console.log('Making the Tweet object store')
        let objectStore = db.createObjectStore('tweet',
          { keyPath: 'id' })
        objectStore.createIndex('status', 'status')
        objectStore.createIndex('userTweets', 'userId')
      }
    }

    req.onsuccess = function (evt) {
      console.log('Opened MuckTweet DB')
      db = this.result
      getUpdates()
    }

    req.onerror = function (evt) {
      console.error('Failed to open MuckTweet DB')
      console.error(this.error)
    }
  }

  function addToDb (entry, storeName) {
    console.log('Adding ID', entry['id'], 'to', storeName, 'store')
    let store = getObjectStore(storeName, 'readwrite')
    let req = store.put(entry)

    req.onsuccess = function (evt) {
      console.log('Successfully added ID', entry['id'], 'to', storeName, 'store')
    }

    req.onerror = function (evt) {
      console.error('Failed to add ID', entry['id'], 'to', storeName, 'store')
      console.error(this.error)
    }
  }

  function queryDb (key, storeName, callback) {
    console.log('Querying', storeName, 'store for ID', key)
    let store = getObjectStore(storeName, 'readwrite')
    let req = store.get(key)

    req.onsuccess = function (evt) {
      callback(evt.target.result)
    }

    req.onerror = function (evt) {
      console.error('Failed to query', storeName, 'store for ID', key)
      console.error(this.error)
    }
  }

  function getObjectStore (storeName, mode) {
    let tx = db.transaction(storeName, mode)
    return tx.objectStore(storeName)
  }

  // Download DB store as JSON or CSV

  function getAllItemsInStore (storeName, fileFormat) {
    let tx = db.transaction(storeName, 'readonly')
    let store = tx.objectStore(storeName)
    let req = store.openCursor()
    let items = []

    req.onsuccess = function (evt) {
      let cursor = evt.target.result
      if (cursor) {
        items.push(cursor.value)
        cursor.continue()
      }
    }

    req.onerror = function (evt) {
      console.error('Failed to prepare', storeName, 'for download')
      console.error(this.error)
    }

    tx.oncomplete = function () {
      downloadData(items, storeName, fileFormat)
    }
  }

  function downloadData (data, fileName, fileFormat) {
    let dataString
    if (fileFormat === 'json') {
      dataString = 'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(data, null, 4))
    } else if (fileFormat === 'csv') {
      let csv = Papa.unparse(data)
      dataString = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    }
    let tempAnchor = document.createElement('a')
    tempAnchor.setAttribute('href', dataString)
    tempAnchor.setAttribute('download', fileName + '.' + fileFormat)
    tempAnchor.click()
    tempAnchor.remove()
  }

  // UPDATE FUNCTIONS

  // Check status on open reports
  function getUpdates (force = false) {
    console.log('Checking if it is time for an update')
    localStorage.get({
      'lastUpdate': Date.now()
    }, function (res) {
      console.log(DEBUG)
      console.log(res.lastUpdate)
      console.log(Date.now())
      console.log(UPDATE_WAIT)
      console.log((Date.now() > res.lastUpdate + UPDATE_WAIT))
      if (DEBUG === true || force === true || res.lastUpdate === 0 ||
        (Date.now() > res.lastUpdate + UPDATE_WAIT)) {
        console.log('Updating')
        resetLocalStorage()
        updateTweetStore()
        updateUserStore()
      }
    })
  }

  // Run before updating data
  function resetLocalStorage () {
    console.log('Resetting locale storage variables')
    localStorage.set({
      'recentUserUpdates': '{}',
      'recentTweetUpdates': '{}',
      'lastUpdate': Date.now(),
      'badgeCounter': 0
    }, function (res) {
      recentUserUpdates = {}
      recentTweetUpdates = {}
      lastUpdate = Date.now()
      badgeCounter = 0
      updateBadge()
    })
  }

  // Set badge text to number of recent updates
  function updateBadge () {
    console.log('Updating badge to ', badgeCounter)
    window.browser.browserAction.setBadgeText({
      text: badgeCounter.toString()
    })
  }

  function updateUserStore () {
    // console.log('calling update user store')
    let tx = db.transaction(DB_USER_STORE_NAME, 'readwrite')
    let store = tx.objectStore(DB_USER_STORE_NAME)
    let index = store.index('status')
    let req = index.openCursor()

    req.onsuccess = function (evt) {
      let cursor = evt.target.result
      if (cursor && cursor.value.updateDate === null) {
        let value = cursor.value
        fetch('https://twitter.com/intent/user?user_id=' + value.id)
            .then(function (res) {
              if (res.url === 'https://twitter.com/account/suspended') {
                updateItemInStore(value, 'suspended', DB_USER_STORE_NAME)
              } else if (res.status === 404) {
                updateItemInStore(value, 'deleted', DB_USER_STORE_NAME)
              } else {
                addToRecentUpdates(value, DB_USER_STORE_NAME)
              }
            })
        cursor.continue()
      } else if (cursor) {
        cursor.continue()
      }
    }

    req.onerror = function (evt) {
      console.error('Failed to update', DB_USER_STORE_NAME, 'store')
      console.error(this.error)
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
            if (res.url === 'https://twitter.com/account/suspended' ||
                res.status === 404) {
              updateItemInStore(value, 'deleted', DB_TWEET_STORE_NAME)
            } else {
              addToRecentUpdates(value, DB_TWEET_STORE_NAME)
            }
          })
        cursor.continue()
      } else if (cursor) {
        cursor.continue()
      }
    }

    req.onerror = function (evt) {
      console.error('Failed to update', DB_TWEET_STORE_NAME, 'store')
      console.error(this.error)
    }
  }

  // Check what data was sent in the report, check if already in DB, update recent updates dict
  function addReportToStore (content) {
    if (Object.keys(content.userData).length > 0) {
      queryDb(content.userData['id'], DB_USER_STORE_NAME, handleUserReport)
      addToRecentUpdates(content.userData, DB_USER_STORE_NAME)
    }

    if (Object.keys(content.tweetData).length > 0) {
      queryDb(content.tweetData['id'], DB_TWEET_STORE_NAME, handleTweetReport)
      addToRecentUpdates(content.tweetData, DB_TWEET_STORE_NAME)
    }

    function handleUserReport (entry) {
      if (entry === undefined) {
        console.log('Adding user', content)
        totalStatistics[DB_USER_STORE_NAME]['reported']++
        localStorage.set({
          'totalStatistics': JSON.stringify(totalStatistics)})
        addToDb(content.userData, DB_USER_STORE_NAME)
      } else {
        // Increment report count if already reported user
        console.warn('User already reported, so incrementing')
        entry['reportCount']++
        addToDb(entry, DB_USER_STORE_NAME)
      }
    }

    function handleTweetReport (entry) {
      if (entry === undefined) {
        console.log('Adding tweet', content)
        addToDb(content.tweetData, DB_TWEET_STORE_NAME)
        totalStatistics[DB_TWEET_STORE_NAME]['reported']++
        localStorage.set({
          'totalStatistics': JSON.stringify(totalStatistics)})
      } else {
        console.warn('Tweet already reported')
      }
    }
  }

  function updateItemInStore (value, newStatus, storeName) {
    value.status = newStatus
    value.updateDate = Date.now()
    addToDb(value, storeName)
    updateBadge(badgeCounter++)

    totalStatistics[storeName][value.status] += 1

    addToRecentUpdates(value, storeName)

    localStorage.set({
      'totalStatistics': JSON.stringify(totalStatistics),
      'badgeCounter': badgeCounter
    })
  }

  function addToRecentUpdates (value, storeName) {
    console.log('Adding', value, 'to recent updates')
    if (storeName === 'user') {
      recentUserUpdates[value.id] = value
    } else if (storeName === 'tweet') {
      recentTweetUpdates[value.id] = value
    }

    localStorage.set({
      'recentUserUpdates': JSON.stringify(recentUserUpdates),
      'recentTweetUpdates': JSON.stringify(recentTweetUpdates)
    })
  }
})()
