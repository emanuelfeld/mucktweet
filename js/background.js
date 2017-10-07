(function () {
  'use strict'

  let DEBUG = false

  if (window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  const DB_NAME = 'mucktweet-db'
  const DB_VERSION = 1
  const DB_USER_STORE_NAME = 'user'
  const DB_TWEET_STORE_NAME = 'tweet'

  const timestampNow = Date.now()
  let lastUpdate

  let db
  let localStorage = window.browser.storage.local
  let badgeCounter = 0

  window.browser.runtime.onMessage.addListener(handleReport)
  window.browser.runtime.onConnect.addListener(handleDashboard)

  openDb()

  function handleDashboard (port) {
    let tx = db.transaction([port.name], 'readwrite')
    let store = tx.objectStore(port.name)

    let modIndex = store.index('hasUpdate')
    let modReq = modIndex.openCursor(IDBKeyRange.only(1))

    modReq.onsuccess = function (evt) {
      let cursor = evt.target.result
      if (cursor) {
        port.postMessage({'content': cursor.value})
        cursor.continue()
      }
    }

    let unmodIndex = store.index('status')
    let unmodReq = unmodIndex.openCursor(IDBKeyRange.only('available'))

    unmodReq.onsuccess = function (evt) {
      let cursor = evt.target.result
      if (cursor) {
        port.postMessage({'content': cursor.value})
        cursor.continue()
      }
    }
  }

  function handleReport (request, sender, sendResponse) {
    if (request.type === 'report') {
    let content = request.content
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
  } else if (request.type === 'download') {
    downloadLocal(request.content)
  }
}
  function updateStatus (force = false) {
    console.log('updating badge')
    localStorage.get({
      'mucktweetLastUpdate': 0
    }, function (res) {
      lastUpdate = res.mucktweetLastUpdate
      if (DEBUG === true || force === true ||
         lastUpdate === 0 || (timestampNow > lastUpdate + 8.64e+7)) {
        updateUserStatus()
        updateTweetStatus()
      }
      localStorage.set({
        'mucktweetLastUpdate': timestampNow
      })
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

  function updateUserStatus () {
    let tx = db.transaction(DB_USER_STORE_NAME, 'readwrite')
    let userStore = tx.objectStore(DB_USER_STORE_NAME)
    let userIndex = userStore.index('status')
    let userReq = userIndex.openCursor()

    userReq.onsuccess = function (evt) {
      let cursor = evt.target.result
      if (cursor && cursor.value.reportDate > lastUpdate) {
        fetch('https://twitter.com/intent/user?user_id=' + cursor.value.id)
            .then(function (res) {
              if (res.url === 'https://twitter.com/account/suspended') {
                cursor.value.status = 'suspended'
                cursor.value.hasUpdate = 1
                cursor.value.updatDate = timestampNow
                addToDb(cursor.value, DB_USER_STORE_NAME)
                updateBadge(badgeCounter++)
              } else if (res.status === 404) {
                cursor.value.status = 'deleted'
                cursor.value.hasUpdate = 1
                cursor.value.updatDate = timestampNow
                addToDb(cursor.value, DB_USER_STORE_NAME)
                updateBadge(badgeCounter++)
              }
            })
        cursor.continue()
      } else if (cursor) {
        cursor.value.hasUpdate = 0
        addToDb(cursor.value, DB_USER_STORE_NAME)
        cursor.continue()
      }
    }
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
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(content, null, 4));
    let dlAnchorElem = document.createElement('a')
    dlAnchorElem.setAttribute("href", dataStr     )
    dlAnchorElem.setAttribute("download", filename + ".json")
    dlAnchorElem.click()
  }

  function updateTweetStatus () {
    let tx = db.transaction(DB_TWEET_STORE_NAME, 'readwrite')
    let tweetStore = tx.objectStore(DB_TWEET_STORE_NAME)
    let tweetIndex = tweetStore.index('status')
    let tweetReq = tweetIndex.openCursor()

    tweetReq.onsuccess = function (evt) {
      console.log('tweetReq success')
      let cursor = evt.target.result
      if (cursor && cursor.value.reportDate > lastUpdate) {
        fetch('https://twitter.com' + cursor.value.permalinkPath)
              .then(function (res) {
                if (res.status === 404) {
                  cursor.value.status = 'deleted'
                  cursor.value.hasUpdate = 1
                  cursor.value.updatDate = timestampNow
                  addToDb(cursor.value, DB_TWEET_STORE_NAME)
                  updateBadge(badgeCounter++)
                }
              })
        cursor.continue()
      } else if (cursor) {
        cursor.value.hasUpdate = 0
        addToDb(cursor.value, DB_USER_STORE_NAME)
        cursor.continue()
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
    console.log('Adding ID ' + entry['id'] + ' to ' + storeName + '.')
    let store = getObjectStore(storeName, 'readwrite')
    let req = store.put(entry)

    req.onsuccess = function (evt) {
      console.log('Successfully added ID ' + entry['id'] + ' to ' + storeName + '.')
    }

    req.onerror = function (evt) {
      console.error('Failed to add ID ' + entry['id'] + ' to ' + storeName + '.')
      console.error(this.error)
    }
  }

  function queryDb (key, storeName) {
    console.log('Querying ' + storeName + ' for ID ' + key + '.')
    let store = getObjectStore(storeName, 'readwrite')
    let req = store.get(key)

    req.onsuccess = function (evt) {
      return evt.target.result
    }

    req.onerror = function (evt) {
      console.error('Failed to query ' + storeName + ' for ID ' + key + '.')
      console.error(this.error)
    }
  }

  function getObjectStore (storeName, mode) {
    let tx = db.transaction(storeName, mode)
    return tx.objectStore(storeName)
  }
})()
