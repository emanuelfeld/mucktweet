(function () {
  'use strict'

  var Report = function () {
    this.userId = null
    this.userData = {}
    this.tweetId = null
    this.tweetData = {}
  }

  Report.prototype = {
    getUserData: function (e) {
      this.userId = e.getAttribute('data-user-id')
      this.userData = {
        'userScreenName': e.getAttribute('data-screen-name'),
        'userName': e.getAttribute('data-name'),
        'userStatus': null,
        'userReportCount': 1 
      }
    },

    getTweetData: function (e) {
      this.tweetId = e.getAttribute('data-tweet-id')
      this.tweetData = {
        'userId': e.getAttribute('data-user-id'),
        'tweetPermalinkPath': e.getAttribute('data-permalink-path'),
        'tweetReportDate': parseInt(new Date().toJSON().slice(0, 10).replace(/-/g, '')),
        'tweetStatus': null
      }
    },

    beganTweetReport: function () {
      return document.getElementById('report-dialog').classList.contains('report-tweet')
      // return e.parentElement.classList.contains('report-link')
    },

    beganUserReport: function () {
      return document.getElementById('report-dialog').classList.contains('report-user')
      // return e.parentElement.classList.contains('report-text')
    },

    submittedReport: function (e) {
      return e.classList.contains('new-report-flow-done-button')
    }
  }

  function resetStorage (browserStorage) {
    browserStorage.remove(['taLastUpdate', 'taTweets', 'taUsers'], function () {
      let error = window.browser.runtime.lastError
      if (error) {
        console.error(error)
      }
    })
  }

  window.onload = function () {
    let report = new Report()

    if (!!window.chrome) {
      window.browser = window.chrome
    } else {
      window.browser = browser
    }

    let browserStorage = window.browser.storage.local

    // Check for status updates once a day
    browserStorage.get({
      'taLastUpdate': 0
    }, function (res) {
      let lastUpdate = res.taLastUpdate
      // if (lastUpdate === 0 || (todayDate > lastUpdate)) {
        window.browser.runtime.sendMessage({
          'update': true
        })
      // }
    })

    document.onclick = function (event) {
      if (report.beganUserReport()) {
        let elem = document.querySelector('.user-actions')
        report.getUserData(elem)
        console.log(report)
      } else if (report.beganTweetReport()) {
        let elem = event.srcElement.closest('.tweet')
        report.getUserData(elem)
        report.getTweetData(elem)
        console.log(report)
      } else if (report.submittedReport(event.srcElement)) {
        browserStorage.get({
          'taTweets': '{}',
          'taUsers': '{}'
        }, function (res) {
          let tweets = JSON.parse(res.taTweets)
          let users = JSON.parse(res.taUsers)

          if (report.tweetId && !(report.tweetId in tweets)) {
            tweets[report.tweetId] = report.tweetData
            browserStorage.set({
              'taTweets': JSON.stringify(tweets)
            })
          }

          if (report.userId && !(report.userId in users)) {
            users[report.userId] = report.userData
          } else {
            users[report.userId]['userReportCount'] += 1
          }

          console.log(users)
          console.log(tweets)

          browserStorage.set({
            'taUsers': JSON.stringify(users)
          })
        })
      }
    }
  }
})()
