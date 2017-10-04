(function () {
  'use strict'

  if (!!window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  const browserStorage = window.browser.storage.local
  window.browser.runtime.onMessage.addListener(handleMessage)

  function handleMessage (request, sender, sendResponse) {
    if (request.update === true) {
      let popup = new PopUp()
      popup.updateUsers()
      popup.updateTweets()
    }
  }

  var PopUp = function () {
    this.userDeletedCount = 0
    this.userSuspendedCount = 0
    this.userRemainsCount = 0
    this.tweetDeletedCount = 0
    this.tweetRemainsCount = 0
  }

  PopUp.prototype = {
    numUpdates: function () {
      return this.userDeletedCount +
             this.userSuspendedCount +
             this.tweetDeletedCount
    },

    updateBadge: function () {
      const badgeText = this.numUpdates().toString()
      window.browser.browserAction.setBadgeText({
        text: badgeText
      })
    },

    updateUsers: function () {
      let self = this
      browserStorage.get({'taUsers': '{}'}, function (data) {
        let users = JSON.parse(data.taUsers)
        let usersSuspended = {}
        let usersDeleted = {}

        Object.keys(users).forEach(function (userId) {
          // if (users[userId]['status'] === null) {
            // fetch('https://twitter.com/intent/user?user_id=' + userId)
              // .then(function (res) {
                // if (res.url === 'https://twitter.com/account/suspended') {
                  users[userId]['status'] = 'suspended'
                  usersSuspended[userId] = users[userId]
                  self.userSuspendedCount++
                // } else if (res.status === 404) {
                  // users[userId]['status'] = 'deleted'
                  usersDeleted[userId] = users[userId]
                  self.userDeletedCount++
                // } else {
                  // userRemainsCount++
                // }
              // })
          // }
        })

        browserStorage.set({
          'taUsers': JSON.stringify(users),
          'taUsersSuspended': JSON.stringify(usersSuspended),
          'taUsersDeleted': JSON.stringify(usersDeleted)
        }, function () {
          self.updateBadge()
        })
      })
    },


    updateTweets: function () {
      let self = this
      browserStorage.get({'taTweets': '{}'}, function (data) {
        let tweets = JSON.parse(data.taTweets)
        let tweetsDeleted = {}

        Object.keys(tweets).forEach(function (tweetId) {
          // if (tweets[tweetId]['status'] === null) {
            // fetch('https://twitter.com' + tweets[tweetId]['tweetPermalinkPath'])
              // .then(function (res) {
                // if (res.status === 404) {
                  tweets[tweetId]['status'] = 'deleted'
                  tweetsDeleted[tweetId] = tweets[tweetId]
                  self.tweetDeletedCount++
                // } else {
                  self.tweetRemainsCount++
                // }
              // })
          // }
        })

        window.browser.storage.local.set({
          'taTweets': JSON.stringify(tweets),
          'taTweetsDeleted': JSON.stringify(tweetsDeleted)
        }, function () {
          self.updateBadge()
        })
      })
    }
  }
})()
