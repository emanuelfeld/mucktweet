(function () {
  'use strict'

  const DEBUG = false

  if (!!window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  const DB_NAME = 'mucktweet-db'
  const DB_VERSION = 1
  const DB_USER_STORE_NAME = 'user'
  const DB_TWEET_STORE_NAME = 'tweet'

  let lastUpdate

  let db
  let localStorage = window.browser.storage.local
  let badgeCounter = 0

  window.browser.runtime.onInstalled.addListener(function () {
    const url = window.browser.extension.getURL('dashboard.html')
    window.browser.tabs.update({
      'active': true,
      'url': url + '#about'})
  })
  window.browser.runtime.onMessage.addListener(handleMessage)
  window.browser.runtime.onConnect.addListener(handlePort)

  openDb()

  function handlePort (port) {
    const tx = db.transaction([port.name], 'readwrite')
    const store = tx.objectStore(port.name)

    const modIndex = store.index('hasUpdate')
    const modReq = modIndex.openCursor(IDBKeyRange.only(1))

    modReq.onsuccess = function (evt) {
      const cursor = evt.target.result
      if (cursor) {
        port.postMessage({'content': cursor.value})
        cursor.continue()
      }
    }

    const unmodIndex = store.index('status')
    const unmodReq = unmodIndex.openCursor(IDBKeyRange.only('available'))

    unmodReq.onsuccess = function (evt) {
      const cursor = evt.target.result
      if (cursor) {
        port.postMessage({'content': cursor.value})
        cursor.continue()
      }
    }
  }

  function handleMessage (request, sender, sendResponse) {
    const type = request.type
    const content = request.content
    if (type === 'popup') {
      const url = window.browser.extension.getURL('dashboard.html')
      sendResponse({'content': url + '#' + content})
    } else if (type === 'report') {
      if (content.userData !== {}) {
        let entry = queryDb(content.userData['id'], DB_USER_STORE_NAME)
        if (entry === undefined) {
          console.log('Adding user.')
          entry = content.userData
        } else {
          console.warn('User already reported. Updating.')
          entry['userReportCount']++
          entry['hasUpdate'] = 0
        }
        addToDb(entry, DB_USER_STORE_NAME)
      }

      if (content.tweetData !== {}) {
        let entry = queryDb(content.tweetData['id'], DB_TWEET_STORE_NAME)
        if (entry === undefined) {
          console.log('Adding tweet.')
          addToDb(content.tweetData, DB_TWEET_STORE_NAME)
        } else {
          console.warn('Tweet already reported.')
        }
      }
      sendResponse({'content': 'ok'})
      updateStatus()
    } else if (type === 'download') {
      downloadLocal(request.content)
    }
  }

  function updateStatus (force = false) {
    localStorage.get({
      'mucktweetLastUpdate': 0
    }, function (res) {
      lastUpdate = res.mucktweetLastUpdate
      if (DEBUG === true || force === true ||
         lastUpdate === 0 || (Date.now() > lastUpdate + 8.64e+7)) {
        updateTweetStatus()
        updateUserStatus()
        localStorage.set({
          'mucktweetLastUpdate': Date.now()
        })
      }
    })
  }

  function updateBadge () {
    localStorage.set({
      'badgeCounter': badgeCounter
    })
    window.browser.browserAction.setBadgeText({
      text: badgeCounter.toString()
    })
  }

  function downloadLocal (storeName) {
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

  function updateCursorStatus (value, newStatus, storeName) {
    value.status = newStatus
    value.hasUpdate = 1
    value.updateDate = Date.now()
    addToDb(value, storeName)
    updateBadge(badgeCounter++)
  }

  function updateUserStatus () {
    let tx = db.transaction(DB_USER_STORE_NAME, 'readwrite')
    let userStore = tx.objectStore(DB_USER_STORE_NAME)
    let userIndex = userStore.index('status')
    let userReq = userIndex.openCursor()

    userReq.onsuccess = function (evt) {
      let userCursor = evt.target.result
      if (userCursor && userCursor.value.updateDate === null) {
        let value = userCursor.value
        fetch('https://twitter.com/intent/user?user_id=' + value.id)
            .then(function (res) {
              if (res.url === 'https://twitter.com/account/suspended') {
                console.log('suspended!!!')
                updateCursorStatus(value, 'suspended', DB_USER_STORE_NAME)
              } else if (res.status === 404) {
                updateCursorStatus(value, 'deleted', DB_USER_STORE_NAME)
              }
            })
        userCursor.continue()
      } else if (userCursor) {
        let value = userCursor.value
        value.hasUpdate = 0
        addToDb(value, DB_USER_STORE_NAME)
        userCursor.continue()
      }
    }
  }

  function updateTweetStatus () {
    let tx = db.transaction(DB_TWEET_STORE_NAME, 'readwrite')
    let tweetStore = tx.objectStore(DB_TWEET_STORE_NAME)
    let tweetIndex = tweetStore.index('status')
    let tweetReq = tweetIndex.openCursor('available')

    tweetReq.onsuccess = function (evt) {
      let tweetCursor = evt.target.result
      if (tweetCursor && tweetCursor.value.updateDate === null) {
        let value = tweetCursor.value
        fetch('https://twitter.com' + value.permalinkPath)
          .then(function (res) {
            if (res.status === 404) {
              updateCursorStatus(value, 'deleted', DB_TWEET_STORE_NAME)
            }
          })
        tweetCursor.continue()
      } else if (tweetCursor) {
        console.log(tweetCursor.updateDate)
        let value = tweetCursor.value
        value.hasUpdate = 0
        addToDb(value, DB_TWEET_STORE_NAME)
        tweetCursor.continue()
      }
    }
  }

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
      updateStatus()
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

  function queryDb (key, storeName) {
    console.log('Querying ' + storeName + ' store for ID ' + key + '.')
    let store = getObjectStore(storeName, 'readwrite')
    let req = store.get(key)

    req.onsuccess = function (evt) {
      return evt.target.result
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
})()
