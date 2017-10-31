(function () {
  'use strict'

  if (!!window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  const DEBUG = false
  const DB_NAME = DEBUG ? 'mucktweet-db-test' : 'mucktweet-db'
  const DB_VERSION = 3
  const DB_USER_STORE_NAME = 'user'
  const DB_TWEET_STORE_NAME = 'tweet'
  const DB_REPORT_STORE_NAME = 'report'
  const UPDATE_WAIT = DEBUG ? 10000 : 8.64e+7
  const CHECK_SUSPENDED = true

  let db
  let localStorage = window.browser.storage.local

  let badgeCounter
  let recentUserUpdates
  let recentTweetUpdates
  let totalStatistics

  const STATS_DEFAULT = JSON.stringify({
    'user': {
      'reported': 0,
      'suspended': 0,
      'deleted': 0,
      'unsuspended': 0
    },
    'tweet': {
      'reported': 0,
      'deleted': 0
    }
  })

  ////////////
  // SET UP //
  ////////////

  localStorage.get({
    'recentUserUpdates': '{}',
    'recentTweetUpdates': '{}',
    'totalStatistics': STATS_DEFAULT,
    'badgeCounter': 0,
    'lastUpdate': Date.now()
  }, function (res) {
    recentUserUpdates = JSON.parse(res.recentUserUpdates)
    recentTweetUpdates = JSON.parse(res.recentTweetUpdates)
    totalStatistics = JSON.parse(res.totalStatistics)
    badgeCounter = res.badgeCounter
    updateBadge()
    openDb()
  })

  //////////////////////
  // MESSAGE HANDLERS //
  //////////////////////

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
    } else if (type === 'clearBadge') {
      clearBadge()
    }
  }

  ////////////////////////
  // BASIC DB FUNCTIONS //
  ////////////////////////

  function openDb () {
    console.log('Opening MuckTweet DB')
    let req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = function (evt) {
      console.log('Upgrading MuckTweet DB to version', DB_VERSION)
      db = this.result

      if (!db.objectStoreNames.contains('report')) {
        let objectStore = db.createObjectStore('report',
          { keyPath: 'id', autoIncrement: true })
        objectStore.createIndex('userId', 'userId')
        objectStore.createIndex('tweetId', 'tweetId')
      }

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
    console.log('Adding', entry, 'to', storeName, 'store')
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

  ////////////////////////
  // DOWNLOAD FUNCTIONS //
  ////////////////////////

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

  //////////////////////
  // UPDATE FUNCTIONS //
  //////////////////////

  // Check status on open reports
  function getUpdates () {
    console.log('Checking if it is time for an update')
    localStorage.get({
      'lastUpdate': Date.now()
    }, function (res) {
      if (Date.now() > res.lastUpdate + UPDATE_WAIT) {
        console.log('Updating')
        localStorage.set({
          'lastUpdate': Date.now()
        })
        resetLocalStorage()
      }
    })
  }

  function resetLocalStorage () {
    console.log('Resetting locale storage variables')
    localStorage.set({
      'recentUserUpdates': '{}',
      'recentTweetUpdates': '{}'
    }, function (res) {
      clearBadge()
      recentUserUpdates = {}
      recentTweetUpdates = {}
      updateTweetStore()
      updateUserStore()
    })
  }

  // Set badge text to number of recent updates
  function updateBadge () {
    console.log('Updating badge to ', badgeCounter)
    if (badgeCounter > 0) {
      window.browser.browserAction.setBadgeText({
        text: badgeCounter.toString()
      })
    } else {
      clearBadge()
    }
  }

  function clearBadge () {
    window.browser.browserAction.setBadgeText({
      text: ''
    })
    badgeCounter = 0
    localStorage.set({
      'badgeCounter': 0
    })
  }

  function updateUserStore () {
    let tx = db.transaction(DB_USER_STORE_NAME, 'readwrite')
    let store = tx.objectStore(DB_USER_STORE_NAME)
    let req = store.openCursor()

    req.onsuccess = function (evt) {
      let cursor = evt.target.result

      if (cursor && (cursor.value.status === 'available' || (CHECK_SUSPENDED === true && cursor.value.status === 'suspended'))) {
        let value = cursor.value

        fetch('https://twitter.com/intent/user?user_id=' + value.id)
            .then(function (res) {
              if (res.url === 'https://twitter.com/account/suspended') {
                if (value.status !== 'suspended') {
                  updateItemStatus(value, 'suspended', DB_USER_STORE_NAME, 'suspended')
                }
              } else if (res.status === 404) {
                updateItemStatus(value, 'deleted', DB_USER_STORE_NAME, 'deleted')
              } else if (CHECK_SUSPENDED === true && value.status === 'suspended') {
                totalStatistics[DB_USER_STORE_NAME]['unsuspended']++
                value.unsuspendCount = !value.unsuspendCount ? 1 : value.unsuspendCount + 1
                updateItemStatus(value, 'available', DB_USER_STORE_NAME, 'unsuspended')
              } else {
                addItemToWatchList(value, DB_USER_STORE_NAME, 'available')
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
      if (cursor && cursor.value.status === 'available') {
        let value = cursor.value
        fetch('https://twitter.com' + value.permalinkPath)
          .then(function (res) {
            if (res.url === 'https://twitter.com/account/suspended' ||
                res.status === 404) {
              updateItemStatus(value, 'deleted', DB_TWEET_STORE_NAME, 'deleted')
            } else {
              addItemToWatchList(value, DB_TWEET_STORE_NAME, 'available')
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
    console.log(content)
    addToDb(content.reportData, DB_REPORT_STORE_NAME)

    if (content.userData['id'] !== undefined) {
      queryDb(content.userData['id'], DB_USER_STORE_NAME, handleUserReport)
      addItemToWatchList(content.userData, DB_USER_STORE_NAME, 'available')
    }

    if (content.tweetData['id'] !== undefined) {
      queryDb(content.tweetData['id'], DB_TWEET_STORE_NAME, handleTweetReport)
      addItemToWatchList(content.tweetData, DB_TWEET_STORE_NAME, 'available')
    }

    function handleUserReport (entry) {
      if (entry === undefined) {
        console.log('Adding user', content)
        totalStatistics[DB_USER_STORE_NAME]['reported']++
        localStorage.set({
          'totalStatistics': JSON.stringify(totalStatistics)})
        addToDb(content.userData, DB_USER_STORE_NAME)
      } else if (entry.status === 'suspended' && CHECK_SUSPENDED === true) {
        console.log('Updating zombie user', content)
        totalStatistics[DB_USER_STORE_NAME]['unsuspended']++
        totalStatistics[DB_USER_STORE_NAME]['suspended']--
        updateItemStatus(content.userData, 'available', DB_USER_STORE_NAME, 'unsuspended')
      }
    }

    function handleTweetReport (entry) {
      if (entry === undefined) {
        console.log('Adding tweet', content)
        addToDb(content.tweetData, DB_TWEET_STORE_NAME)
        totalStatistics[DB_TWEET_STORE_NAME]['reported']++
        localStorage.set({
          'totalStatistics': JSON.stringify(totalStatistics)})
      }
    }
  }

  function updateItemStatus (entry, newStatus, storeName, displayStatus) {
    entry.status = newStatus
    if (entry['statusHistory'] === undefined) {
      entry['statusHistory'] = []
    }
    entry.statusHistory.push({
      'date': Date.now(), 'action': displayStatus })
    addToDb(entry, storeName)
    updateBadge(badgeCounter++)

    totalStatistics[storeName][entry.status] += 1

    addItemToWatchList(entry, storeName, displayStatus)

    localStorage.set({
      'totalStatistics': JSON.stringify(totalStatistics),
      'badgeCounter': badgeCounter
    })
  }

  function addItemToWatchList (value, storeName, displayStatus) {
    console.log('Adding', value, 'to recent updates')
    value.status = displayStatus
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
